import { RSI, MACD } from "technicalindicators";
import { createExchangeService, type ExchangeServiceInstance } from "./exchangeFactory.js";
import { getAIDecision } from "./aiService.js";
import { validateTrade } from "./riskEngine.js";
import { safetyService } from "./safetyService.js";
import { logger } from "./loggerService.js";
import { decrypt } from "./encryptionService.js";
import { getUserDoc } from "./authService.js";
import { TradeModel } from "../db/models/Trade.js";
import { ENGINE } from "../shared/constants.js";
import type {
  PriceBar,
  AIDecision,
  AgentStatus,
  PortfolioSnapshot,
  Position,
  MarketTick,
  Trade,
  AIPromptData,
} from "../shared/types.js";

type StreamCallback = {
  onMarketTick?: (tick: MarketTick) => void;
  onPortfolio?: (snap: PortfolioSnapshot) => void;
  onPositions?: (positions: Position[]) => void;
  onTradeExecuted?: (trade: Trade) => void;
  onAIDecision?: (decision: AIDecision) => void;
  onAgentStatus?: (status: AgentStatus) => void;
};

export class TradeEngine {
  private userId: string = "";
  private symbol: string = "";
  private exchange: ExchangeServiceInstance | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private priceBuffer: PriceBar[] = [];
  private running = false;
  private lastAIDecision: AIDecision | null = null;
  private callbacks: StreamCallback = {};
  private apiFailures = 0;
  private claudeApiKey: string | undefined = undefined;

  setCallbacks(cb: StreamCallback): void {
    this.callbacks = cb;
  }

  getLastAIDecision(): AIDecision | null {
    return this.lastAIDecision;
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus(): AgentStatus {
    const safety = safetyService.getState();
    return {
      running: this.running,
      frozen: safety.frozen,
      reason: safety.frozenReason ?? undefined,
    };
  }

  async start(userId: string, symbol: string): Promise<void> {
    if (this.running) return;

    const user = await getUserDoc(userId);
    this.userId = userId;
    this.symbol = symbol.toUpperCase();
    this.priceBuffer = [];
    this.apiFailures = 0;

    const selectedExchange = user.selectedExchange;
    const keys = user.exchangeKeys[selectedExchange];
    if (!keys.apiKey || !keys.apiSecret) {
      throw new Error(`No API keys configured for ${selectedExchange}`);
    }

    const decryptedKey = decrypt(keys.apiKey);
    const decryptedSecret = decrypt(keys.apiSecret);

    // Decrypt Claude API key if user has one stored
    this.claudeApiKey = user.claudeApiKey ? decrypt(user.claudeApiKey) : undefined;

    this.exchange = createExchangeService(selectedExchange);
    await this.exchange.initialize({ apiKey: decryptedKey, apiSecret: decryptedSecret }, user.tradingMode);

    this.exchange.startTickerStream(this.symbol, (tick) => {
      this.priceBuffer.push({ price: tick.price, timestamp: tick.timestamp });
      if (this.priceBuffer.length > ENGINE.PRICE_BUFFER_SIZE) {
        this.priceBuffer.shift();
      }
      this.callbacks.onMarketTick?.(tick);
    });

    this.running = true;
    this.emitStatus();
    await logger.info("TRADE", `Agent started on ${this.symbol} (${selectedExchange} ${user.tradingMode})`);

    this.scheduleNextCycle();
  }

  private scheduleNextCycle(): void {
    if (!this.running) return;
    this.loopTimer = setTimeout(() => this.cycle(), ENGINE.LOOP_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = null;

    this.exchange?.stopTickerStream();
    this.exchange?.destroy();
    this.exchange = null;

    this.running = false;
    this.emitStatus();
    await logger.info("TRADE", "Agent stopped");
  }

  async killSwitch(): Promise<void> {
    await logger.error("SAFETY", "KILL SWITCH — executing emergency shutdown");

    if (this.exchange) {
      try {
        await this.exchange.cancelAllOrders(this.symbol);
      } catch (err) {
        await logger.error("SAFETY", `Kill switch: cancel orders failed: ${err}`);
      }

      try {
        const positions = await this.exchange.getOpenPositions();
        for (const pos of positions) {
          await this.exchange.closePosition(pos.symbol, pos.side, pos.quantity);
          await logger.info("SAFETY", `Kill switch: closed ${pos.symbol} ${pos.side} ${pos.quantity}`);
        }
      } catch (err) {
        await logger.error("SAFETY", `Kill switch: close positions failed: ${err}`);
      }
    }

    safetyService.activateKillSwitch();
    await this.stop();
  }

  private async cycle(): Promise<void> {
    if (!this.exchange || !this.running) return;

    try {
      // [1] Safety gates
      if (!safetyService.canTrade()) {
        await logger.warn("SAFETY", "Cycle skipped — agent is frozen");
        return;
      }

      // [2] Check indicators ready
      if (this.priceBuffer.length < ENGINE.MIN_BARS_FOR_INDICATORS) {
        return;
      }

      const prices = this.priceBuffer.map((b) => b.price);
      const currentPrice = prices[prices.length - 1];

      const rsiValues = RSI.calculate({ values: prices, period: ENGINE.RSI_PERIOD });
      const rsi = rsiValues[rsiValues.length - 1] ?? 50;

      const macdResult = MACD.calculate({
        values: prices,
        fastPeriod: ENGINE.MACD_FAST,
        slowPeriod: ENGINE.MACD_SLOW,
        signalPeriod: ENGINE.MACD_SIGNAL,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const macdRaw = macdResult[macdResult.length - 1];
      const macd = macdRaw ?? { MACD: 0, signal: 0, histogram: 0 };

      // [3] Portfolio
      let portfolio: PortfolioSnapshot;
      try {
        portfolio = await this.exchange.getBalance();
        this.apiFailures = 0;
      } catch (err) {
        this.apiFailures++;
        if (this.apiFailures >= ENGINE.EXCHANGE_RETRY_COUNT) {
          safetyService.reportApiFailure();
          this.emitStatus();
        }
        await logger.error("TRADE", `Exchange balance fetch failed (attempt ${this.apiFailures}): ${err}`);
        return;
      }

      safetyService.updatePeakBalance(portfolio.totalBalance);
      if (!safetyService.checkDrawdown(portfolio.totalBalance)) {
        this.emitStatus();
        return;
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todaysTrades = await TradeModel.find({
        userId: this.userId,
        status: "CLOSED",
        closedAt: { $gte: todayStart },
      });
      const dailyPnl = todaysTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      portfolio.dailyPnl = dailyPnl;

      this.callbacks.onPortfolio?.(portfolio);

      // [4] Open positions
      let positions: Position[];
      try {
        positions = await this.exchange.getOpenPositions();
      } catch (err) {
        await logger.error("TRADE", `Position fetch failed: ${err}`);
        return;
      }

      this.callbacks.onPositions?.(positions);

      // [5] Check SL/TP on open trades
      const openTrades = await TradeModel.find({ userId: this.userId, status: "OPEN" });
      for (const trade of openTrades) {
        if (!trade.aiDecision) continue;
        const ai = trade.aiDecision as { stop_loss: number; take_profit: number };

        const hitSL =
          trade.side === "BUY" ? currentPrice <= ai.stop_loss : currentPrice >= ai.stop_loss;
        const hitTP =
          trade.side === "BUY" ? currentPrice >= ai.take_profit : currentPrice <= ai.take_profit;

        if (hitSL || hitTP) {
          try {
            await this.exchange.closePosition(trade.symbol, trade.side as "BUY" | "SELL", trade.quantity);
            const pnl =
              trade.side === "BUY"
                ? (currentPrice - trade.entryPrice) * trade.quantity
                : (trade.entryPrice - currentPrice) * trade.quantity;

            trade.exitPrice = currentPrice;
            trade.pnl = pnl;
            trade.status = "CLOSED";
            trade.closedAt = new Date();
            await trade.save();

            if (pnl >= 0) safetyService.recordWin();
            else safetyService.recordLoss();

            const reason = hitSL ? "STOP_LOSS" : "TAKE_PROFIT";
            await logger.info("TRADE", `Position closed via ${reason}: ${trade.symbol} PnL: ${pnl.toFixed(2)}`);

            this.callbacks.onTradeExecuted?.({
              _id: trade._id.toString(),
              userId: trade.userId.toString(),
              symbol: trade.symbol,
              side: trade.side as "BUY" | "SELL",
              type: trade.type as "MARKET" | "LIMIT",
              entryPrice: trade.entryPrice,
              exitPrice: currentPrice,
              quantity: trade.quantity,
              pnl,
              status: "CLOSED",
              source: trade.source as "AI" | "MANUAL" | "SYSTEM",
              exchange: trade.exchange as "binance" | "bybit",
              mode: trade.mode as "spot" | "futures",
              aiDecision: trade.aiDecision as unknown as AIDecision | null,
              riskCheck: trade.riskCheck as Trade["riskCheck"],
              createdAt: trade.createdAt.toISOString(),
              closedAt: new Date().toISOString(),
            });
          } catch (err) {
            await logger.error("TRADE", `Failed to close position: ${err}`);
          }
        }
      }

      // [6] AI decision
      const user = await getUserDoc(this.userId);
      const openTradeCount = await TradeModel.countDocuments({ userId: this.userId, status: "OPEN" });

      const promptData: AIPromptData = {
        symbol: this.symbol,
        exchange: user.selectedExchange,
        mode: user.tradingMode,
        currentPrice,
        indicators: {
          rsi,
          macd: {
            line: macd.MACD ?? 0,
            signal: macd.signal ?? 0,
            histogram: macd.histogram ?? 0,
          },
        },
        portfolio,
        openPositions: positions,
        riskProfile: user.riskProfile,
      };

      const decision = await getAIDecision(promptData, this.claudeApiKey);
      this.lastAIDecision = decision;
      this.callbacks.onAIDecision?.(decision);
      await logger.info("AI", `Decision: ${decision.decision} (confidence: ${decision.confidence})`, { decision });

      // [7] HOLD → skip
      if (decision.decision === "HOLD") return;

      // [8] Risk check
      const priceChange1h =
        this.priceBuffer.length > 1
          ? ((currentPrice - this.priceBuffer[0].price) / this.priceBuffer[0].price) * 100
          : 0;

      const dailyRealizedLoss = Math.abs(Math.min(0, dailyPnl));

      const riskResult = validateTrade({
        decision,
        portfolio,
        openTradeCount,
        dailyRealizedLoss,
        priceChange1h,
        spread: 0.1,
        peakBalance: safetyService.getState().peakBalance,
        riskProfile: user.riskProfile,
        tradingMode: user.tradingMode,
      });

      if (!riskResult.approved) {
        await logger.warn("RISK", `Trade rejected: ${riskResult.reasons.join(", ")}`, { riskResult });
        return;
      }

      // [10] Position size
      const riskAmount = portfolio.totalBalance * (user.riskProfile.maxRiskPct / 100);
      const slDistance = Math.abs(decision.entry - decision.stop_loss);
      if (slDistance <= 0) return;
      const quantity = parseFloat((riskAmount / slDistance).toFixed(6));

      // [11] Leverage (futures)
      if (user.tradingMode === "futures") {
        await this.exchange.setLeverage(this.symbol, user.riskProfile.maxLeverage);
      }

      // [12] Execute
      const orderResult = await this.exchange.placeMarketOrder(this.symbol, decision.decision as "BUY" | "SELL", quantity);

      // [13] Record trade
      const tradeDoc = await TradeModel.create({
        userId: this.userId,
        symbol: this.symbol,
        side: decision.decision,
        type: "MARKET",
        entryPrice: orderResult.price || decision.entry,
        quantity: orderResult.quantity || quantity,
        status: "OPEN",
        source: "AI",
        exchange: user.selectedExchange,
        mode: user.tradingMode,
        aiDecision: decision,
        riskCheck: riskResult,
      });

      await logger.info("TRADE", `Order executed: ${decision.decision} ${this.symbol} qty=${quantity}`, {
        orderId: orderResult.orderId,
        decision,
        riskResult,
      });

      // [14] Emit
      this.callbacks.onTradeExecuted?.({
        _id: tradeDoc._id.toString(),
        userId: this.userId,
        symbol: this.symbol,
        side: decision.decision as "BUY" | "SELL",
        type: "MARKET",
        entryPrice: orderResult.price || decision.entry,
        exitPrice: null,
        quantity: orderResult.quantity || quantity,
        pnl: null,
        status: "OPEN",
        source: "AI",
        exchange: user.selectedExchange,
        mode: user.tradingMode,
        aiDecision: decision,
        riskCheck: riskResult,
        createdAt: tradeDoc.createdAt.toISOString(),
        closedAt: null,
      });
    } catch (err) {
      await logger.error("TRADE", `Cycle error: ${err}`);
    } finally {
      this.scheduleNextCycle();
    }
  }

  private emitStatus(): void {
    this.callbacks.onAgentStatus?.(this.getStatus());
  }
}

export const tradeEngine = new TradeEngine();

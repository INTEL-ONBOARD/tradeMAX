import { RSI, MACD, EMA, BollingerBands, ADX, ATR, Stochastic } from "technicalindicators";
import { createExchangeService, type ExchangeServiceInstance } from "./exchangeFactory.js";
import { getAIDecision } from "./aiService.js";
import { getVotedDecision } from "./votingService.js";
import { validateTrade, type RiskOptions } from "./riskEngine.js";
import { safetyService } from "./safetyService.js";
import { alertService } from "./alertService.js";
import { logger } from "./loggerService.js";
import { decrypt } from "./encryptionService.js";
import { getUserDoc } from "./authService.js";
import { TradeModel } from "../db/models/Trade.js";
import { CandleAggregator } from "./candleAggregator.js";
import { AUTO_PAIR_FALLBACKS, selectBestAutoPair, type AutoPairTicker } from "./autoPairSelection.js";
import { ENGINE } from "../shared/constants.js";
import type {
  AIDecision,
  AgentStatus,
  PortfolioSnapshot,
  Position,
  MarketTick,
  Trade,
  AIPromptData,
  EngineConfig,
  CandleBar,
} from "../shared/types.js";

type StreamCallback = {
  onMarketTick?: (tick: MarketTick) => void;
  onPortfolio?: (snap: PortfolioSnapshot) => void;
  onPositions?: (positions: Position[]) => void;
  onTradeExecuted?: (trade: Trade) => void;
  onAIDecision?: (decision: AIDecision) => void;
  onAgentStatus?: (status: AgentStatus) => void;
};

async function fetchBestAutoPair(
  candidates: string[],
  mode: "spot" | "futures",
): Promise<string | null> {
  const normalizedCandidates = candidates.map((symbol) => symbol.toUpperCase());
  if (normalizedCandidates.length === 0) return null;

  const category = mode === "spot" ? "spot" : "linear";
  const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=${category}`);
  if (!res.ok) {
    throw new Error(`AUTO_PAIR_FETCH_${res.status}`);
  }

  const json = await res.json() as {
    result?: {
      list?: Array<{
        symbol: string;
        turnover24h?: string;
        price24hPcnt?: string;
      }>;
    };
  };

  const tickers: AutoPairTicker[] = (json.result?.list ?? []).map((ticker) => ({
    symbol: ticker.symbol,
    turnover24h: parseFloat(ticker.turnover24h || "0") || 0,
    priceChangePct24h: Math.abs((parseFloat(ticker.price24hPcnt || "0") || 0) * 100),
  }));

  return selectBestAutoPair(normalizedCandidates, tickers);
}

export class TradeEngine {
  private userId: string = "";
  private symbol: string = "";
  private exchange: ExchangeServiceInstance | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private candleAggregator: CandleAggregator | null = null;
  private running = false;
  private lastAIDecision: AIDecision | null = null;
  private callbacks: StreamCallback = {};
  private apiFailures = 0;
  private openaiApiKey: string | undefined = undefined;
  private engineConfig: EngineConfig | null = null;

  // Trailing stop tracking: tradeId -> best price seen since entry
  private trailingStops: Map<string, number> = new Map();

  // Trade cooldown tracking
  private lastTradeTimestamp = 0;

  // Daily PnL caching to avoid DB query every cycle
  private cachedDailyPnl = 0;
  private dailyPnlCycleCounter = 0;

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
    this.apiFailures = 0;
    this.lastTradeTimestamp = 0;
    this.cachedDailyPnl = 0;
    this.dailyPnlCycleCounter = 0;
    this.trailingStops.clear();

    // Load user's engine config
    this.engineConfig = user.engineConfig;

    // Configure safety service with user's thresholds
    safetyService.updateConfig({
      maxConsecutiveLosses: this.engineConfig.maxConsecutiveLosses,
      maxDrawdownPct: this.engineConfig.maxDrawdownPct,
    });

    // Register freeze callback for immediate UI notification
    safetyService.setOnFreezeCallback((reason) => {
      this.emitStatus();
      logger.warn("SAFETY", `Agent frozen: ${reason}`);
    });

    const selectedExchange = user.selectedExchange;
    const isPaper = selectedExchange === "paper";
    const userSalt = user.encryptionSalt || undefined;

    let decryptedKey = "";
    let decryptedSecret = "";

    if (!isPaper) {
      const keys = user.exchangeKeys.bybit;
      if (!keys.apiKey || !keys.apiSecret) {
        throw new Error(`No API keys configured for ${selectedExchange}`);
      }
      decryptedKey = decrypt(keys.apiKey, userSalt);
      decryptedSecret = decrypt(keys.apiSecret, userSalt);
    }

    // Support both the new OpenAI key field and the legacy Claude field for migration.
    const encryptedAIKey = user.openaiApiKey || user.claudeApiKey;
    this.openaiApiKey = encryptedAIKey ? decrypt(encryptedAIKey, userSalt) : undefined;

    this.exchange = createExchangeService(selectedExchange);
    await this.exchange.initialize({ apiKey: decryptedKey, apiSecret: decryptedSecret }, user.tradingMode);

    if (this.engineConfig.autoPairSelection) {
      const autoPairCandidates = this.engineConfig.watchlist.length > 0
        ? this.engineConfig.watchlist
        : [...AUTO_PAIR_FALLBACKS];

      try {
        const autoPair = await fetchBestAutoPair(autoPairCandidates, user.tradingMode);
        if (autoPair) {
          this.symbol = autoPair;
          await logger.info("SYSTEM", `Auto pair selection chose ${autoPair}`, {
            candidates: autoPairCandidates,
            mode: user.tradingMode,
          });
        }
      } catch (err) {
        await logger.warn("SYSTEM", `Auto pair selection failed, keeping ${this.symbol}: ${err}`);
      }
    }

    // Set starting balance for paper trading
    if (isPaper && "setStartingBalance" in this.exchange) {
      (this.exchange as import("./paperExchangeService.js").PaperExchangeService)
        .setStartingBalance(this.engineConfig.paperStartingBalance ?? 10000);
    }

    // Initialize candle aggregator with user's timeframe
    this.candleAggregator = new CandleAggregator(
      this.engineConfig.candleTimeframe,
      ENGINE.PRICE_BUFFER_SIZE,
    );

    // Start ticker stream feeding into candle aggregator
    const wsRetries = this.engineConfig.wsReconnectRetries;
    this.exchange.startTickerStream(this.symbol, (tick) => {
      this.candleAggregator?.addTick(tick.price, tick.timestamp);
      this.callbacks.onMarketTick?.(tick);
    }, wsRetries);

    this.running = true;
    this.emitStatus();
    await logger.info("TRADE", `Agent started on ${this.symbol} (${selectedExchange} ${user.tradingMode})`);

    this.scheduleNextCycle();
  }

  private scheduleNextCycle(): void {
    if (!this.running) return;
    const intervalMs = (this.engineConfig?.loopIntervalSec ?? 8) * 1000;
    this.loopTimer = setTimeout(() => this.cycle(), intervalMs);
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = null;

    this.exchange?.stopTickerStream();
    this.exchange?.destroy();
    this.exchange = null;
    this.candleAggregator = null;
    this.openaiApiKey = undefined;

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
    if (!this.exchange || !this.running || !this.candleAggregator || !this.engineConfig) return;

    try {
      // [1] Safety gates
      if (!safetyService.canTrade()) {
        await logger.warn("SAFETY", "Cycle skipped — agent is frozen");
        return;
      }

      // [2] Check if we have enough candles for indicators
      const closePrices = this.candleAggregator.getClosePrices();
      if (closePrices.length < ENGINE.MIN_BARS_FOR_INDICATORS) {
        return;
      }

      const allCandles = this.candleAggregator.getAllIncludingCurrent();
      const currentPrice = allCandles[allCandles.length - 1]?.close ?? closePrices[closePrices.length - 1];

      // [3] Calculate indicators from candle close prices (not raw ticks)
      const rsiValues = RSI.calculate({ values: closePrices, period: ENGINE.RSI_PERIOD });
      const rsi = rsiValues[rsiValues.length - 1] ?? 50;

      const macdResult = MACD.calculate({
        values: closePrices,
        fastPeriod: ENGINE.MACD_FAST,
        slowPeriod: ENGINE.MACD_SLOW,
        signalPeriod: ENGINE.MACD_SIGNAL,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const macdRaw = macdResult[macdResult.length - 1];
      const macd = macdRaw ?? { MACD: 0, signal: 0, histogram: 0 };

      // Optional EMA
      let ema: { ema12: number; ema26: number } | undefined;
      if (this.engineConfig.enableEMA && closePrices.length >= 26) {
        const ema12Values = EMA.calculate({ values: closePrices, period: 12 });
        const ema26Values = EMA.calculate({ values: closePrices, period: 26 });
        ema = {
          ema12: ema12Values[ema12Values.length - 1] ?? 0,
          ema26: ema26Values[ema26Values.length - 1] ?? 0,
        };
      }

      // Optional Bollinger Bands
      let bollingerBands: { upper: number; middle: number; lower: number } | undefined;
      if (this.engineConfig.enableBollingerBands && closePrices.length >= 20) {
        const bbResult = BollingerBands.calculate({
          values: closePrices,
          period: 20,
          stdDev: 2,
        });
        const bbLast = bbResult[bbResult.length - 1];
        if (bbLast) {
          bollingerBands = {
            upper: bbLast.upper,
            middle: bbLast.middle,
            lower: bbLast.lower,
          };
        }
      }

      // Optional ADX
      let adx: number | undefined;
      if (this.engineConfig.enableADX) {
        const candles = this.candleAggregator.getCandles();
        if (candles.length >= 14) {
          const adxResult = ADX.calculate({
            high: candles.map(c => c.high),
            low: candles.map(c => c.low),
            close: candles.map(c => c.close),
            period: 14,
          });
          adx = adxResult[adxResult.length - 1]?.adx;
        }
      }

      // Optional ATR
      let atr: number | undefined;
      if (this.engineConfig.enableATR) {
        const candles = this.candleAggregator.getCandles();
        if (candles.length >= 14) {
          const atrResult = ATR.calculate({
            high: candles.map(c => c.high),
            low: candles.map(c => c.low),
            close: candles.map(c => c.close),
            period: 14,
          });
          atr = atrResult[atrResult.length - 1];
        }
      }

      // Optional Stochastic
      let stochastic: { k: number; d: number } | undefined;
      if (this.engineConfig.enableStochastic) {
        const candles = this.candleAggregator.getCandles();
        if (candles.length >= 14) {
          const stochResult = Stochastic.calculate({
            high: candles.map(c => c.high),
            low: candles.map(c => c.low),
            close: candles.map(c => c.close),
            period: 14,
            signalPeriod: 3,
          });
          const last = stochResult[stochResult.length - 1];
          if (last) stochastic = { k: last.k, d: last.d };
        }
      }

      // [4] Portfolio
      let portfolio: PortfolioSnapshot;
      try {
        portfolio = await this.exchange.getBalance();
        this.apiFailures = 0;
      } catch (err) {
        this.apiFailures++;
        alertService.onApiError(this.symbol, this.apiFailures, ENGINE.EXCHANGE_RETRY_COUNT);
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

      // [5] Daily PnL — cached, refreshed every N cycles
      this.dailyPnlCycleCounter++;
      if (this.dailyPnlCycleCounter >= ENGINE.DAILY_PNL_CACHE_CYCLES || this.cachedDailyPnl === 0) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todaysTrades = await TradeModel.find({
          userId: this.userId,
          status: "CLOSED",
          closedAt: { $gte: todayStart },
        });
        this.cachedDailyPnl = todaysTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
        this.dailyPnlCycleCounter = 0;

        // Reset daily loss alert flag so it can fire again for the new day
        alertService.resetDaily();
      }
      portfolio.dailyPnl = this.cachedDailyPnl;

      this.callbacks.onPortfolio?.(portfolio);

      // [6] Open positions
      let positions: Position[];
      try {
        positions = await this.exchange.getOpenPositions();
      } catch (err) {
        await logger.error("TRADE", `Position fetch failed: ${err}`);
        return;
      }

      this.callbacks.onPositions?.(positions);

      // [7] Check SL/TP on open trades with corrected logic
      const openTrades = await TradeModel.find({ userId: this.userId, status: "OPEN" });
      for (const trade of openTrades) {
        if (!trade.aiDecision) continue;
        const ai = trade.aiDecision as { stop_loss: number; take_profit: number };
        if (typeof ai.stop_loss !== "number" || typeof ai.take_profit !== "number") continue;

        // SL/TP contract:
        // BUY: SL is below entry (triggers when price drops to/below SL), TP is above entry
        // SELL: SL is above entry (triggers when price rises to/above SL), TP is below entry
        let hitSL = false;
        let hitTP = false;

        if (trade.side === "BUY") {
          if (this.engineConfig.enableTrailingStop) {
            const tradeId = trade._id.toString();
            const bestSoFar = this.trailingStops.get(tradeId);
            const newBest = Math.max(bestSoFar ?? trade.entryPrice, currentPrice);
            this.trailingStops.set(tradeId, newBest);
            const trailingSL = newBest * (1 - this.engineConfig.trailingStopPct / 100);
            // Use the higher (better) stop loss
            const effectiveSL = Math.max(ai.stop_loss, trailingSL);
            hitSL = currentPrice <= effectiveSL;
          } else {
            hitSL = currentPrice <= ai.stop_loss;
          }
          hitTP = currentPrice >= ai.take_profit;
        } else {
          // SELL/short: SL is ABOVE entry, TP is BELOW entry
          if (this.engineConfig.enableTrailingStop) {
            const tradeId = trade._id.toString();
            const bestSoFar = this.trailingStops.get(tradeId);
            const newBest = Math.min(bestSoFar ?? trade.entryPrice, currentPrice);
            this.trailingStops.set(tradeId, newBest);
            const trailingSL = newBest * (1 + this.engineConfig.trailingStopPct / 100);
            // Use the lower (better) stop loss
            const effectiveSL = Math.min(ai.stop_loss, trailingSL);
            hitSL = currentPrice >= effectiveSL;
          } else {
            hitSL = currentPrice >= ai.stop_loss;
          }
          hitTP = currentPrice <= ai.take_profit;
        }

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

            // Clean up trailing stop tracking for closed trade
            this.trailingStops.delete(trade._id.toString());

            // Update cached daily PnL immediately on close
            this.cachedDailyPnl += pnl;

            if (pnl >= 0) safetyService.recordWin();
            else safetyService.recordLoss();

            const reason = hitSL ? "STOP_LOSS" : "TAKE_PROFIT";
            await logger.info("TRADE", `Position closed via ${reason}: ${trade.symbol} PnL: ${pnl.toFixed(2)}`);
            alertService.onPositionClosed(trade.symbol, reason, pnl);

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
              exchange: trade.exchange as "bybit" | "paper",
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

      // [7.5] Cleanup stale trailing stop entries for trades no longer open
      const openTradeIds = new Set(openTrades.map((t) => t._id.toString()));
      for (const trackedId of this.trailingStops.keys()) {
        if (!openTradeIds.has(trackedId)) {
          this.trailingStops.delete(trackedId);
        }
      }

      // [8] Trade cooldown check
      const cooldownMs = this.engineConfig.tradeCooldownSec * 1000;
      if (cooldownMs > 0 && Date.now() - this.lastTradeTimestamp < cooldownMs) {
        return;
      }

      // [9] Fetch real spread from exchange
      let spread = 0.1; // fallback
      try {
        spread = await this.exchange.getSpread(this.symbol);
      } catch (err) {
        await logger.warn("TRADE", `Spread fetch failed, using fallback: ${err}`);
      }

      // [10] AI decision with richer context
      const user = await getUserDoc(this.userId);
      const openTradeCount = await TradeModel.countDocuments({ userId: this.userId, status: "OPEN" });

      // Get recent trade outcomes for AI context
      const recentClosedTrades = await TradeModel.find({
        userId: this.userId,
        status: "CLOSED",
      })
        .sort({ closedAt: -1 })
        .limit(5)
        .lean();

      const recentTradeOutcomes = recentClosedTrades.map((t) => ({
        side: t.side,
        pnl: t.pnl ?? 0,
        reason: t.exitPrice && t.entryPrice
          ? (t.pnl ?? 0) >= 0 ? "TAKE_PROFIT" : "STOP_LOSS"
          : "UNKNOWN",
      }));

      // Detect market regime from indicators
      let marketRegime: "trending_up" | "trending_down" | "ranging" | "volatile" | undefined;
      if (adx !== undefined && atr !== undefined) {
        const priceAboveEma = ema ? currentPrice > ema.ema26 : true;
        if (adx > 25 && priceAboveEma) marketRegime = "trending_up";
        else if (adx > 25 && !priceAboveEma) marketRegime = "trending_down";
        else if (adx < 20) marketRegime = "ranging";
        else marketRegime = "volatile";
      }

      const promptData: AIPromptData = {
        symbol: this.symbol,
        exchange: "bybit",
        mode: user.tradingMode,
        currentPrice,
        indicators: {
          rsi,
          macd: {
            line: macd.MACD ?? 0,
            signal: macd.signal ?? 0,
            histogram: macd.histogram ?? 0,
          },
          ema,
          bollingerBands,
          adx,
          atr,
          stochastic,
        },
        recentCandles: this.candleAggregator.getRecentCandles(10),
        recentTradeOutcomes,
        marketRegime,
        spread,
        portfolio,
        openPositions: positions,
        riskProfile: user.riskProfile,
      };

      let decision: AIDecision;
      if (this.engineConfig.enableMultiModelVoting && this.engineConfig.votingModels.length > 1) {
        decision = await getVotedDecision(
          promptData,
          this.openaiApiKey,
          this.engineConfig.votingModels as string[],
          this.engineConfig.aiRetryCount,
        );
      } else {
        decision = await getAIDecision(
          promptData,
          this.openaiApiKey,
          this.engineConfig.aiModel,
          this.engineConfig.aiRetryCount,
        );
      }
      this.lastAIDecision = decision;
      this.callbacks.onAIDecision?.(decision);
      await logger.info("AI", `Decision: ${decision.decision} (confidence: ${decision.confidence})`, { decision });
      alertService.onAIDecision(decision.decision, decision.confidence, decision.reason);

      // [11] HOLD → skip
      if (decision.decision === "HOLD") return;

      // [12] Validate SL/TP contract before proceeding
      if (decision.decision === "BUY") {
        if (decision.stop_loss >= decision.entry || decision.take_profit <= decision.entry) {
          await logger.warn("AI", "AI decision rejected: BUY SL must be below entry, TP must be above entry", { decision });
          return;
        }
      } else if (decision.decision === "SELL") {
        if (decision.stop_loss <= decision.entry || decision.take_profit >= decision.entry) {
          await logger.warn("AI", "AI decision rejected: SELL SL must be above entry, TP must be below entry", { decision });
          return;
        }
      }

      // [12b] Validate entry price is positive and within reasonable range of current price
      if (decision.entry <= 0) {
        await logger.warn("AI", "AI decision rejected: entry price is zero or negative", { decision });
        return;
      }
      const entryDeviation = Math.abs((decision.entry - currentPrice) / currentPrice) * 100;
      if (entryDeviation > 5) {
        await logger.warn("AI", `AI decision rejected: entry price $${decision.entry} deviates ${entryDeviation.toFixed(2)}% from current price $${currentPrice}`, { decision });
        return;
      }

      // [13] 1h price change — calculate from candles with proper time window
      const oneHourAgo = Date.now() - 3600_000;
      const completedCandles = this.candleAggregator.getCandles();
      const oldestCandle = completedCandles[0];
      let priceChange1h = 0;
      if (oldestCandle && oldestCandle.timestamp <= oneHourAgo) {
        // Buffer spans at least 1 hour — find the candle closest to 1h ago
        const candleOneHourAgo = completedCandles.find((c) => c.timestamp >= oneHourAgo);
        const priceOneHourAgo = candleOneHourAgo?.open ?? oldestCandle.close;
        priceChange1h = ((currentPrice - priceOneHourAgo) / priceOneHourAgo) * 100;
      } else if (oldestCandle) {
        // Buffer is shorter than 1 hour — use full buffer range but log it
        const priceAtBufferStart = oldestCandle.open;
        priceChange1h = ((currentPrice - priceAtBufferStart) / priceAtBufferStart) * 100;
        await logger.warn("TRADE", `Volatility window incomplete: buffer spans ${Math.round((Date.now() - oldestCandle.timestamp) / 60_000)}m, not 60m`);
      }

      const dailyRealizedLoss = Math.abs(Math.min(0, this.cachedDailyPnl));

      // Daily loss warning at 80% of limit
      const maxDailyLoss = portfolio.totalBalance * (user.riskProfile.maxDailyLossPct / 100);
      if (dailyRealizedLoss > maxDailyLoss * 0.8) {
        alertService.onDailyLossWarning(dailyRealizedLoss, maxDailyLoss);
      }

      // [14] Position size — use availableBalance, not totalBalance
      const riskAmount = portfolio.availableBalance * (user.riskProfile.maxRiskPct / 100);
      const slDistance = Math.abs(decision.entry - decision.stop_loss);
      if (slDistance <= 0) return;
      const quantity = parseFloat((riskAmount / slDistance).toFixed(6));

      // [15] Risk check with real spread
      const riskOpts: RiskOptions = {
        volatilityThresholdPct: this.engineConfig.volatilityThresholdPct,
        spreadThresholdPct: this.engineConfig.spreadThresholdPct,
        maxDrawdownPct: this.engineConfig.maxDrawdownPct,
      };

      const riskResult = validateTrade({
        decision,
        portfolio,
        openTradeCount,
        dailyRealizedLoss,
        priceChange1h,
        spread,
        peakBalance: safetyService.getState().peakBalance,
        riskProfile: user.riskProfile,
        tradingMode: user.tradingMode,
        intendedQuantity: quantity,
        maxSlippagePct: this.engineConfig.maxSlippagePct,
      }, riskOpts);

      if (!riskResult.approved) {
        await logger.warn("RISK", `Trade rejected: ${riskResult.reasons.join(", ")}`, { riskResult });
        return;
      }

      // [16] Leverage (futures)
      if (user.tradingMode === "futures") {
        await this.exchange.setLeverage(this.symbol, user.riskProfile.maxLeverage);
      }

      // [17] Execute
      let orderResult;
      try {
        orderResult = await this.exchange.placeMarketOrder(this.symbol, decision.decision as "BUY" | "SELL", quantity);
      } catch (orderErr) {
        const errMsg = orderErr instanceof Error ? orderErr.message : String(orderErr);
        await logger.error("TRADE", `FAILED_ORDER: ${decision.decision} ${this.symbol} qty=${quantity} — ${errMsg}`, {
          decision,
          quantity,
          error: errMsg,
          riskResult,
        });
        return;
      }

      // [18] Slippage check — log warning if fill price deviates significantly
      const fillPrice = orderResult.price || decision.entry;
      if (orderResult.price > 0) {
        const slippage = Math.abs((orderResult.price - decision.entry) / decision.entry) * 100;
        if (slippage > this.engineConfig.maxSlippagePct) {
          await logger.warn("TRADE", `High slippage detected: ${slippage.toFixed(3)}% (expected ${decision.entry}, got ${orderResult.price})`, {
            expectedPrice: decision.entry,
            fillPrice: orderResult.price,
            slippagePct: slippage,
          });
        }
      }

      // [19] Record trade
      const tradeDoc = await TradeModel.create({
        userId: this.userId,
        symbol: this.symbol,
        side: decision.decision,
        type: "MARKET",
        entryPrice: fillPrice,
        quantity: orderResult.quantity || quantity,
        status: "OPEN",
        source: "AI",
        exchange: user.selectedExchange,
        mode: user.tradingMode,
        aiDecision: decision,
        riskCheck: riskResult,
      });

      // Update trade cooldown timestamp
      this.lastTradeTimestamp = Date.now();

      await logger.info("TRADE", `Order executed: ${decision.decision} ${this.symbol} qty=${quantity} @ ${fillPrice}`, {
        orderId: orderResult.orderId,
        decision,
        riskResult,
      });
      alertService.onTradeExecuted(this.symbol, decision.decision, quantity, fillPrice);

      // [20] Emit
      this.callbacks.onTradeExecuted?.({
        _id: tradeDoc._id.toString(),
        userId: this.userId,
        symbol: this.symbol,
        side: decision.decision as "BUY" | "SELL",
        type: "MARKET",
        entryPrice: fillPrice,
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

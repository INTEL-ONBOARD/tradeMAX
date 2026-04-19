import { createExchangeService, type ExchangeServiceInstance } from "./exchangeFactory.js";
import { buildLiveMarketSnapshot } from "./marketSnapshotService.js";
import { persistCycleResult, reviewClosedTrade, runAIPipeline } from "./aiPipelineService.js";
import { safetyService } from "./safetyService.js";
import { alertService } from "./alertService.js";
import { logger } from "./loggerService.js";
import { decrypt } from "./encryptionService.js";
import { getUserDoc } from "./authService.js";
import { TradeModel } from "../db/models/Trade.js";
import { AUTO_PAIR_FALLBACKS, selectBestAutoPair, type AutoPairTicker } from "./autoPairSelection.js";
import type {
  AgentCycleResult,
  AgentStatus,
  AIDecision,
  EngineConfig,
  MarketTick,
  PortfolioSnapshot,
  Position,
  RiskResult,
  Trade,
} from "../shared/types.js";

type StreamCallback = {
  onMarketTick?: (tick: MarketTick) => void;
  onPortfolio?: (snap: PortfolioSnapshot) => void;
  onPositions?: (positions: Position[]) => void;
  onTradeExecuted?: (trade: Trade) => void;
  onAIDecision?: (decision: AgentCycleResult) => void;
  onAgentStatus?: (status: AgentStatus) => void;
};

async function fetchBestAutoPair(candidates: string[], mode: "spot" | "futures"): Promise<string | null> {
  const normalizedCandidates = candidates.map((symbol) => symbol.toUpperCase());
  if (normalizedCandidates.length === 0) return null;
  const category = mode === "spot" ? "spot" : "linear";
  const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=${category}`);
  if (!res.ok) throw new Error(`AUTO_PAIR_FETCH_${res.status}`);
  const json = await res.json() as {
    result?: { list?: Array<{ symbol: string; turnover24h?: string; price24hPcnt?: string }> };
  };
  const tickers: AutoPairTicker[] = (json.result?.list ?? []).map((ticker) => ({
    symbol: ticker.symbol,
    turnover24h: parseFloat(ticker.turnover24h || "0") || 0,
    priceChangePct24h: Math.abs((parseFloat(ticker.price24hPcnt || "0") || 0) * 100),
  }));
  return selectBestAutoPair(normalizedCandidates, tickers);
}

export class TradeEngine {
  private userId = "";
  private symbol = "";
  private exchange: ExchangeServiceInstance | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private lastPipelineRun: AgentCycleResult | null = null;
  private callbacks: StreamCallback = {};
  private apiFailures = 0;
  private openaiApiKey: string | undefined = undefined;
  private engineConfig: EngineConfig | null = null;
  private lastTradeTimestamp = 0;
  private lastMarketPrice = 0;
  private trailingStops = new Map<string, number>();
  private currentMode: "spot" | "futures" = "spot";
  private selectedExchange: "bybit" | "paper" = "paper";

  setCallbacks(cb: StreamCallback): void {
    this.callbacks = cb;
  }

  getLastAIDecision(): AgentCycleResult | null {
    return this.lastPipelineRun;
  }

  isRunning(): boolean {
    return this.running;
  }

  getSymbol(): string {
    return this.symbol;
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
    this.engineConfig = user.engineConfig as EngineConfig;
    this.currentMode = user.tradingMode;
    this.selectedExchange = user.selectedExchange;
    this.apiFailures = 0;
    this.lastTradeTimestamp = 0;
    this.trailingStops.clear();

    safetyService.updateConfig({
      maxConsecutiveLosses: this.engineConfig.maxConsecutiveLosses,
      maxDrawdownPct: this.engineConfig.maxDrawdownPct,
    });
    safetyService.setOnFreezeCallback(() => this.emitStatus());

    const isPaper = user.selectedExchange === "paper";
    const userSalt = user.encryptionSalt || undefined;
    const bybitKeys = user.exchangeKeys.bybit;
    if (!isPaper && (!bybitKeys.apiKey || !bybitKeys.apiSecret)) {
      throw new Error("No API keys configured for bybit");
    }
    const apiKey = !isPaper && bybitKeys.apiKey ? decrypt(bybitKeys.apiKey, userSalt) : "";
    const apiSecret = !isPaper && bybitKeys.apiSecret ? decrypt(bybitKeys.apiSecret, userSalt) : "";

    const encryptedAIKey = user.openaiApiKey || user.claudeApiKey;
    this.openaiApiKey = encryptedAIKey ? decrypt(encryptedAIKey, userSalt) : undefined;

    this.exchange = createExchangeService(user.selectedExchange);
    await this.exchange.initialize({ apiKey, apiSecret }, user.tradingMode);

    if (isPaper && "setStartingBalance" in this.exchange) {
      this.exchange.setStartingBalance(this.engineConfig.paperStartingBalance);
    }

    if (this.engineConfig.autoPairSelection) {
      const autoPair = await fetchBestAutoPair(
        this.engineConfig.watchlist.length > 0 ? this.engineConfig.watchlist : [...AUTO_PAIR_FALLBACKS],
        user.tradingMode,
      ).catch(() => null);
      if (autoPair) this.symbol = autoPair;
    }

    this.exchange.startTickerStream(this.symbol, (tick) => {
      this.lastMarketPrice = tick.price;
      this.callbacks.onMarketTick?.(tick);
    }, this.engineConfig.wsReconnectRetries);

    this.running = true;
    this.emitStatus();
    this.scheduleNextCycle();
    await logger.info("TRADE", `Agent started on ${this.symbol} (${user.selectedExchange} ${user.tradingMode})`);
  }

  private scheduleNextCycle(): void {
    if (!this.running || !this.engineConfig) return;
    this.loopTimer = setTimeout(() => void this.cycle(), this.engineConfig.loopIntervalSec * 1000);
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = null;
    this.exchange?.stopTickerStream();
    this.exchange?.destroy();
    this.exchange = null;
    this.running = false;
    this.openaiApiKey = undefined;
    this.emitStatus();
    await logger.info("TRADE", "Agent stopped");
  }

  async killSwitch(): Promise<void> {
    await logger.error("SAFETY", "KILL SWITCH — executing emergency shutdown");
    if (this.exchange) {
      try {
        await this.exchange.cancelAllOrders(this.symbol);
      } catch {}
      try {
        const positions = await this.exchange.getOpenPositions();
        for (const pos of positions) {
          await this.exchange.closePosition(pos.symbol, pos.side, pos.quantity);
        }
      } catch {}
    }
    safetyService.activateKillSwitch();
    await this.stop();
  }

  private async fetchPortfolio(): Promise<PortfolioSnapshot | null> {
    if (!this.exchange) return null;
    try {
      const portfolio = await this.exchange.getBalance();
      this.apiFailures = 0;
      this.callbacks.onPortfolio?.(portfolio);
      safetyService.updatePeakBalance(portfolio.totalBalance);
      return portfolio;
    } catch (error) {
      this.apiFailures += 1;
      alertService.onApiError(this.symbol, this.apiFailures, 3);
      if (this.apiFailures >= 3) safetyService.reportApiFailure();
      await logger.error("TRADE", `Balance fetch failed: ${error}`);
      return null;
    }
  }

  private async fetchPositions(): Promise<Position[]> {
    if (!this.exchange) return [];
    try {
      const positions = await this.exchange.getOpenPositions();
      this.callbacks.onPositions?.(positions);
      return positions;
    } catch (error) {
      await logger.error("TRADE", `Position fetch failed: ${error}`);
      return [];
    }
  }

  private convertPipelineRunToTradeDecision(run: AgentCycleResult): AIDecision {
    return run.finalDecision;
  }

  private async persistCycle(
    cycle: AgentCycleResult,
    executionResult?: {
      tradeId?: string | null;
      filled: boolean;
      blockedReason?: string | null;
      entryPrice?: number | null;
      exitPrice?: number | null;
      pnl?: number | null;
      closedAt?: string | null;
    },
  ): Promise<void> {
    await persistCycleResult({ userId: this.userId, cycle, executionResult });
  }

  private async closeTrade(tradeDoc: any, exitPrice: number, reason: string): Promise<void> {
    const pnl =
      tradeDoc.side === "BUY"
        ? (exitPrice - tradeDoc.entryPrice) * tradeDoc.quantity
        : (tradeDoc.entryPrice - exitPrice) * tradeDoc.quantity;

    tradeDoc.exitPrice = exitPrice;
    tradeDoc.pnl = pnl;
    tradeDoc.status = "CLOSED";
    tradeDoc.closedAt = new Date();
    await tradeDoc.save();
    this.trailingStops.delete(tradeDoc._id.toString());

    if (pnl >= 0) safetyService.recordWin();
    else safetyService.recordLoss();

    const tradeForReview: Trade = {
      _id: tradeDoc._id.toString(),
      userId: tradeDoc.userId.toString(),
      symbol: tradeDoc.symbol,
      side: tradeDoc.side,
      type: tradeDoc.type,
      entryPrice: tradeDoc.entryPrice,
      exitPrice,
      quantity: tradeDoc.quantity,
      pnl,
      status: "CLOSED",
      source: tradeDoc.source,
      exchange: tradeDoc.exchange,
      mode: tradeDoc.mode,
      aiDecision: tradeDoc.aiDecision,
      riskCheck: tradeDoc.riskCheck,
      pipelineRun: tradeDoc.pipelineRun ?? null,
      memoryReferences: tradeDoc.memoryReferences ?? [],
      createdAt: tradeDoc.createdAt.toISOString(),
      closedAt: tradeDoc.closedAt.toISOString(),
    };

    if (this.engineConfig?.reviewModeEnabled) {
      await reviewClosedTrade({
        userId: this.userId,
        trade: tradeForReview,
        openaiApiKey: this.openaiApiKey,
        model: this.engineConfig?.stageModels.postTradeReviewer,
      });
    }

    alertService.onPositionClosed(tradeDoc.symbol, reason, pnl);
    this.callbacks.onTradeExecuted?.(tradeForReview);
  }

  private async manageOpenTrades(currentPrice: number): Promise<void> {
    if (!(currentPrice > 0)) {
      return;
    }

    const openTrades = await TradeModel.find({ userId: this.userId, status: "OPEN" });

    for (const tradeDoc of openTrades) {
      const pipelineRun = tradeDoc.pipelineRun as AgentCycleResult | null;
      if (!pipelineRun) continue;

      const review = pipelineRun.executionReview;
      let effectiveStop = review.stopLoss;

      if (review.trailingStopPct && currentPrice > 0) {
        const tradeId = tradeDoc._id.toString();
        const best = this.trailingStops.get(tradeId) ?? tradeDoc.entryPrice;
        const updatedBest = tradeDoc.side === "BUY" ? Math.max(best, currentPrice) : Math.min(best, currentPrice);
        this.trailingStops.set(tradeId, updatedBest);
        effectiveStop =
          tradeDoc.side === "BUY"
            ? Math.max(review.stopLoss, updatedBest * (1 - review.trailingStopPct / 100))
            : Math.min(review.stopLoss, updatedBest * (1 + review.trailingStopPct / 100));
      }

      const maxHoldDeadline = new Date(tradeDoc.createdAt).getTime() + review.maxHoldMinutes * 60_000;
      const timeExit = Date.now() >= maxHoldDeadline;
      const hitStop = tradeDoc.side === "BUY" ? currentPrice <= effectiveStop : currentPrice >= effectiveStop;
      const hitTarget = tradeDoc.side === "BUY" ? currentPrice >= review.takeProfit : currentPrice <= review.takeProfit;

      if (!(hitStop || hitTarget || timeExit)) continue;

      try {
        if (!this.exchange) throw new Error("Exchange unavailable during close");
        const closeResult = await this.exchange.closePosition(tradeDoc.symbol, tradeDoc.side, tradeDoc.quantity);
        const exitPrice = closeResult?.price || currentPrice;
        await this.closeTrade(tradeDoc, exitPrice, hitStop ? "STOP_LOSS" : hitTarget ? "TAKE_PROFIT" : "TIME_EXIT");
      } catch (error) {
        await logger.error("TRADE", `Failed to close position: ${error}`);
      }
    }
  }

  private async cycle(): Promise<void> {
    if (!this.running || !this.exchange || !this.engineConfig) return;

    try {
      if (!safetyService.canTrade()) return;

      const portfolio = await this.fetchPortfolio();
      if (!portfolio || !safetyService.checkDrawdown(portfolio.totalBalance)) {
        this.emitStatus();
        return;
      }

      const positions = await this.fetchPositions();
      const currentPrice = this.lastMarketPrice || positions[0]?.markPrice || 0;
      if (currentPrice > 0) {
        await this.manageOpenTrades(currentPrice);
      } else {
        await logger.warn("TRADE", "Skipping open-trade management because live price is unavailable", {
          symbol: this.symbol,
        });
      }

      const cooldownMs = this.engineConfig.tradeCooldownSec * 1000;
      if (cooldownMs > 0 && Date.now() - this.lastTradeTimestamp < cooldownMs) return;

      const snapshot = await buildLiveMarketSnapshot({
        symbol: this.symbol,
        mode: this.currentMode,
        portfolio,
        openPositions: positions,
        engineConfig: this.engineConfig,
      });

      if (!snapshot.integrity.isDataComplete) {
        await logger.warn("TRADE", "Skipping cycle because market snapshot is incomplete", { warnings: snapshot.integrity.warnings });
        return;
      }

      const cycle = await runAIPipeline({
        userId: this.userId,
        snapshot,
        engineConfig: this.engineConfig,
        openaiApiKey: this.openaiApiKey,
      });
      this.lastPipelineRun = cycle;
      this.callbacks.onAIDecision?.(cycle);
      const decision = this.convertPipelineRunToTradeDecision(cycle);
      alertService.onAIDecision(decision.decision, decision.confidence, decision.reason);

      if (cycle.status !== "READY") {
        await this.persistCycle(cycle);
        return;
      }

      if (this.engineConfig.shadowModeEnabled) {
        await logger.info("AI", `Shadow mode verdict: ${decision.decision}`, { cycleId: cycle.cycleId, rationale: decision.reason });
        await this.persistCycle(cycle, { tradeId: null, filled: false, blockedReason: "SHADOW_MODE" });
        return;
      }

      if (!decision.entry || !decision.stop_loss || !decision.take_profit) {
        await logger.warn("AI", "Emergency floor rejected malformed execution numbers", { cycleId: cycle.cycleId });
        await this.persistCycle(cycle, { tradeId: null, filled: false, blockedReason: "MALFORMED_EXECUTION" });
        return;
      }

      const entryDeviation = snapshot.currentPrice > 0
        ? Math.abs((decision.entry - snapshot.currentPrice) / snapshot.currentPrice) * 100
        : 0;
      if (entryDeviation > 3) {
        await logger.warn("AI", "Emergency floor rejected excessive entry deviation", { entryDeviation, cycleId: cycle.cycleId });
        await this.persistCycle(cycle, { tradeId: null, filled: false, blockedReason: "ENTRY_DEVIATION" });
        return;
      }

      const sizeUsd = cycle.executionReview.adjustedSizeUsd;
      const leverage = Math.min(cycle.executionReview.adjustedLeverage, this.engineConfig.maxDrawdownPct > 0 ? 25 : 10, 20);
      const maxSafeNotional = Math.max(0, portfolio.availableBalance * leverage);
      if (sizeUsd <= 0 || sizeUsd > maxSafeNotional) {
        await logger.warn("AI", "Emergency floor rejected unsafe notional", { sizeUsd, maxSafeNotional, cycleId: cycle.cycleId });
        await this.persistCycle(cycle, { tradeId: null, filled: false, blockedReason: "UNSAFE_NOTIONAL" });
        return;
      }

      const quantity = Number((sizeUsd / Math.max(snapshot.currentPrice, 1)).toFixed(6));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        await logger.warn("AI", "Emergency floor rejected non-finite quantity", { quantity, cycleId: cycle.cycleId });
        await this.persistCycle(cycle, { tradeId: null, filled: false, blockedReason: "INVALID_QUANTITY" });
        return;
      }

      if (this.currentMode === "futures") {
        await this.exchange.setLeverage(this.symbol, leverage);
      }

      const orderResult = await this.exchange.placeMarketOrder(this.symbol, decision.decision as "BUY" | "SELL", quantity);
      const fillPrice = orderResult.price || snapshot.currentPrice;
      const slippagePct = decision.entry > 0 ? Math.abs((fillPrice - decision.entry) / decision.entry) * 100 : 0;
      if (slippagePct > this.engineConfig.maxSlippagePct) {
        await logger.warn("TRADE", `High slippage detected: ${slippagePct.toFixed(3)}%`, { cycleId: cycle.cycleId });
      }

      const tradeDoc = await TradeModel.create({
        userId: this.userId,
        symbol: this.symbol,
        side: decision.decision,
        type: "MARKET",
        entryPrice: fillPrice,
        quantity: orderResult.quantity || quantity,
        status: "OPEN",
        source: "AI",
        exchange: this.selectedExchange,
        mode: this.currentMode,
        aiDecision: decision,
        riskCheck: {
          approved: true,
          passed: ["PIPELINE_READY", "EMERGENCY_FLOORS_PASSED"],
          failed: [],
          reasons: [],
        },
        pipelineRun: cycle,
        memoryReferences: cycle.retrievedMemories.map((item) => item.id),
      });

      await this.persistCycle(cycle, {
        tradeId: tradeDoc._id.toString(),
        filled: true,
        entryPrice: fillPrice,
      });

      this.lastTradeTimestamp = Date.now();

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
        exchange: this.selectedExchange,
        mode: this.currentMode,
        aiDecision: decision,
        riskCheck: tradeDoc.riskCheck as RiskResult | null,
        pipelineRun: cycle,
        memoryReferences: cycle.retrievedMemories.map((item) => item.id),
        createdAt: tradeDoc.createdAt.toISOString(),
        closedAt: null,
      });
      await logger.info("TRADE", `Order executed: ${decision.decision} ${this.symbol}`, { cycleId: cycle.cycleId, quantity, fillPrice });
    } catch (error) {
      await logger.error("TRADE", `Cycle error: ${error}`);
    } finally {
      this.scheduleNextCycle();
    }
  }

  private emitStatus(): void {
    this.callbacks.onAgentStatus?.(this.getStatus());
  }
}

export const tradeEngine = new TradeEngine();

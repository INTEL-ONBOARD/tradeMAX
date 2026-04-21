import { createExchangeService, type ExchangeServiceInstance } from "./exchangeFactory.js";
import { buildExecutionValidation } from "./executionValidationService.js";
import { buildManagedPositions } from "./managedPositionService.js";
import { buildLiveMarketSnapshot } from "./marketSnapshotService.js";
import { rankCandidateSymbols, pickTrackedSymbols } from "./portfolioSelectionService.js";
import { persistCycleResult, reviewClosedTrade, runAIPipeline } from "./aiPipelineService.js";
import { safetyService } from "./safetyService.js";
import { alertService } from "./alertService.js";
import { logger } from "./loggerService.js";
import { decrypt } from "./encryptionService.js";
import { getUserDoc } from "./authService.js";
import { notificationService } from "./notificationService.js";
import { TradeModel, type ITrade } from "../db/models/Trade.js";
import type {
  AgentCycleResult,
  AgentStatus,
  AIDecision,
  EngineConfig,
  ExchangeSymbolMetadata,
  MarketTick,
  PortfolioSnapshot,
  Position,
  RiskProfile,
  RiskResult,
  SymbolSelectionEntry,
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

type ManagedTradeDoc = ITrade & {
  _id: { toString(): string };
  save: () => Promise<ManagedTradeDoc>;
};

function normalizeSymbols(symbols: string[]): string[] {
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
}

async function validateConfiguredModels(apiKey: string, modelIds: string[]): Promise<void> {
  const uniqueModels = [...new Set(modelIds.filter(Boolean))];
  if (uniqueModels.length === 0) {
    throw new Error("No AI models configured for the trading pipeline");
  }

  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`OpenAI model catalog check failed (${response.status})`);
  }

  const payload = await response.json() as { data?: Array<{ id: string }> };
  const available = new Set((payload.data ?? []).map((entry) => entry.id));
  const missing = uniqueModels.filter((model) => !available.has(model));
  if (missing.length > 0) {
    throw new Error(`Configured AI models unavailable: ${missing.join(", ")}`);
  }
}

function resolveConfiguredSymbols(engineConfig: EngineConfig, requestedSymbol: string): string[] {
  const requested = requestedSymbol.trim().toUpperCase();
  if (!engineConfig.autoPairSelection) {
    return [requested];
  }

  if (!engineConfig.restrictAutoPairSelectionToShortlist) {
    return [requested];
  }

  return normalizeSymbols([
    requested,
    ...(engineConfig.candidateSymbols ?? []),
    ...(engineConfig.watchlist ?? []),
  ]);
}

function toStartOfDay(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildPositionKey(symbol: string, side: "BUY" | "SELL"): string {
  return `${symbol.toUpperCase()}:${side}`;
}

function computeLiquidationDistancePct(position: Position): number | null {
  if (!(position.markPrice > 0) || !(position.liquidationPrice && position.liquidationPrice > 0)) return null;

  if (position.side === "BUY") {
    if (position.liquidationPrice >= position.markPrice) return 0;
    return ((position.markPrice - position.liquidationPrice) / position.markPrice) * 100;
  }

  if (position.liquidationPrice <= position.markPrice) return 0;
  return ((position.liquidationPrice - position.markPrice) / position.markPrice) * 100;
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
  private riskProfile: RiskProfile | null = null;
  private latestPrices = new Map<string, number>();
  private trailingStops = new Map<string, number>();
  private lastTradeTimestampBySymbol = new Map<string, number>();
  private lastExitTimestampBySymbol = new Map<string, number>();
  private trackedSymbols: string[] = [];
  private leaderboard: SymbolSelectionEntry[] = [];
  private symbolMetadata = new Map<string, ExchangeSymbolMetadata>();
  private currentMode: "spot" | "futures" = "spot";
  private selectedExchange: "bybit" | "paper" = "paper";
  private streamedSymbol = "";
  private suppressStopNotification = false;
  private liquidationRiskBandByPosition = new Map<string, number>();
  private liquidationDistanceByPosition = new Map<string, number>();
  private missingPositionCyclesByTrade = new Map<string, number>();
  private lastExecutionBlockedNotifiedAt = new Map<string, number>();
  private lastOrderFailureNotifiedAt = new Map<string, number>();
  private lastSizingAnomalyNotifiedAt = new Map<string, number>();

  setCallbacks(cb: StreamCallback): void {
    this.callbacks = cb;
  }

  clearCallbacks(): void {
    this.callbacks = {};
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
      activeSymbols: [...this.trackedSymbols],
      leaderboard: [...this.leaderboard],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  private async ensureSymbolMetadata(symbols: string[]): Promise<void> {
    if (!this.exchange) return;
    const normalized = normalizeSymbols(symbols);
    const missing = normalized.filter((symbol) => !this.symbolMetadata.has(symbol));
    if (missing.length === 0) return;

    const rows = await this.exchange.getSymbolMetadata(missing);
    for (const metadata of rows) {
      this.symbolMetadata.set(metadata.symbol, metadata);
    }
  }

  async start(userId: string, symbol: string): Promise<void> {
    if (this.running) return;

    const safety = safetyService.getState();
    if (safety.frozen || safety.emergencyShutdown) {
      throw new Error(`Trading is frozen. Reset the safety state before restarting (${safety.frozenReason ?? "UNKNOWN"}).`);
    }

    const user = await getUserDoc(userId);
    this.userId = userId;
    this.symbol = symbol.toUpperCase();
    this.engineConfig = user.engineConfig as EngineConfig;
    this.riskProfile = user.riskProfile as RiskProfile;
    this.currentMode = user.tradingMode;
    this.selectedExchange = user.selectedExchange;
    this.apiFailures = 0;
    this.trailingStops.clear();
    this.latestPrices.clear();
    this.lastTradeTimestampBySymbol.clear();
    this.lastExitTimestampBySymbol.clear();
    this.leaderboard = [];
    this.trackedSymbols = [];
    this.symbolMetadata.clear();
    this.liquidationRiskBandByPosition.clear();
    this.liquidationDistanceByPosition.clear();
    this.missingPositionCyclesByTrade.clear();
    this.lastExecutionBlockedNotifiedAt.clear();
    this.lastOrderFailureNotifiedAt.clear();
    this.lastSizingAnomalyNotifiedAt.clear();

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
    if (!encryptedAIKey) {
      throw new Error("No OpenAI API key configured");
    }
    this.openaiApiKey = decrypt(encryptedAIKey, userSalt);

    await validateConfiguredModels(this.openaiApiKey, [
      this.engineConfig.aiModel,
      this.engineConfig.stageModels.marketAnalyst || this.engineConfig.aiModel,
      this.engineConfig.stageModels.tradeArchitect || this.engineConfig.aiModel,
      this.engineConfig.stageModels.executionCritic || this.engineConfig.aiModel,
      this.engineConfig.stageModels.postTradeReviewer || this.engineConfig.aiModel,
      ...(this.engineConfig.enableMultiModelVoting ? this.engineConfig.votingModels : []),
    ]);

    this.exchange = createExchangeService(user.selectedExchange);
    await this.exchange.initialize({ apiKey, apiSecret }, user.tradingMode);

    if (isPaper && "setStartingBalance" in this.exchange) {
      this.exchange.setStartingBalance(this.engineConfig.paperStartingBalance);
    }

    this.leaderboard = await rankCandidateSymbols({
      userId: this.userId,
      mode: this.currentMode,
      engineConfig: this.engineConfig,
      requestedSymbol: this.symbol,
    });
    this.trackedSymbols = pickTrackedSymbols({
      leaderboard: this.leaderboard,
      openTradeSymbols: [],
      maxConcurrentSymbols: this.engineConfig.maxConcurrentSymbols,
    });
    await this.ensureSymbolMetadata(this.trackedSymbols.length > 0 ? this.trackedSymbols : resolveConfiguredSymbols(this.engineConfig, this.symbol));
    if (this.symbolMetadata.size === 0) {
      throw new Error("No exchange symbol metadata available for the configured trading universe");
    }
    this.symbol = this.leaderboard[0]?.symbol ?? this.trackedSymbols[0] ?? this.symbol;

    this.startMarketStream(this.symbol);

    this.running = true;
    this.emitStatus();
    this.scheduleNextCycle();
    await logger.info(
      "TRADE",
      `Agent started on ${this.symbol} (${user.selectedExchange} ${user.tradingMode}) with ${this.trackedSymbols.length} tracked symbols`,
    );
    notificationService.notify({
      type: "system",
      title: "Agent started",
      message: `${this.symbol} is now running in ${user.selectedExchange} ${user.tradingMode} mode`,
    });
  }

  private startMarketStream(symbol: string): void {
    if (!this.exchange || !this.engineConfig || !symbol) return;
    if (this.streamedSymbol === symbol) return;

    this.streamedSymbol = symbol;
    this.exchange.startTickerStream(
      symbol,
      (tick) => {
        this.latestPrices.set(tick.symbol.toUpperCase(), tick.price);
        if (tick.symbol.toUpperCase() === this.symbol) {
          this.callbacks.onMarketTick?.(tick);
        }
      },
      this.engineConfig.wsReconnectRetries,
    );
  }

  private scheduleNextCycle(): void {
    if (!this.running || !this.engineConfig) return;
    this.loopTimer = setTimeout(() => void this.cycle(), this.engineConfig.loopIntervalSec * 1000);
  }

  async stop(): Promise<void> {
    const wasActive = this.running || this.exchange !== null || this.loopTimer !== null;
    if (!wasActive) return;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = null;
    this.exchange?.stopTickerStream();
    this.exchange?.destroy();
    this.exchange = null;
    this.running = false;
    this.streamedSymbol = "";
    this.openaiApiKey = undefined;
    this.trackedSymbols = [];
    this.leaderboard = [];
    this.liquidationRiskBandByPosition.clear();
    this.liquidationDistanceByPosition.clear();
    this.missingPositionCyclesByTrade.clear();
    this.lastExecutionBlockedNotifiedAt.clear();
    this.lastOrderFailureNotifiedAt.clear();
    this.lastSizingAnomalyNotifiedAt.clear();
    this.emitStatus();
    if (wasActive) {
      await logger.info("TRADE", "Agent stopped");
      if (!this.suppressStopNotification) {
        notificationService.notify({
          type: "system",
          title: "Agent stopped",
          message: "Trading automation has been paused.",
          desktop: "never",
        });
      }
    }
    this.suppressStopNotification = false;
  }

  async killSwitch(): Promise<void> {
    await logger.error("SAFETY", "KILL SWITCH — executing emergency shutdown");
    notificationService.notify({
      type: "risk",
      title: "Kill switch activated",
      message: "Emergency shutdown triggered. Open positions are being closed.",
    });
    const openTrades = await this.fetchManagedOpenTrades();
    if (this.exchange) {
      try {
        await this.exchange.cancelAllOrders(this.symbol);
      } catch {}
      for (const tradeDoc of openTrades) {
        try {
          const closeResult = await this.exchange.closePosition(tradeDoc.symbol, tradeDoc.side, tradeDoc.quantity);
          const exitPrice = closeResult.price || this.latestPrices.get(tradeDoc.symbol.toUpperCase()) || tradeDoc.entryPrice;
          await this.closeTrade(tradeDoc, exitPrice, "KILL_SWITCH");
        } catch {}
      }
    }
    safetyService.activateKillSwitch();
    this.suppressStopNotification = true;
    await this.stop();
  }

  private async fetchManagedOpenTrades(): Promise<ManagedTradeDoc[]> {
    return (await TradeModel.find({ userId: this.userId, status: "OPEN" }).sort({ createdAt: 1 })) as ManagedTradeDoc[];
  }

  private async fetchDailyRealizedLoss(): Promise<number> {
    const closedTrades = (await TradeModel.find({
      userId: this.userId,
      status: "CLOSED",
      closedAt: { $gte: toStartOfDay() },
    })
      .select({ pnl: 1 })
      .lean()) as Array<{ pnl?: number | null }>;

    return closedTrades.reduce((sum, trade) => sum + ((trade.pnl ?? 0) < 0 ? Math.abs(trade.pnl ?? 0) : 0), 0);
  }

  private async fetchPortfolio(): Promise<PortfolioSnapshot | null> {
    if (!this.exchange) return null;
    try {
      const portfolio = await this.exchange.getBalance();
      if (this.apiFailures > 0) {
        notificationService.notify({
          type: "system",
          title: "Exchange connection restored",
          message: `${this.selectedExchange} balance and account sync recovered.`,
          desktop: "never",
        });
      }
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

  private async fetchPositions(openTrades: ManagedTradeDoc[]): Promise<Position[]> {
    if (!this.exchange) return [];
    try {
      if (this.selectedExchange === "bybit" && this.currentMode === "spot") {
        const positions = buildManagedPositions({
          openTrades: openTrades.map((trade) => ({
            symbol: trade.symbol,
            side: trade.side,
            entryPrice: trade.entryPrice,
            quantity: trade.quantity,
          })),
          latestPrices: this.latestPrices,
        });
        this.callbacks.onPositions?.(positions);
        return positions;
      }

      const positions = await this.exchange.getOpenPositions();
      this.callbacks.onPositions?.(positions);
      return positions;
    } catch (error) {
      await logger.error("TRADE", `Position fetch failed: ${error}`);
      return [];
    }
  }

  private notifyExecutionBlocked(symbol: string, reason: string): void {
    const key = `${symbol.toUpperCase()}:${reason}`;
    const now = Date.now();
    const lastSent = this.lastExecutionBlockedNotifiedAt.get(key) ?? 0;
    if (now - lastSent < 90_000) return;
    this.lastExecutionBlockedNotifiedAt.set(key, now);
    alertService.onExecutionBlocked(symbol.toUpperCase(), reason);
  }

  private notifyOrderFailure(symbol: string, side: "BUY" | "SELL", reason: string): void {
    const cleanReason = reason.trim() || "Unknown execution error";
    const key = `${symbol.toUpperCase()}:${side}:${cleanReason}`;
    const now = Date.now();
    const lastSent = this.lastOrderFailureNotifiedAt.get(key) ?? 0;
    if (now - lastSent < 90_000) return;
    this.lastOrderFailureNotifiedAt.set(key, now);
    alertService.onOrderExecutionFailed(symbol.toUpperCase(), side, cleanReason);
  }

  private notifySizingAnomaly(symbol: string, side: "BUY" | "SELL", requestedQty: number, filledQty: number): void {
    if (!(requestedQty > 0) || !(filledQty > 0)) return;
    const deltaPct = Math.abs((filledQty - requestedQty) / requestedQty) * 100;
    if (deltaPct < 2) return;

    const key = `${symbol.toUpperCase()}:${side}`;
    const now = Date.now();
    const lastSent = this.lastSizingAnomalyNotifiedAt.get(key) ?? 0;
    if (now - lastSent < 90_000) return;
    this.lastSizingAnomalyNotifiedAt.set(key, now);
    alertService.onPositionSizingAnomaly(symbol.toUpperCase(), side, requestedQty, filledQty, deltaPct);
  }

  private monitorLiquidationRisk(positions: Position[]): void {
    if (this.currentMode !== "futures") return;

    const activeKeys = new Set<string>();
    for (const position of positions) {
      const key = buildPositionKey(position.symbol, position.side);
      activeKeys.add(key);

      const distancePct = computeLiquidationDistancePct(position);
      if (distancePct === null) {
        this.liquidationRiskBandByPosition.delete(key);
        this.liquidationDistanceByPosition.delete(key);
        continue;
      }

      this.liquidationDistanceByPosition.set(key, distancePct);
      const currentBand = distancePct <= 2 ? 3 : distancePct <= 5 ? 2 : distancePct <= 10 ? 1 : 0;
      const previousBand = this.liquidationRiskBandByPosition.get(key) ?? 0;
      this.liquidationRiskBandByPosition.set(key, currentBand);

      if (currentBand <= previousBand || currentBand === 0) continue;
      const severity = currentBand >= 3 ? "critical" : currentBand === 2 ? "high" : "elevated";
      alertService.onLiquidationRisk(position.symbol, position.side, distancePct, severity);
    }

    for (const key of [...this.liquidationRiskBandByPosition.keys()]) {
      if (activeKeys.has(key)) continue;
      this.liquidationRiskBandByPosition.delete(key);
      this.liquidationDistanceByPosition.delete(key);
    }
  }

  private async reconcileMissingExchangePositions(openTrades: ManagedTradeDoc[], positions: Position[]): Promise<void> {
    if (this.selectedExchange !== "bybit" || this.currentMode !== "futures") return;

    const activePositionKeys = new Set(
      positions
        .filter((position) => position.quantity > 0)
        .map((position) => buildPositionKey(position.symbol, position.side)),
    );

    for (const tradeDoc of openTrades) {
      const tradeId = tradeDoc._id.toString();
      const positionKey = buildPositionKey(tradeDoc.symbol, tradeDoc.side);
      if (activePositionKeys.has(positionKey)) {
        this.missingPositionCyclesByTrade.delete(tradeId);
        continue;
      }

      const missingCycles = (this.missingPositionCyclesByTrade.get(tradeId) ?? 0) + 1;
      this.missingPositionCyclesByTrade.set(tradeId, missingCycles);
      if (missingCycles < 2) continue;

      this.missingPositionCyclesByTrade.delete(tradeId);
      const recentDistance = this.liquidationDistanceByPosition.get(positionKey);
      const likelyLiquidation = typeof recentDistance === "number" && recentDistance <= 2;
      if (likelyLiquidation) {
        alertService.onPossibleLiquidation(tradeDoc.symbol, tradeDoc.side);
      }

      try {
        const fallbackExit = this.latestPrices.get(tradeDoc.symbol.toUpperCase()) ?? tradeDoc.entryPrice;
        await logger.warn("TRADE", "Open trade missing from exchange position feed; closing local record", {
          symbol: tradeDoc.symbol,
          side: tradeDoc.side,
          likelyLiquidation,
        });
        await this.closeTrade(
          tradeDoc,
          fallbackExit,
          likelyLiquidation ? "SUSPECTED_LIQUIDATION" : "EXCHANGE_SYNC_CLOSE",
        );
      } catch (error) {
        await logger.error("TRADE", `Failed to reconcile missing exchange position: ${error}`);
      }
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
      portfolioSlot?: number | null;
      symbolSelection?: SymbolSelectionEntry | null;
      riskCheck?: RiskResult | null;
    },
  ): Promise<void> {
    await persistCycleResult({ userId: this.userId, cycle, executionResult });
  }

  private async closeTrade(tradeDoc: ManagedTradeDoc, exitPrice: number, reason: string): Promise<void> {
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
    this.lastExitTimestampBySymbol.set(tradeDoc.symbol.toUpperCase(), Date.now());

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
      aiDecision: (tradeDoc.aiDecision ?? null) as AIDecision | null,
      riskCheck: (tradeDoc.riskCheck ?? null) as RiskResult | null,
      pipelineRun: (tradeDoc.pipelineRun ?? null) as AgentCycleResult | null,
      memoryReferences: tradeDoc.memoryReferences ?? [],
      portfolioSlot: tradeDoc.portfolioSlot ?? null,
      selectionRationale: (tradeDoc.selectionRationale ?? null) as SymbolSelectionEntry | null,
      createdAt: tradeDoc.createdAt.toISOString(),
      closedAt: tradeDoc.closedAt.toISOString(),
    };

    if (this.engineConfig?.reviewModeEnabled) {
      await reviewClosedTrade({
        userId: this.userId,
        trade: tradeForReview,
        openaiApiKey: this.openaiApiKey,
        model: this.engineConfig?.stageModels.postTradeReviewer || this.engineConfig?.aiModel,
      });
    }

    alertService.onPositionClosed(tradeDoc.symbol, reason, pnl);
    this.callbacks.onTradeExecuted?.(tradeForReview);
  }

  private async manageOpenTrades(openTrades: ManagedTradeDoc[], priceBySymbol: Map<string, number>): Promise<void> {
    for (const tradeDoc of openTrades) {
      const currentPrice = priceBySymbol.get(tradeDoc.symbol.toUpperCase()) ?? this.latestPrices.get(tradeDoc.symbol.toUpperCase()) ?? 0;
      if (!(currentPrice > 0)) continue;

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

  private isSymbolOnCooldown(symbol: string): boolean {
    if (!this.engineConfig) return false;
    const lastExit = this.lastExitTimestampBySymbol.get(symbol.toUpperCase()) ?? 0;
    if (lastExit <= 0) return false;
    return Date.now() - lastExit < this.engineConfig.symbolReentryCooldownSec * 1000;
  }

  private isTradeOnCooldown(symbol: string): boolean {
    if (!this.engineConfig) return false;
    const lastTradeAt = this.lastTradeTimestampBySymbol.get(symbol.toUpperCase()) ?? 0;
    if (lastTradeAt <= 0) return false;
    return Date.now() - lastTradeAt < this.engineConfig.tradeCooldownSec * 1000;
  }

  private async refreshLeaderboard(openTradeSymbols: string[]): Promise<void> {
    if (!this.engineConfig) return;

    this.leaderboard = await rankCandidateSymbols({
      userId: this.userId,
      mode: this.currentMode,
      engineConfig: this.engineConfig,
      requestedSymbol: this.symbol,
    });
    this.trackedSymbols = pickTrackedSymbols({
      leaderboard: this.leaderboard,
      openTradeSymbols,
      maxConcurrentSymbols: this.engineConfig.maxConcurrentSymbols,
    });
    await this.ensureSymbolMetadata(this.trackedSymbols);

    if (this.leaderboard[0]?.symbol) {
      this.symbol = this.leaderboard[0].symbol;
      this.startMarketStream(this.symbol);
    }
  }

  private emitStatus(): void {
    this.callbacks.onAgentStatus?.(this.getStatus());
  }

  private async cycle(): Promise<void> {
    if (!this.running || !this.exchange || !this.engineConfig || !this.riskProfile) return;

    try {
      if (!safetyService.canTrade()) {
        this.emitStatus();
        return;
      }

      const portfolio = await this.fetchPortfolio();
      if (!portfolio || !safetyService.checkDrawdown(portfolio.totalBalance)) {
        this.emitStatus();
        return;
      }

      let openTrades = await this.fetchManagedOpenTrades();
      const positions = await this.fetchPositions(openTrades);
      this.monitorLiquidationRisk(positions);
      await this.reconcileMissingExchangePositions(openTrades, positions);
      openTrades = await this.fetchManagedOpenTrades();
      await this.refreshLeaderboard(openTrades.map((trade) => trade.symbol.toUpperCase()));

      const symbolSnapshots = new Map<string, Awaited<ReturnType<typeof buildLiveMarketSnapshot>>>();
      for (const symbol of this.trackedSymbols) {
        const snapshot = await buildLiveMarketSnapshot({
          symbol,
          mode: this.currentMode,
          portfolio,
          openPositions: positions,
          engineConfig: this.engineConfig,
        }).catch(() => null);
        if (!snapshot) continue;

        symbolSnapshots.set(symbol.toUpperCase(), snapshot);
        this.latestPrices.set(symbol.toUpperCase(), snapshot.currentPrice);
      }

      await this.manageOpenTrades(openTrades, this.latestPrices);
      openTrades = await this.fetchManagedOpenTrades();
      const dailyRealizedLoss = await this.fetchDailyRealizedLoss();
      const dailyLossLimit = portfolio.totalBalance * (this.riskProfile.maxDailyLossPct / 100);
      if (dailyLossLimit > 0 && dailyRealizedLoss >= dailyLossLimit * 0.8) {
        alertService.onDailyLossWarning(dailyRealizedLoss, dailyLossLimit);
      }
      let openTradeCount = openTrades.length;

      for (const selection of this.leaderboard) {
        if (!selection.eligible) continue;
        if (openTradeCount >= Math.min(this.riskProfile.maxOpenPositions, this.engineConfig.maxConcurrentSymbols)) {
          break;
        }

        const symbol = selection.symbol.toUpperCase();
        const snapshot = symbolSnapshots.get(symbol);
        if (!snapshot || !snapshot.integrity.isDataComplete) continue;
        if (openTrades.some((trade) => trade.symbol.toUpperCase() === symbol)) continue;
        if (this.isTradeOnCooldown(symbol) || this.isSymbolOnCooldown(symbol)) continue;

        const cycle = await runAIPipeline({
          userId: this.userId,
          snapshot,
          engineConfig: this.engineConfig,
          openaiApiKey: this.openaiApiKey,
        });
        this.lastPipelineRun = cycle;
        this.callbacks.onAIDecision?.(cycle);

        const decision = this.convertPipelineRunToTradeDecision(cycle);
        alertService.onAIDecision(decision.decision, decision.confidence, `${symbol}: ${decision.reason}`);

        if (cycle.status !== "READY") {
          await this.persistCycle(cycle, {
            filled: false,
            blockedReason: cycle.holdReason ?? "PIPELINE_HOLD",
            symbolSelection: selection,
          });
          continue;
        }

        if (this.engineConfig.shadowModeEnabled) {
          await logger.info("AI", `Shadow mode verdict: ${decision.decision}`, { cycleId: cycle.cycleId, rationale: decision.reason, symbol });
          await this.persistCycle(cycle, { tradeId: null, filled: false, blockedReason: "SHADOW_MODE", symbolSelection: selection });
          continue;
        }

        if (decision.decision !== "BUY" && decision.decision !== "SELL") {
          await this.persistCycle(cycle, {
            tradeId: null,
            filled: false,
            blockedReason: "HOLD_DECISION",
            symbolSelection: selection,
          });
          continue;
        }

        const validation = buildExecutionValidation({
          decision,
          snapshot,
          riskProfile: this.riskProfile,
          engineConfig: this.engineConfig,
          desiredSizeUsd: cycle.executionReview.adjustedSizeUsd,
          requestedLeverage: cycle.executionReview.adjustedLeverage,
          desiredTrailingStopPct: cycle.executionReview.trailingStopPct,
          metadata: this.symbolMetadata.get(symbol) ?? null,
          openTradeCount,
          openTradesForSymbol: openTrades.filter((trade) => trade.symbol.toUpperCase() === symbol).length,
          dailyRealizedLoss,
          peakBalance: safetyService.getState().peakBalance,
          selection,
        });

        if (!validation.approved) {
          this.notifyExecutionBlocked(symbol, validation.blockedReason ?? "Risk conditions not satisfied");
          await this.persistCycle(cycle, {
            tradeId: null,
            filled: false,
            blockedReason: validation.blockedReason,
            symbolSelection: selection,
            riskCheck: validation.riskCheck,
          });
          continue;
        }

        const side = decision.decision;

        try {
          if (this.currentMode === "futures") {
            await this.exchange.setLeverage(symbol, validation.leverage);
          }

          const orderResult = await this.exchange.placeMarketOrder(symbol, side, validation.quantity);
          this.notifySizingAnomaly(
            symbol,
            side,
            validation.quantity,
            orderResult.quantity || validation.quantity,
          );
          const fillPrice = orderResult.price || snapshot.currentPrice;
          const slippagePct = decision.entry > 0 ? Math.abs((fillPrice - decision.entry) / decision.entry) * 100 : 0;
          if (slippagePct > this.engineConfig.maxSlippagePct) {
            await logger.warn("TRADE", `High slippage detected: ${slippagePct.toFixed(3)}%`, { cycleId: cycle.cycleId, symbol });
          }

          const portfolioSlot = openTradeCount + 1;
          const tradeDoc = (await TradeModel.create({
            userId: this.userId,
            symbol,
            side,
            type: "MARKET",
            entryPrice: fillPrice,
            quantity: orderResult.quantity || validation.quantity,
            status: "OPEN",
            source: "AI",
            exchange: this.selectedExchange,
            mode: this.currentMode,
            aiDecision: decision,
            riskCheck: validation.riskCheck,
            pipelineRun: cycle,
            memoryReferences: cycle.retrievedMemories.map((item) => item.id),
            portfolioSlot,
            selectionRationale: selection,
          })) as ManagedTradeDoc;

          await this.persistCycle(cycle, {
            tradeId: tradeDoc._id.toString(),
            filled: true,
            entryPrice: fillPrice,
            portfolioSlot,
            symbolSelection: selection,
            riskCheck: validation.riskCheck,
          });

          this.lastTradeTimestampBySymbol.set(symbol, Date.now());
          openTradeCount += 1;

          this.callbacks.onTradeExecuted?.({
            _id: tradeDoc._id.toString(),
            userId: this.userId,
            symbol,
            side,
            type: "MARKET",
            entryPrice: fillPrice,
            exitPrice: null,
            quantity: orderResult.quantity || validation.quantity,
            pnl: null,
            status: "OPEN",
            source: "AI",
            exchange: this.selectedExchange,
            mode: this.currentMode,
            aiDecision: decision,
            riskCheck: validation.riskCheck,
            pipelineRun: cycle,
            memoryReferences: cycle.retrievedMemories.map((item) => item.id),
            portfolioSlot,
            selectionRationale: selection,
            createdAt: tradeDoc.createdAt.toISOString(),
            closedAt: null,
          });
          await logger.info("TRADE", `Order executed: ${side} ${symbol}`, {
            cycleId: cycle.cycleId,
            quantity: validation.quantity,
            fillPrice,
            portfolioSlot,
          });
          alertService.onTradeExecuted(
            symbol,
            side,
            orderResult.quantity || validation.quantity,
            fillPrice,
          );

          openTrades.push(tradeDoc);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await logger.error("TRADE", `Order execution failed: ${reason}`, {
            cycleId: cycle.cycleId,
            symbol,
            side,
          });
          this.notifyOrderFailure(symbol, side, reason);
          await this.persistCycle(cycle, {
            tradeId: null,
            filled: false,
            blockedReason: `ORDER_FAILED: ${reason}`,
            symbolSelection: selection,
            riskCheck: validation.riskCheck,
          });
        }
      }

      this.emitStatus();
    } catch (error) {
      await logger.error("TRADE", `Cycle error: ${error}`);
    } finally {
      this.scheduleNextCycle();
    }
  }
}

export const tradeEngine = new TradeEngine();

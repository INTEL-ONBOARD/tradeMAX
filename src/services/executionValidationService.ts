import { validateTrade } from "./riskEngine.js";
import type {
  AIDecision,
  EngineConfig,
  ExchangeSymbolMetadata,
  MarketSnapshot,
  RiskProfile,
  RiskResult,
  SymbolSelectionEntry,
} from "../shared/types.js";

function floorToStep(value: number, step: number): number {
  if (!(step > 0)) return value;
  const floored = Math.floor(value / step) * step;
  return Number(floored.toFixed(8));
}

function cloneRiskResult(result: RiskResult): RiskResult {
  return {
    approved: result.approved,
    passed: [...result.passed],
    failed: [...result.failed],
    reasons: [...result.reasons],
  };
}

function appendRule(result: RiskResult, name: string, pass: boolean, reason: string): void {
  if (pass) {
    if (!result.passed.includes(name)) result.passed.push(name);
    return;
  }

  result.approved = false;
  if (!result.failed.includes(name)) result.failed.push(name);
  if (!result.reasons.includes(reason)) result.reasons.push(reason);
}

export interface ExecutionValidationArgs {
  decision: AIDecision;
  snapshot: MarketSnapshot;
  riskProfile: RiskProfile;
  engineConfig: EngineConfig;
  desiredSizeUsd: number;
  requestedLeverage: number;
  desiredTrailingStopPct: number | null;
  metadata: ExchangeSymbolMetadata | null;
  openTradeCount: number;
  openTradesForSymbol: number;
  dailyRealizedLoss: number;
  peakBalance: number;
  selection: SymbolSelectionEntry | null;
}

export interface ExecutionValidationResult {
  approved: boolean;
  blockedReason: string | null;
  quantity: number;
  notionalUsd: number;
  leverage: number;
  riskCheck: RiskResult;
  appliedTrailingStopPct: number | null;
}

export function buildExecutionValidation(args: ExecutionValidationArgs): ExecutionValidationResult {
  const tradingMode = args.snapshot.mode;
  const leverage = tradingMode === "futures"
    ? Math.min(Math.max(args.requestedLeverage, 1), args.riskProfile.maxLeverage, 20)
    : 1;
  const baseRiskResult = validateTrade(
    {
      decision: args.decision,
      portfolio: args.snapshot.portfolio,
      openTradeCount: args.openTradeCount,
      dailyRealizedLoss: args.dailyRealizedLoss,
      priceChange1h: args.snapshot.priceChange1hPct,
      spread: args.snapshot.orderBook.spreadPct,
      peakBalance: args.peakBalance,
      riskProfile: args.riskProfile,
      tradingMode,
      intendedQuantity: 0,
      maxSlippagePct: args.engineConfig.maxSlippagePct,
    },
    {
      volatilityThresholdPct: args.engineConfig.volatilityThresholdPct,
      spreadThresholdPct: args.engineConfig.spreadThresholdPct,
      maxDrawdownPct: args.engineConfig.maxDrawdownPct,
    },
  );
  const riskCheck = cloneRiskResult(baseRiskResult);

  const entryPrice = args.decision.entry;
  const currentPrice = args.snapshot.currentPrice;
  const entryDeviation = currentPrice > 0
    ? Math.abs((entryPrice - currentPrice) / currentPrice) * 100
    : 0;
  const riskSizedQuantity = args.decision.entry > 0
    ? (Math.abs(args.decision.entry - args.decision.stop_loss) > 0
      ? (args.snapshot.portfolio.availableBalance * (args.riskProfile.maxRiskPct / 100)) /
        Math.abs(args.decision.entry - args.decision.stop_loss)
      : 0)
    : 0;
  const aiSizedQuantity = args.decision.entry > 0 ? args.desiredSizeUsd / args.decision.entry : 0;
  const metadata = args.metadata;
  const quantity = metadata ? floorToStep(Math.min(riskSizedQuantity, aiSizedQuantity), metadata.qtyStep) : Math.min(riskSizedQuantity, aiSizedQuantity);
  const notionalUsd = quantity * Math.max(entryPrice, 0);
  const maxSafeNotional = Math.max(0, args.snapshot.portfolio.availableBalance * leverage);
  const appliedTrailingStopPct = args.engineConfig.enableTrailingStop
    ? args.desiredTrailingStopPct === null
      ? null
      : Math.min(args.desiredTrailingStopPct, args.engineConfig.trailingStopPct)
    : null;

  const resultWithQuantity = validateTrade(
    {
      decision: args.decision,
      portfolio: args.snapshot.portfolio,
      openTradeCount: args.openTradeCount,
      dailyRealizedLoss: args.dailyRealizedLoss,
      priceChange1h: args.snapshot.priceChange1hPct,
      spread: args.snapshot.orderBook.spreadPct,
      peakBalance: args.peakBalance,
      riskProfile: args.riskProfile,
      tradingMode,
      intendedQuantity: quantity,
      maxSlippagePct: args.engineConfig.maxSlippagePct,
    },
    {
      volatilityThresholdPct: args.engineConfig.volatilityThresholdPct,
      spreadThresholdPct: args.engineConfig.spreadThresholdPct,
      maxDrawdownPct: args.engineConfig.maxDrawdownPct,
    },
  );

  riskCheck.approved = resultWithQuantity.approved;
  riskCheck.passed = resultWithQuantity.passed;
  riskCheck.failed = resultWithQuantity.failed;
  riskCheck.reasons = resultWithQuantity.reasons;

  appendRule(riskCheck, "VALID_SYMBOL_METADATA", !!metadata, "Missing exchange symbol metadata");
  appendRule(riskCheck, "ENTRY_DEVIATION", entryDeviation <= 3, `Entry deviation ${entryDeviation.toFixed(2)}% exceeds 3%`);
  appendRule(riskCheck, "SAFE_NOTIONAL", notionalUsd > 0 && notionalUsd <= maxSafeNotional, `Notional $${notionalUsd.toFixed(2)} exceeds safe cap $${maxSafeNotional.toFixed(2)}`);
  appendRule(riskCheck, "MAX_CONCURRENT_SYMBOLS", args.openTradeCount < Math.min(args.riskProfile.maxOpenPositions, args.engineConfig.maxConcurrentSymbols), `Open trades ${args.openTradeCount} reached concurrent cap`);
  appendRule(riskCheck, "SINGLE_SYMBOL_POSITION", args.openTradesForSymbol === 0, `${args.openTradesForSymbol} open trades already active on ${args.snapshot.symbol}`);
  appendRule(riskCheck, "SPOT_LONG_ONLY", tradingMode !== "spot" || args.decision.decision === "BUY", "Spot mode only supports opening BUY positions");

  if (metadata) {
    appendRule(riskCheck, "MIN_ORDER_QTY", quantity >= metadata.minOrderQty, `Quantity ${quantity.toFixed(6)} below minimum ${metadata.minOrderQty}`);
    appendRule(riskCheck, "MIN_NOTIONAL", notionalUsd >= metadata.minNotionalUsd, `Notional $${notionalUsd.toFixed(2)} below minimum $${metadata.minNotionalUsd.toFixed(2)}`);
    appendRule(riskCheck, "VENUE_SHORT_CAPABILITY", args.decision.decision !== "SELL" || metadata.supportsShorts, `${args.snapshot.symbol} does not support new SELL exposure in ${tradingMode}`);
  }

  if (args.selection) {
    appendRule(riskCheck, "SYMBOL_SELECTION_GATE", args.selection.eligible, args.selection.reason);
  }

  return {
    approved: riskCheck.approved,
    blockedReason: riskCheck.failed[0] ?? null,
    quantity,
    notionalUsd,
    leverage,
    riskCheck,
    appliedTrailingStopPct,
  };
}

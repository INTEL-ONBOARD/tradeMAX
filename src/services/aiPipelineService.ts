import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import {
  aiDecisionSchema,
  executionReviewSchema,
  marketAssessmentSchema,
  postTradeReviewSchema,
  selfReviewSchema,
  tradeProposalSchema,
} from "../shared/validators.js";
import { ENGINE } from "../shared/constants.js";
import { logger } from "./loggerService.js";
import { DecisionJournalModel } from "../db/models/DecisionJournal.js";
import { MarketSnapshotModel } from "../db/models/MarketSnapshot.js";
import { MemoryNoteModel } from "../db/models/MemoryNote.js";
import { TradeModel } from "../db/models/Trade.js";
import type {
  AgentCycleResult,
  AIDecision,
  DecisionMemoryEntry,
  EngineConfig,
  ExecutionReview,
  MarketAssessment,
  MarketSnapshot,
  MemoryNote,
  PostTradeReview,
  RetrievedMemoryCase,
  SelfReviewSummary,
  SelfReviewResult,
  TradeProposal,
  Trade,
} from "../shared/types.js";

const HOLD_DECISION: AIDecision = {
  decision: "HOLD",
  confidence: 0,
  entry: 0,
  stop_loss: 0,
  take_profit: 0,
  reason: "Pipeline hold fallback",
};

const ASSESSMENT_FALLBACK: MarketAssessment = {
  regime: "unknown",
  volatilityBucket: "normal",
  tempoFit: "hostile",
  directionalBias: "NEUTRAL",
  conviction: 0,
  noTrade: true,
  noTradeReasons: ["assessment fallback"],
  keyDrivers: ["assessment unavailable"],
  riskFlags: ["assessment unavailable"],
  summary: "Fallback assessment",
};

const PROPOSAL_FALLBACK: TradeProposal = {
  action: "HOLD",
  confidence: 0,
  entryZone: { min: 1, max: 1, preferred: 1 },
  leverage: 1,
  sizeUsd: 0,
  stopLoss: 1,
  takeProfit: 1,
  trailingStopPct: null,
  maxHoldMinutes: 30,
  exitStyle: "fixed",
  thesis: "Fallback hold",
  invalidation: "Fallback hold",
};

const EXECUTION_FALLBACK: ExecutionReview = {
  verdict: "HOLD",
  finalAction: "HOLD",
  finalConfidence: 0,
  adjustedLeverage: 1,
  adjustedSizeUsd: 0,
  entryPrice: 1,
  stopLoss: 1,
  takeProfit: 1,
  trailingStopPct: null,
  maxHoldMinutes: 30,
  reasons: ["execution review fallback"],
  exchangeWarnings: ["execution review fallback"],
};

let client: OpenAI | null = null;
let currentApiKey: string | null = null;

function getClient(apiKey: string): OpenAI {
  if (client && currentApiKey === apiKey) return client;
  client = new OpenAI({ apiKey });
  currentApiKey = apiKey;
  return client;
}

function jsonSchemaForStage(name: string, schema: Record<string, unknown>) {
  return {
    type: "json_schema" as const,
    name,
    strict: true,
    schema: {
      type: "object",
      properties: schema.properties,
      required: schema.required,
      additionalProperties: false,
    },
  };
}

const MARKET_ASSESSMENT_JSON_SCHEMA = {
  properties: {
    regime: { type: "string", enum: ["trending_up", "trending_down", "ranging", "breakout", "volatile", "unknown"] },
    volatilityBucket: { type: "string", enum: ["compressed", "normal", "expanded", "violent"] },
    tempoFit: { type: "string", enum: ["aligned", "stretched", "hostile"] },
    directionalBias: { type: "string", enum: ["LONG", "SHORT", "NEUTRAL"] },
    conviction: { type: "number", minimum: 0, maximum: 1 },
    noTrade: { type: "boolean" },
    noTradeReasons: { type: "array", items: { type: "string" } },
    keyDrivers: { type: "array", items: { type: "string" } },
    riskFlags: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: ["regime", "volatilityBucket", "tempoFit", "directionalBias", "conviction", "noTrade", "noTradeReasons", "keyDrivers", "riskFlags", "summary"],
};

const TRADE_PROPOSAL_JSON_SCHEMA = {
  properties: {
    action: { type: "string", enum: ["BUY", "SELL", "HOLD"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    entryZone: {
      type: "object",
      properties: {
        min: { type: "number", exclusiveMinimum: 0 },
        max: { type: "number", exclusiveMinimum: 0 },
        preferred: { type: "number", exclusiveMinimum: 0 },
      },
      required: ["min", "max", "preferred"],
      additionalProperties: false,
    },
    leverage: { type: "number", minimum: 1, maximum: 100 },
    sizeUsd: { type: "number", minimum: 0 },
    stopLoss: { type: "number", exclusiveMinimum: 0 },
    takeProfit: { type: "number", exclusiveMinimum: 0 },
    trailingStopPct: { type: ["number", "null"], minimum: 0.05, maximum: 25 },
    maxHoldMinutes: { type: "integer", minimum: 1, maximum: 10080 },
    exitStyle: { type: "string", enum: ["fixed", "trailing", "hybrid"] },
    thesis: { type: "string" },
    invalidation: { type: "string" },
  },
  required: ["action", "confidence", "entryZone", "leverage", "sizeUsd", "stopLoss", "takeProfit", "trailingStopPct", "maxHoldMinutes", "exitStyle", "thesis", "invalidation"],
};

const EXECUTION_REVIEW_JSON_SCHEMA = {
  properties: {
    verdict: { type: "string", enum: ["APPROVE", "DOWNGRADE", "HOLD"] },
    finalAction: { type: "string", enum: ["BUY", "SELL", "HOLD"] },
    finalConfidence: { type: "number", minimum: 0, maximum: 1 },
    adjustedLeverage: { type: "number", minimum: 1, maximum: 100 },
    adjustedSizeUsd: { type: "number", minimum: 0 },
    entryPrice: { type: "number", exclusiveMinimum: 0 },
    stopLoss: { type: "number", exclusiveMinimum: 0 },
    takeProfit: { type: "number", exclusiveMinimum: 0 },
    trailingStopPct: { type: ["number", "null"], minimum: 0.05, maximum: 25 },
    maxHoldMinutes: { type: "integer", minimum: 1, maximum: 10080 },
    reasons: { type: "array", items: { type: "string" } },
    exchangeWarnings: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "finalAction", "finalConfidence", "adjustedLeverage", "adjustedSizeUsd", "entryPrice", "stopLoss", "takeProfit", "trailingStopPct", "maxHoldMinutes", "reasons", "exchangeWarnings"],
};

const POST_TRADE_REVIEW_JSON_SCHEMA = {
  properties: {
    outcomeLabel: { type: "string", enum: ["excellent", "good", "neutral", "poor"] },
    decisionQualityScore: { type: "number", minimum: 0, maximum: 1 },
    executionQualityScore: { type: "number", minimum: 0, maximum: 1 },
    riskDisciplineScore: { type: "number", minimum: 0, maximum: 1 },
    lessons: { type: "array", items: { type: "string" } },
    memoryNote: { type: "string" },
    summary: { type: "string" },
  },
  required: ["outcomeLabel", "decisionQualityScore", "executionQualityScore", "riskDisciplineScore", "lessons", "memoryNote", "summary"],
};

const SELF_REVIEW_JSON_SCHEMA = {
  properties: {
    summary: { type: "string" },
    memoryNote: { type: "string" },
    successThemes: { type: "array", items: { type: "string" } },
    failureThemes: { type: "array", items: { type: "string" } },
    recommendedActions: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["summary", "memoryNote", "successThemes", "failureThemes", "recommendedActions", "confidence"],
};

async function callStage<T>({
  apiKey,
  model,
  stage,
  systemPrompt,
  input,
  schemaName,
  jsonSchema,
  validator,
  fallback,
}: {
  apiKey?: string;
  model: string;
  stage: string;
  systemPrompt: string;
  input: unknown;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  validator: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown } } };
  fallback: T;
}): Promise<{ data: T; latencyMs: number; fallbackUsed: boolean }> {
  if (!apiKey) {
    await logger.warn("AI", `${stage}: missing OpenAI key, using fallback`);
    return { data: fallback, latencyMs: 0, fallbackUsed: true };
  }

  const started = Date.now();
  try {
    const response = await getClient(apiKey).responses.create({
      model,
      store: false,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(input) },
      ],
      text: { format: jsonSchemaForStage(schemaName, jsonSchema) },
    }, {
      timeout: ENGINE.AI_STAGE_TIMEOUT_MS,
    });

    const rawText = response.output_text?.trim();
    if (!rawText) {
      await logger.warn("AI", `${stage}: empty output, using fallback`);
      return { data: fallback, latencyMs: Date.now() - started, fallbackUsed: true };
    }

    const parsed = JSON.parse(rawText);
    const validated = validator.safeParse(parsed);
    if (!validated.success) {
      const failure = validated as { success: false; error: { issues: unknown } };
      await logger.warn("AI", `${stage}: schema validation failed, using fallback`, { issues: failure.error.issues });
      return { data: fallback, latencyMs: Date.now() - started, fallbackUsed: true };
    }

    return { data: validated.data as T, latencyMs: Date.now() - started, fallbackUsed: false };
  } catch (error) {
    await logger.warn("AI", `${stage}: error, using fallback`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return { data: fallback, latencyMs: Date.now() - started, fallbackUsed: true };
  }
}

function buildFinalDecision(review: ExecutionReview): AIDecision {
  if (review.finalAction === "HOLD") {
    return {
      ...HOLD_DECISION,
      reason: review.reasons.join("; ") || "Execution critic converted trade to hold",
    };
  }

  return {
    decision: review.finalAction,
    confidence: review.finalConfidence,
    entry: review.entryPrice,
    stop_loss: review.stopLoss,
    take_profit: review.takeProfit,
    reason: review.reasons.join("; "),
  };
}

function isProposalContractValid(action: "BUY" | "SELL" | "HOLD", entry: number, stopLoss: number, takeProfit: number): boolean {
  if (action === "HOLD") return true;
  if (action === "BUY") return stopLoss < entry && takeProfit > entry;
  return stopLoss > entry && takeProfit < entry;
}

function scoreMemory(entry: {
  symbol: string;
  profile: string;
  regime?: string;
  volatilityBucket?: string;
  review?: { outcomeLabel?: string };
}, snapshot: MarketSnapshot): number {
  let score = 0;
  if (entry.symbol === snapshot.symbol) score += 5;
  if (entry.profile === snapshot.profile.profile) score += 3;
  if (entry.regime === snapshot.regimeHint) score += 4;
  if (entry.volatilityBucket === snapshot.tempoState.volatilityBucket) score += 2;
  if (entry.review?.outcomeLabel === "excellent") score += 1.5;
  if (entry.review?.outcomeLabel === "poor") score += 0.75;
  return score;
}

const LEARNING_RETENTION_DAYS = 365;
const LEARNING_PRUNE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const lastLearningPruneAtByUser = new Map<string, number>();

function getSnapshotTimestampMs(snapshot: MarketSnapshot): number {
  const parsed = new Date(snapshot.timestamp).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function countBy<T>(items: T[], mapper: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = mapper(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function pickDominantEntry(entries: Array<{ key: string; count: number }>, fallback: string): string {
  if (entries.length === 0) return fallback;
  return entries
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.key)
    .find((value) => value) ?? fallback;
}

function formatTradeSummary(trade: {
  symbol: string;
  pnl?: number | null;
  regime?: string | null;
  reason?: string | null;
  side?: string | null;
}): string {
  const pnl = trade.pnl ?? 0;
  return `${trade.symbol} ${trade.side ?? "trade"} ${pnl >= 0 ? "gain" : "loss"} ${pnl.toFixed(2)} (${trade.regime ?? "unknown"}${trade.reason ? `, ${trade.reason}` : ""})`;
}

function buildSelfReviewFallback(context: {
  symbol: string;
  profile: string;
  closedTrades: Array<{
    symbol: string;
    pnl?: number | null;
    regime?: string | null;
    volatilityBucket?: string | null;
    reason?: string | null;
    side?: string | null;
  }>;
  journals: Array<{
    regime?: string | null;
    volatilityBucket?: string | null;
    pipeline?: { holdReason?: string | null; finalDecision?: { reason?: string | null } } | null;
    executionResult?: { blockedReason?: string | null; filled?: boolean | null } | null;
    review?: { summary?: string | null } | null;
  }>;
  totalPnl: number;
  winRate: number;
  dominantRegime: string;
  dominantVolatilityBucket: string;
  bestTrade: { symbol: string; pnl?: number | null; regime?: string | null; reason?: string | null; side?: string | null } | null;
  worstTrade: { symbol: string; pnl?: number | null; regime?: string | null; reason?: string | null; side?: string | null } | null;
}): SelfReviewSummary {
  const successThemes = context.totalPnl >= 0
    ? [
        `Maintain the ${context.profile} cadence in ${context.dominantRegime} conditions`,
        context.bestTrade ? `Best recent setup: ${formatTradeSummary(context.bestTrade)}` : "No clear best trade yet",
      ]
    : ["Protect winners earlier and reduce re-entry noise"];

  const failureThemes = [
    context.worstTrade ? `Worst recent setup: ${formatTradeSummary(context.worstTrade)}` : "No clear failure sample yet",
    `Volatility bucket ${context.dominantVolatilityBucket} needs tighter sizing discipline`,
  ];

  const recommendedActions = [
    context.winRate < 50 ? "Bias future sizing down until the edge stabilizes" : "Keep current size discipline and protect execution quality",
    context.journals.length > 0 ? "Carry forward the latest failure pattern into the next memory retrieval" : "No runtime journal signal available; lean on current market snapshot",
  ];

  return {
    summary: `Self-review for ${context.symbol} (${context.profile}) over the recent ${context.closedTrades.length} closed trades and ${context.journals.length} journal entries. Total PnL ${context.totalPnl.toFixed(2)} with win rate ${context.winRate.toFixed(1)}%.`,
    memoryNote: `Recent ${context.profile} activity in ${context.dominantRegime} conditions suggests ${context.totalPnl >= 0 ? "preserving" : "reducing"} aggression; keep ${context.dominantVolatilityBucket} volatility sizing tight and revisit ${context.worstTrade?.reason ?? "latest losses"} before the next cycle.`,
    successThemes,
    failureThemes,
    recommendedActions,
    confidence: 0.45,
  };
}

async function maybePruneLearningHistory(userId: string): Promise<void> {
  const now = Date.now();
  const lastPrune = lastLearningPruneAtByUser.get(userId) ?? 0;
  if (now - lastPrune < LEARNING_PRUNE_COOLDOWN_MS) return;
  lastLearningPruneAtByUser.set(userId, now);

  const cutoff = new Date(now - LEARNING_RETENTION_DAYS * 24 * 3600_000);
  await Promise.allSettled([
    DecisionJournalModel.deleteMany({ userId, createdAt: { $lt: cutoff } }),
    MarketSnapshotModel.deleteMany({ userId, createdAt: { $lt: cutoff } }),
    MemoryNoteModel.deleteMany({ userId, createdAt: { $lt: cutoff } }),
  ]);
}

async function getLatestSelfReviewAt(userId: string): Promise<number> {
  const latestReview = await MemoryNoteModel.findOne({
    userId,
    tags: "self_review",
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!latestReview?.createdAt) return 0;
  const parsed = new Date(latestReview.createdAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function retrieveRelevantMemories(args: {
  userId: string;
  snapshot: MarketSnapshot;
  engineConfig: EngineConfig;
}): Promise<RetrievedMemoryCase[]> {
  const snapshotTimestampMs = getSnapshotTimestampMs(args.snapshot);
  const lookbackStart = new Date(snapshotTimestampMs - args.engineConfig.memoryLookbackDays * 24 * 3600_000);
  const lookbackEnd = new Date(snapshotTimestampMs);
  const journalRows = await DecisionJournalModel.find({
    userId: args.userId,
    symbol: args.snapshot.symbol,
    createdAt: { $gte: lookbackStart, $lte: lookbackEnd },
  })
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();

  const noteRows = await MemoryNoteModel.find({
    userId: args.userId,
    symbol: args.snapshot.symbol,
    profile: args.snapshot.profile.profile,
    createdAt: { $gte: lookbackStart, $lte: lookbackEnd },
  })
    .sort({ priority: -1, createdAt: -1 })
    .limit(10)
    .lean();

  const journalCases = journalRows.map((row) => ({
    id: row._id.toString(),
    symbol: row.symbol,
    profile: row.profile,
    regime: row.regime as RetrievedMemoryCase["regime"],
    volatilityBucket: row.volatilityBucket as RetrievedMemoryCase["volatilityBucket"],
    outcomeLabel: (row.review as { outcomeLabel?: RetrievedMemoryCase["outcomeLabel"] } | null)?.outcomeLabel,
    score: scoreMemory({
      symbol: row.symbol,
      profile: row.profile,
      regime: row.regime,
      volatilityBucket: row.volatilityBucket,
      review: (row.review as { outcomeLabel?: string } | null) ?? undefined,
    }, args.snapshot),
    summary:
      (row.review as { summary?: string } | null)?.summary ??
      (row.pipeline as { finalDecision?: { reason?: string } })?.finalDecision?.reason ??
      "Prior decision journal case",
  }));

  const noteCases = noteRows.map((row) => ({
    id: row._id.toString(),
    symbol: row.symbol,
    profile: row.profile,
    regime: "unknown" as const,
    volatilityBucket: "normal" as const,
    score: row.priority + 1,
    summary: row.summary,
  }));

  return [...journalCases, ...noteCases]
    .sort((a, b) => b.score - a.score)
    .slice(0, args.engineConfig.memoryRetrievalCount);
}

export async function runAIPipeline(args: {
  userId: string;
  snapshot: MarketSnapshot;
  engineConfig: EngineConfig;
  openaiApiKey?: string;
}): Promise<AgentCycleResult> {
  const cycleId = randomUUID();
  const started = Date.now();
  const memories = await retrieveRelevantMemories({
    userId: args.userId,
    snapshot: args.snapshot,
    engineConfig: args.engineConfig,
  });
  const memorySummary = memories.length > 0
    ? memories.map((item, index) => `${index + 1}. ${item.summary}`).join("\n")
    : "No relevant local memories.";

  const assessment = await callStage({
    apiKey: args.openaiApiKey,
    model: args.engineConfig.stageModels.marketAnalyst,
    stage: "market-analyst",
    systemPrompt:
      "You are the Market Analyst for a futures trading agent. Assess the normalized market snapshot, identify regime, volatility, tempo fit, directional bias, and whether conditions justify no trade. Output JSON only.",
    input: { snapshot: args.snapshot, memorySummary },
    schemaName: "market_assessment",
    jsonSchema: MARKET_ASSESSMENT_JSON_SCHEMA,
    validator: marketAssessmentSchema,
    fallback: {
      ...ASSESSMENT_FALLBACK,
      volatilityBucket: args.snapshot.tempoState.volatilityBucket,
      tempoFit: args.snapshot.tempoState.tempoFit,
    },
  });

  const proposal = await callStage({
    apiKey: args.openaiApiKey,
    model: args.engineConfig.stageModels.tradeArchitect,
    stage: "trade-architect",
    systemPrompt:
      "You are the Trade Architect for a futures trading agent. Produce a contract-valid trade plan for the given market assessment and market snapshot. Respect the active tempo profile. Output JSON only.",
    input: { snapshot: args.snapshot, marketAssessment: assessment.data, memorySummary, preferences: {
      holdTimeBias: args.engineConfig.holdTimeBias,
      exitStylePreference: args.engineConfig.exitStylePreference,
    } },
    schemaName: "trade_proposal",
    jsonSchema: TRADE_PROPOSAL_JSON_SCHEMA,
    validator: tradeProposalSchema,
    fallback: {
      ...PROPOSAL_FALLBACK,
      entryZone: {
        min: args.snapshot.currentPrice || 1,
        max: args.snapshot.currentPrice || 1,
        preferred: args.snapshot.currentPrice || 1,
      },
      stopLoss: args.snapshot.currentPrice || 1,
      takeProfit: args.snapshot.currentPrice || 1,
      maxHoldMinutes: args.snapshot.profile.maxHoldMinutes,
    },
  });

  const review = await callStage({
    apiKey: args.openaiApiKey,
    model: args.engineConfig.stageModels.executionCritic,
    stage: "execution-critic",
    systemPrompt:
      "You are the Execution Critic. Challenge the trade proposal using market snapshot, exchange conditions, spread, open positions, and tempo strictness. Approve, downgrade, or convert to HOLD. Output JSON only.",
    input: {
      snapshot: args.snapshot,
      marketAssessment: assessment.data,
      tradeProposal: proposal.data,
      critiqueStrictness: args.engineConfig.critiqueStrictness,
    },
    schemaName: "execution_review",
    jsonSchema: EXECUTION_REVIEW_JSON_SCHEMA,
    validator: executionReviewSchema,
    fallback: {
      ...EXECUTION_FALLBACK,
      entryPrice: args.snapshot.currentPrice || 1,
      stopLoss: args.snapshot.currentPrice || 1,
      takeProfit: args.snapshot.currentPrice || 1,
      maxHoldMinutes: args.snapshot.profile.maxHoldMinutes,
    },
  });

  const marketAssessment = assessment.data as MarketAssessment;
  const tradeProposal = proposal.data as TradeProposal;
  const executionReview = review.data as ExecutionReview;
  const finalDecision = buildFinalDecision(executionReview);
  const contractValid = isProposalContractValid(
    finalDecision.decision,
    finalDecision.entry,
    finalDecision.stop_loss,
    finalDecision.take_profit,
  );
  const status =
    marketAssessment.noTrade || executionReview.finalAction === "HOLD" || !contractValid || assessment.fallbackUsed || proposal.fallbackUsed || review.fallbackUsed
      ? "HOLD"
      : "READY";

  return {
    cycleId,
    timestamp: new Date().toISOString(),
    symbol: args.snapshot.symbol,
    profile: args.snapshot.profile.profile,
    snapshot: args.snapshot,
    retrievedMemories: memories,
    memorySummary,
    marketAssessment,
    tradeProposal,
    executionReview,
    finalDecision: status === "READY" ? finalDecision : {
      ...HOLD_DECISION,
      reason: !contractValid
        ? "Execution review failed contract validation"
        : marketAssessment.noTrade
          ? marketAssessment.noTradeReasons.join("; ")
          : executionReview.reasons.join("; ") || "Pipeline fallback hold",
    },
    latencyMs: {
      total: Date.now() - started,
      marketAnalyst: assessment.latencyMs,
      tradeArchitect: proposal.latencyMs,
      executionCritic: review.latencyMs,
    },
    status,
    holdReason:
      status === "HOLD"
        ? !contractValid
          ? "Invalid final execution contract"
          : assessment.data.noTrade
            ? assessment.data.noTradeReasons.join("; ")
            : review.data.reasons.join("; ")
        : undefined,
  };
}

export async function persistCycleResult(args: {
  userId: string;
  cycle: AgentCycleResult;
  executionResult?: DecisionMemoryEntry["executionResult"];
}): Promise<{ snapshotId: string | null; journalId: string | null }> {
  try {
    const snapshotDoc = await MarketSnapshotModel.create({
      userId: args.userId,
      symbol: args.cycle.symbol,
      profile: args.cycle.profile,
      snapshot: args.cycle.snapshot,
    });

    const journalDoc = await DecisionJournalModel.create({
      userId: args.userId,
      symbol: args.cycle.symbol,
      profile: args.cycle.profile,
      regime: args.cycle.marketAssessment.regime,
      volatilityBucket: args.cycle.marketAssessment.volatilityBucket,
      snapshotId: snapshotDoc._id,
      pipeline: args.cycle,
      executionResult: args.executionResult ?? null,
    });

    await maybePruneLearningHistory(args.userId);

    return { snapshotId: snapshotDoc._id.toString(), journalId: journalDoc._id.toString() };
  } catch (error) {
    await logger.warn("AI", "Failed to persist cycle result", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { snapshotId: null, journalId: null };
  }
}

export async function reviewClosedTrade(args: {
  userId: string;
  trade: Trade;
  openaiApiKey?: string;
  model?: string;
}): Promise<PostTradeReview | null> {
  if (!args.trade.pipelineRun || !args.openaiApiKey) return null;
  const review = await callStage({
    apiKey: args.openaiApiKey,
    model: args.model || "gpt-5.4-mini",
    stage: "post-trade-reviewer",
    systemPrompt:
      "You are the Post-Trade Reviewer for a futures trading agent. Review the full pipeline decision, the market context, and the realized outcome. Produce a concise runtime memory note. Output JSON only.",
    input: {
      trade: args.trade,
      pipelineRun: args.trade.pipelineRun,
      outcome: {
        pnl: args.trade.pnl,
        closedAt: args.trade.closedAt,
      },
    },
    schemaName: "post_trade_review",
    jsonSchema: POST_TRADE_REVIEW_JSON_SCHEMA,
    validator: postTradeReviewSchema,
    fallback: null as never,
  }).catch(() => null);

  if (!review || review.fallbackUsed) return null;

  await MemoryNoteModel.create({
    userId: args.userId,
    symbol: args.trade.symbol,
    profile: args.trade.pipelineRun.profile,
    summary: review.data.memoryNote,
    tags: [
      args.trade.pipelineRun.marketAssessment.regime,
      args.trade.pipelineRun.marketAssessment.volatilityBucket,
      review.data.outcomeLabel,
    ],
    priority: review.data.outcomeLabel === "poor" ? 0.95 : 0.75,
  }).catch(() => {});

  await maybePruneLearningHistory(args.userId);

  await DecisionJournalModel.findOneAndUpdate(
    {
      userId: args.userId,
      "executionResult.tradeId": args.trade._id,
    },
    {
      $set: {
        review: review.data,
        "executionResult.pnl": args.trade.pnl,
        "executionResult.exitPrice": args.trade.exitPrice,
        "executionResult.closedAt": args.trade.closedAt,
      },
    },
  ).catch(() => {});

  return review.data;
}

export async function runSelfReview(args: {
  userId: string;
  symbol: string;
  engineConfig: EngineConfig;
  openaiApiKey?: string;
  force?: boolean;
}): Promise<SelfReviewResult | null> {
  const symbol = args.symbol.toUpperCase();
  const now = Date.now();
  const lookbackDays = Math.max(1, Math.min(args.engineConfig.memoryLookbackDays, 14));
  const lookbackStart = new Date(now - lookbackDays * 24 * 3600_000);
  const lastReviewAt = await getLatestSelfReviewAt(args.userId);
  const reviewStart = args.force || lastReviewAt <= 0
    ? lookbackStart
    : new Date(Math.max(lookbackStart.getTime(), lastReviewAt + 1));

  const [tradeRows, journalRows] = await Promise.all([
    TradeModel.find({
      userId: args.userId,
      symbol,
      status: "CLOSED",
      closedAt: { $gte: reviewStart, $lte: new Date(now) },
      pipelineRun: { $ne: null },
    })
      .sort({ closedAt: -1 })
      .limit(20)
      .lean(),
    DecisionJournalModel.find({
      userId: args.userId,
      symbol,
      createdAt: { $gte: reviewStart, $lte: new Date(now) },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  const latestTradeAt = tradeRows.reduce((max, row) => {
    const ts = row.closedAt ? new Date(row.closedAt).getTime() : 0;
    return Math.max(max, Number.isFinite(ts) ? ts : 0);
  }, 0);
  const latestJournalAt = journalRows.reduce((max, row) => {
    const ts = row.createdAt ? new Date(row.createdAt).getTime() : 0;
    return Math.max(max, Number.isFinite(ts) ? ts : 0);
  }, 0);
  const latestActivityAt = Math.max(latestTradeAt, latestJournalAt);

  if (!args.force && lastReviewAt > 0 && latestActivityAt <= lastReviewAt) {
    return null;
  }

  if (tradeRows.length === 0 && journalRows.length === 0) {
    return null;
  }

  const tradeSummaries = tradeRows.map((row) => {
    const trade = row as {
      symbol: string;
      pnl?: number | null;
      regime?: string | null;
      volatilityBucket?: string | null;
      side?: string | null;
      pipelineRun?: {
        marketAssessment?: { regime?: string; volatilityBucket?: string };
        finalDecision?: { reason?: string | null };
      } | null;
    };

    return {
      symbol: trade.symbol,
      pnl: trade.pnl,
      regime: trade.pipelineRun?.marketAssessment?.regime ?? trade.regime ?? "unknown",
      volatilityBucket: trade.pipelineRun?.marketAssessment?.volatilityBucket ?? trade.volatilityBucket ?? "normal",
      reason: trade.pipelineRun?.finalDecision?.reason ?? null,
      side: trade.side,
    };
  });

  const journalSummaries = journalRows.map((row) => ({
    regime: row.regime ?? "unknown",
    volatilityBucket: row.volatilityBucket ?? "normal",
    pipeline: row.pipeline ? {
      holdReason: (row.pipeline as { holdReason?: string | null }).holdReason ?? null,
      finalDecision: (row.pipeline as { finalDecision?: { reason?: string | null } }).finalDecision ? {
        reason: (row.pipeline as { finalDecision?: { reason?: string | null } }).finalDecision?.reason ?? null,
      } : undefined,
    } : null,
    executionResult: row.executionResult ? {
      blockedReason: (row.executionResult as { blockedReason?: string | null }).blockedReason ?? null,
      filled: (row.executionResult as { filled?: boolean | null }).filled ?? null,
    } : null,
    review: row.review ? {
      summary: (row.review as { summary?: string | null }).summary ?? null,
    } : null,
  }));

  const regimeCounts = countBy(tradeSummaries, (trade) => trade.regime ?? "unknown");
  const volatilityCounts = countBy(tradeSummaries, (trade) => trade.volatilityBucket ?? "normal");
  const dominantRegime = pickDominantEntry([...regimeCounts.entries()].map(([key, count]) => ({ key, count })), "unknown");
  const dominantVolatilityBucket = pickDominantEntry(
    [...volatilityCounts.entries()].map(([key, count]) => ({ key, count })),
    "normal",
  );

  const totalPnl = tradeRows.reduce((sum, row) => sum + (row.pnl ?? 0), 0);
  const wins = tradeRows.filter((row) => (row.pnl ?? 0) >= 0).length;
  const winRate = tradeRows.length > 0 ? (wins / tradeRows.length) * 100 : 0;
  const bestTrade = [...tradeSummaries].sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))[0] ?? null;
  const worstTrade = [...tradeSummaries].sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0))[0] ?? null;

  const fallback = buildSelfReviewFallback({
    symbol,
    profile: args.engineConfig.tradingProfile,
    closedTrades: tradeSummaries,
    journals: journalSummaries,
    totalPnl,
    winRate,
    dominantRegime,
    dominantVolatilityBucket,
    bestTrade,
    worstTrade,
  });

  const review = await callStage({
    apiKey: args.openaiApiKey,
    model: args.engineConfig.stageModels.postTradeReviewer,
    stage: "self-review",
    systemPrompt:
      "You are the idle self-review analyst for a futures trading agent. Summarize recent wins, failures, and memory updates using only the supplied context. Output JSON only.",
    input: {
      symbol,
      profile: args.engineConfig.tradingProfile,
      lookbackDays,
      reviewStart: reviewStart.toISOString(),
      reviewEnd: new Date(now).toISOString(),
      totals: {
        trades: tradeRows.length,
        journals: journalRows.length,
        totalPnl,
        winRate,
      },
      dominantRegime,
      dominantVolatilityBucket,
      bestTrade,
      worstTrade,
      tradeSummaries: tradeSummaries.slice(0, 8),
      journalSummaries: journalSummaries.slice(0, 8),
    },
    schemaName: "self_review_summary",
    jsonSchema: SELF_REVIEW_JSON_SCHEMA,
    validator: selfReviewSchema,
    fallback,
  });

  let reviewId: string = randomUUID();
  const note = await MemoryNoteModel.create({
    userId: args.userId,
    symbol,
    profile: args.engineConfig.tradingProfile,
    summary: review.data.memoryNote,
    tags: [
      "self_review",
      args.engineConfig.tradingProfile,
      dominantRegime,
      dominantVolatilityBucket,
    ],
    priority: Math.max(0.55, review.data.confidence),
  }).catch(async (error) => {
    await logger.warn("AI", "Failed to persist self-review memory note", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  if (note?._id) {
    reviewId = note._id.toString();
  }

  await maybePruneLearningHistory(args.userId);

  const result: SelfReviewResult = {
    reviewId,
    userId: args.userId,
    symbol,
    profile: args.engineConfig.tradingProfile,
    reviewedTradeCount: tradeRows.length,
    reviewedJournalCount: journalRows.length,
    confidence: review.data.confidence,
    summary: review.data.summary,
    memoryNote: review.data.memoryNote,
    successThemes: review.data.successThemes,
    failureThemes: review.data.failureThemes,
    recommendedActions: review.data.recommendedActions,
    createdAt: new Date().toISOString(),
  };

  return result;
}

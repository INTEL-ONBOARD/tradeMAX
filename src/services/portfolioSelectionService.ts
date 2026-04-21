import { TradeModel } from "../db/models/Trade.js";
import { AUTO_PAIR_FALLBACKS, scoreAutoPairTicker, type AutoPairTicker } from "./autoPairSelection.js";
import type { EngineConfig, SymbolPerformanceSummary, SymbolSelectionEntry } from "../shared/types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSymbols(symbols: string[]): string[] {
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
}

async function fetchMarketScores(candidates: string[], mode: "spot" | "futures"): Promise<Map<string, number>> {
  const normalizedCandidates = normalizeSymbols(candidates);
  if (normalizedCandidates.length === 0) return new Map();

  const category = mode === "spot" ? "spot" : "linear";
  const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=${category}`);
  if (!response.ok) {
    throw new Error(`MARKET_SCORE_FETCH_${response.status}`);
  }

  const payload = await response.json() as {
    result?: { list?: Array<{ symbol: string; turnover24h?: string; price24hPcnt?: string }> };
  };
  const candidateSet = new Set(normalizedCandidates);
  const tickers: AutoPairTicker[] = (payload.result?.list ?? [])
    .filter((item) => candidateSet.has(String(item.symbol).toUpperCase()))
    .map((item) => ({
      symbol: String(item.symbol).toUpperCase(),
      turnover24h: parseFloat(item.turnover24h ?? "0") || 0,
      priceChangePct24h: Math.abs((parseFloat(item.price24hPcnt ?? "0") || 0) * 100),
    }));

  const scores = tickers.map((ticker) => ({
    symbol: ticker.symbol,
    score: scoreAutoPairTicker(ticker),
  }));
  const maxScore = Math.max(...scores.map((item) => item.score), 1);

  return new Map(scores.map((item) => [item.symbol, clamp(item.score / maxScore, 0, 1)]));
}

export async function loadSymbolPerformance(args: {
  userId: string;
  mode: "spot" | "futures";
  symbols: string[];
  lookbackDays: number;
}): Promise<Map<string, SymbolPerformanceSummary>> {
  const normalizedSymbols = normalizeSymbols(args.symbols);
  if (normalizedSymbols.length === 0) return new Map();

  const lookbackStart = new Date(Date.now() - args.lookbackDays * 24 * 3600_000);
  const rows = await TradeModel.find({
    userId: args.userId,
    symbol: { $in: normalizedSymbols },
    mode: args.mode,
    status: "CLOSED",
    closedAt: { $gte: lookbackStart },
  })
    .sort({ closedAt: -1 })
    .lean();

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.symbol.toUpperCase();
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }

  const summaryMap = new Map<string, SymbolPerformanceSummary>();
  for (const symbol of normalizedSymbols) {
    const trades = grouped.get(symbol) ?? [];
    const wins = trades.filter((trade) => (trade.pnl ?? 0) > 0).length;
    const totalTrades = trades.length;
    const totalPnl = trades.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
    summaryMap.set(symbol, {
      symbol,
      mode: args.mode,
      totalTrades,
      winRate: totalTrades > 0 ? wins / totalTrades : 0,
      totalPnl,
      lastClosedAt: trades[0]?.closedAt ? new Date(trades[0].closedAt).toISOString() : null,
    });
  }

  return summaryMap;
}

export async function rankCandidateSymbols(args: {
  userId: string;
  mode: "spot" | "futures";
  engineConfig: EngineConfig;
  requestedSymbol: string;
}): Promise<SymbolSelectionEntry[]> {
  const configured = normalizeSymbols([
    args.requestedSymbol,
    ...(args.engineConfig.candidateSymbols ?? []),
    ...(args.engineConfig.watchlist ?? []),
  ]);
  const candidates = configured.length > 0 ? configured : normalizeSymbols([...AUTO_PAIR_FALLBACKS]);

  const [marketScores, performanceMap] = await Promise.all([
    fetchMarketScores(candidates, args.mode).catch(() => new Map<string, number>()),
    loadSymbolPerformance({
      userId: args.userId,
      mode: args.mode,
      symbols: candidates,
      lookbackDays: args.engineConfig.performanceLookbackDays,
    }),
  ]);

  return candidates
    .map((symbol): SymbolSelectionEntry => {
      const performance = performanceMap.get(symbol) ?? {
        symbol,
        mode: args.mode,
        totalTrades: 0,
        winRate: 0,
        totalPnl: 0,
        lastClosedAt: null,
      };
      const marketScore = marketScores.get(symbol) ?? 0;
      const performanceScore =
        performance.totalTrades < args.engineConfig.minSymbolSampleSize
          ? 0.5
          : clamp((performance.winRate * 0.8) + (performance.totalPnl > 0 ? 0.2 : 0), 0, 1);
      const eligible =
        performance.totalTrades < args.engineConfig.minSymbolSampleSize ||
        performance.winRate >= args.engineConfig.minSymbolWinRate;
      const compositeScore = eligible ? (marketScore * 0.6) + (performanceScore * 0.4) : 0;
      const reason = eligible
        ? performance.totalTrades < args.engineConfig.minSymbolSampleSize
          ? `Insufficient sample (${performance.totalTrades}) so market quality dominates`
          : `Win rate ${(performance.winRate * 100).toFixed(0)}% across ${performance.totalTrades} trades`
        : `Suppressed: ${(performance.winRate * 100).toFixed(0)}% win rate across ${performance.totalTrades} trades`;

      return {
        symbol,
        mode: args.mode,
        marketScore,
        performanceScore,
        compositeScore,
        winRate: performance.winRate,
        sampleSize: performance.totalTrades,
        eligible,
        reason,
      };
    })
    .sort((left, right) => {
      if (left.eligible !== right.eligible) return Number(right.eligible) - Number(left.eligible);
      return right.compositeScore - left.compositeScore;
    });
}

export function pickTrackedSymbols(args: {
  leaderboard: SymbolSelectionEntry[];
  openTradeSymbols: string[];
  maxConcurrentSymbols: number;
}): string[] {
  const ranked = args.leaderboard
    .filter((entry) => entry.eligible)
    .slice(0, Math.max(1, args.maxConcurrentSymbols))
    .map((entry) => entry.symbol);

  return normalizeSymbols([...args.openTradeSymbols, ...ranked]);
}

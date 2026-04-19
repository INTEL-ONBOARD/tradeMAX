export interface AutoPairTicker {
  symbol: string;
  turnover24h: number;
  priceChangePct24h: number;
}

export const AUTO_PAIR_FALLBACKS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "LINKUSDT",
  "AVAXUSDT",
] as const;

export function scoreAutoPairTicker(ticker: AutoPairTicker): number {
  const liquidityScore = Math.log10(Math.max(ticker.turnover24h, 1));
  const momentumScore = Math.sqrt(Math.abs(ticker.priceChangePct24h));
  return liquidityScore * 0.8 + momentumScore * 0.2;
}

export function selectBestAutoPair(
  candidates: string[],
  tickers: AutoPairTicker[],
): string | null {
  const candidateSet = new Set(candidates.map((symbol) => symbol.toUpperCase()));
  const ranked = tickers
    .filter((ticker) => candidateSet.has(ticker.symbol.toUpperCase()))
    .map((ticker) => ({
      symbol: ticker.symbol.toUpperCase(),
      score: scoreAutoPairTicker(ticker),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.symbol ?? null;
}

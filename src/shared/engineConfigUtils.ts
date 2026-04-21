import type { EngineConfig } from "./types";

const DEFAULT_SYMBOL = "BTCUSDT";

function normalizeSymbols(symbols: string[]): string[] {
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
}

export function resolvePreferredTradingSymbol(
  engineConfig?: Partial<Pick<EngineConfig, "tradingSymbol" | "candidateSymbols" | "watchlist" | "autoPairSelection" | "restrictAutoPairSelectionToShortlist">> | null,
): string {
  const manual = normalizeSymbols([engineConfig?.tradingSymbol ?? ""]);
  const shortlist = normalizeSymbols([
    ...(engineConfig?.candidateSymbols ?? []),
    ...(engineConfig?.watchlist ?? []),
  ]);

  if (engineConfig?.autoPairSelection && engineConfig?.restrictAutoPairSelectionToShortlist) {
    return shortlist[0] ?? manual[0] ?? DEFAULT_SYMBOL;
  }

  return manual[0] ?? shortlist[0] ?? DEFAULT_SYMBOL;
}

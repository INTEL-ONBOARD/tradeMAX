import { buildReplayMarketSnapshot, getDefaultEngineConfig } from "../marketSnapshotService";
import type { CandleBar } from "../../shared/types";

function makeCandles(count: number): CandleBar[] {
  return Array.from({ length: count }, (_, index) => {
    const base = 100 + index;
    return {
      timestamp: Date.now() - (count - index) * 60_000,
      open: base,
      high: base + 1,
      low: base - 1,
      close: base + 0.5,
      volume: 1000 + index * 10,
    };
  });
}

describe("marketSnapshotService", () => {
  it("builds a normalized replay snapshot with tempo and futures context", () => {
    const snapshot = buildReplayMarketSnapshot({
      symbol: "BTCUSDT",
      mode: "futures",
      portfolio: { totalBalance: 10000, availableBalance: 9500, dailyPnl: 0, weeklyPnl: 0 },
      openPositions: [],
      engineConfig: getDefaultEngineConfig(),
      primaryCandles: makeCandles(60),
    });

    expect(snapshot.symbol).toBe("BTCUSDT");
    expect(snapshot.profile.profile).toBe("intraday");
    expect(snapshot.recentCandles).toHaveLength(20);
    expect(snapshot.multiTimeframeCandles[0].candles.length).toBeGreaterThanOrEqual(40);
    expect(snapshot.futuresContext.markPrice).toBeGreaterThan(0);
    expect(snapshot.tempoState.volatilityBucket).toBeDefined();
    expect(snapshot.indicators.rsi).toBeGreaterThanOrEqual(0);
  });
});

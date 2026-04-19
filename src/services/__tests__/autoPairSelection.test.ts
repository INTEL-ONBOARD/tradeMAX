import {
  selectBestAutoPair,
  scoreAutoPairTicker,
  type AutoPairTicker,
} from "../autoPairSelection";

describe("autoPairSelection", () => {
  it("prefers liquid symbols with stronger momentum", () => {
    const tickers: AutoPairTicker[] = [
      { symbol: "BTCUSDT", turnover24h: 1_000_000_000, priceChangePct24h: 1.2 },
      { symbol: "ETHUSDT", turnover24h: 400_000_000, priceChangePct24h: 4.8 },
      { symbol: "DOGEUSDT", turnover24h: 40_000_000, priceChangePct24h: 12.5 },
    ];

    expect(selectBestAutoPair(["BTCUSDT", "ETHUSDT", "DOGEUSDT"], tickers)).toBe("BTCUSDT");
  });

  it("ignores tickers outside the requested candidate list", () => {
    const tickers: AutoPairTicker[] = [
      { symbol: "SOLUSDT", turnover24h: 350_000_000, priceChangePct24h: 8.1 },
      { symbol: "LINKUSDT", turnover24h: 50_000_000, priceChangePct24h: 2.5 },
    ];

    expect(selectBestAutoPair(["LINKUSDT"], tickers)).toBe("LINKUSDT");
  });

  it("returns null when no candidates are present in the ticker feed", () => {
    const tickers: AutoPairTicker[] = [
      { symbol: "BTCUSDT", turnover24h: 1_000_000_000, priceChangePct24h: 1.2 },
    ];

    expect(selectBestAutoPair(["ADAUSDT"], tickers)).toBeNull();
  });

  it("produces higher scores for stronger symbols", () => {
    const strong = scoreAutoPairTicker({
      symbol: "BTCUSDT",
      turnover24h: 1_500_000_000,
      priceChangePct24h: 3.5,
    });
    const weak = scoreAutoPairTicker({
      symbol: "ALTUSDT",
      turnover24h: 5_000_000,
      priceChangePct24h: 0.2,
    });

    expect(strong).toBeGreaterThan(weak);
  });
});

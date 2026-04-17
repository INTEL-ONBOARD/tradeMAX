import { CandleAggregator } from "../candleAggregator";

describe("CandleAggregator", () => {
  it("creates candles from ticks", () => {
    const agg = new CandleAggregator("1m", 100);
    const baseTime = 60000; // 1 minute boundary

    agg.addTick(100, baseTime);
    agg.addTick(105, baseTime + 10000);
    agg.addTick(95, baseTime + 20000);
    agg.addTick(102, baseTime + 50000);

    // Still building first candle — no completed candles yet
    expect(agg.length).toBe(0);
    expect(agg.getAllIncludingCurrent()).toHaveLength(1);

    const current = agg.getAllIncludingCurrent()[0];
    expect(current.open).toBe(100);
    expect(current.high).toBe(105);
    expect(current.low).toBe(95);
    expect(current.close).toBe(102);
    expect(current.volume).toBe(4);
  });

  it("closes candle on new timeframe boundary", () => {
    const agg = new CandleAggregator("1m", 100);

    agg.addTick(100, 60000);   // minute 1
    agg.addTick(110, 60000 + 30000);
    agg.addTick(120, 120000);  // minute 2 — closes minute 1

    expect(agg.length).toBe(1);
    const closed = agg.getCandles()[0];
    expect(closed.open).toBe(100);
    expect(closed.high).toBe(110);
    expect(closed.close).toBe(110);
  });

  it("respects max candle buffer", () => {
    const agg = new CandleAggregator("1m", 3);

    for (let i = 0; i < 5; i++) {
      agg.addTick(100 + i, (i + 1) * 60000);
    }

    expect(agg.length).toBeLessThanOrEqual(3);
  });

  it("getClosePrices returns correct values", () => {
    const agg = new CandleAggregator("1m", 100);

    agg.addTick(100, 60000);
    agg.addTick(110, 120000);
    agg.addTick(105, 180000);

    const prices = agg.getClosePrices();
    expect(prices).toHaveLength(2);
    expect(prices[0]).toBe(100);
    expect(prices[1]).toBe(110);
  });

  it("reset clears all data", () => {
    const agg = new CandleAggregator("1m", 100);
    agg.addTick(100, 60000);
    agg.addTick(110, 120000);
    agg.reset();
    expect(agg.length).toBe(0);
    expect(agg.getAllIncludingCurrent()).toHaveLength(0);
  });

  it("getRecentCandles returns last N candles", () => {
    const agg = new CandleAggregator("1m", 100);
    for (let i = 1; i <= 10; i++) {
      agg.addTick(100 + i, i * 60000);
    }
    const recent = agg.getRecentCandles(3);
    expect(recent.length).toBeLessThanOrEqual(3);
  });
});

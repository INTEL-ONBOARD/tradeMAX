import axios from "axios";
import { ADX, ATR, BollingerBands, EMA, MACD, RSI, Stochastic } from "technicalindicators";
import { ENGINE_DEFAULTS, TRADING_PROFILE_DEFAULTS } from "../shared/constants.js";
import type {
  CandleBar,
  MarketSnapshot,
  MultiTimeframeCandles,
  OrderBookSummary,
  PortfolioSnapshot,
  Position,
  SnapshotIntegrity,
  TradingProfile,
  TempoProfileSnapshot,
  EngineConfig,
  FuturesMarketContext,
} from "../shared/types.js";

function toBybitInterval(tf: string): string {
  const map: Record<string, string> = { "1m": "1", "5m": "5", "15m": "15", "1h": "60", "4h": "240" };
  return map[tf] ?? "1";
}

function getProfileSnapshot(engineConfig: EngineConfig): TempoProfileSnapshot {
  const defaults = TRADING_PROFILE_DEFAULTS[engineConfig.tradingProfile];
  return {
    profile: engineConfig.tradingProfile,
    loopIntervalSec: engineConfig.loopIntervalSec || defaults.loopIntervalSec,
    primaryTimeframes: [...defaults.timeframes],
    memoryHorizonHours: defaults.memoryHorizonHours,
    maxHoldMinutes: defaults.maxHoldMinutes,
    critiqueStrictness: engineConfig.critiqueStrictness || defaults.critiqueStrictness,
  };
}

function calculateIndicators(candles: CandleBar[], engineConfig: EngineConfig) {
  const closePrices = candles.map((c) => c.close);
  const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
  const macdValues = MACD.calculate({
    values: closePrices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const ema =
    engineConfig.enableEMA && closePrices.length >= 26
      ? {
          ema12: EMA.calculate({ values: closePrices, period: 12 }).slice(-1)[0] ?? closePrices.at(-1) ?? 0,
          ema26: EMA.calculate({ values: closePrices, period: 26 }).slice(-1)[0] ?? closePrices.at(-1) ?? 0,
        }
      : undefined;

  const bollingerBands =
    engineConfig.enableBollingerBands && closePrices.length >= 20
      ? (() => {
          const latest = BollingerBands.calculate({ values: closePrices, period: 20, stdDev: 2 }).slice(-1)[0];
          return latest ? { upper: latest.upper, middle: latest.middle, lower: latest.lower } : undefined;
        })()
      : undefined;

  const adx =
    engineConfig.enableADX && candles.length >= 14
      ? ADX.calculate({
          high: candles.map((c) => c.high),
          low: candles.map((c) => c.low),
          close: candles.map((c) => c.close),
          period: 14,
        }).slice(-1)[0]?.adx
      : undefined;

  const atr =
    engineConfig.enableATR && candles.length >= 14
      ? ATR.calculate({
          high: candles.map((c) => c.high),
          low: candles.map((c) => c.low),
          close: candles.map((c) => c.close),
          period: 14,
        }).slice(-1)[0]
      : undefined;

  const stochastic =
    engineConfig.enableStochastic && candles.length >= 14
      ? (() => {
          const latest = Stochastic.calculate({
            high: candles.map((c) => c.high),
            low: candles.map((c) => c.low),
            close: candles.map((c) => c.close),
            period: 14,
            signalPeriod: 3,
          }).slice(-1)[0];
          return latest ? { k: latest.k, d: latest.d } : undefined;
        })()
      : undefined;

  const macd = macdValues.slice(-1)[0];

  return {
    rsi: rsiValues.slice(-1)[0] ?? 50,
    macd: {
      line: macd?.MACD ?? 0,
      signal: macd?.signal ?? 0,
      histogram: macd?.histogram ?? 0,
    },
    ema,
    bollingerBands,
    adx,
    atr,
    stochastic,
  };
}

function calculateRealizedVolatilityPct(candles: CandleBar[]): number {
  if (candles.length < 3) return 0;
  const returns: number[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    const prev = candles[i - 1].close;
    const next = candles[i].close;
    if (prev > 0 && next > 0) returns.push(Math.log(next / prev));
  }
  if (returns.length === 0) return 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(Math.min(returns.length, 24)) * 100;
}

function calculatePriceChange1hPct(candles: CandleBar[]): number {
  const latest = candles.at(-1);
  if (!latest) return 0;
  const targetTs = latest.timestamp - 3600_000;
  const base = candles.find((c) => c.timestamp >= targetTs) ?? candles[0];
  if (!base || base.close <= 0) return 0;
  return ((latest.close - base.close) / base.close) * 100;
}

function deriveVolatilityBucket(realizedVolatilityPct: number): "compressed" | "normal" | "expanded" | "violent" {
  if (realizedVolatilityPct < 0.4) return "compressed";
  if (realizedVolatilityPct < 1.1) return "normal";
  if (realizedVolatilityPct < 2.5) return "expanded";
  return "violent";
}

function deriveTempoFit(
  profile: TradingProfile,
  realizedVolatilityPct: number,
  spreadPct: number,
): "aligned" | "stretched" | "hostile" {
  if (spreadPct > 0.3) return "hostile";
  if (profile === "scalp" && realizedVolatilityPct > 2) return "stretched";
  if (profile === "swing" && realizedVolatilityPct < 0.25) return "stretched";
  return "aligned";
}

function buildLiveIntegrity(args: {
  primaryCandles: CandleBar[];
  currentPrice: number;
  orderBook: OrderBookSummary;
  futuresContext: FuturesMarketContext;
  mode: "spot" | "futures";
}): SnapshotIntegrity {
  const warnings: string[] = [];

  if (args.primaryCandles.length < 35) warnings.push("Insufficient primary candles for full analysis");
  if (!(args.currentPrice > 0)) warnings.push("Missing live price");
  if (!(args.orderBook.bestBid > 0 && args.orderBook.bestAsk > 0 && args.orderBook.bids.length > 0 && args.orderBook.asks.length > 0)) {
    warnings.push("Order book unavailable");
  }
  if (
    args.mode === "futures" &&
    !(args.futuresContext.markPrice && args.futuresContext.indexPrice && args.futuresContext.markPrice > 0 && args.futuresContext.indexPrice > 0)
  ) {
    warnings.push("Futures context unavailable");
  }

  return {
    isDataComplete: warnings.length === 0,
    warnings,
  };
}

function deriveRegimeHint(args: {
  indicators: ReturnType<typeof calculateIndicators>;
  candles: CandleBar[];
  realizedVolatilityPct: number;
  priceChange1hPct: number;
  orderBook: OrderBookSummary;
  futuresContext: FuturesMarketContext;
}): "trending_up" | "trending_down" | "ranging" | "breakout" | "volatile" | "unknown" {
  const latest = args.candles.at(-1);
  const ema = args.indicators.ema;
  const macdHistogram = args.indicators.macd.histogram;
  const adx = args.indicators.adx ?? 0;
  const bb = args.indicators.bollingerBands;
  const priceAboveEma = ema ? latest?.close && ema.ema12 >= ema.ema26 : false;
  const priceBelowEma = ema ? latest?.close && ema.ema12 <= ema.ema26 : false;
  const breakoutUp = !!bb && !!latest && latest.close >= bb.upper && args.orderBook.imbalance > 0;
  const breakoutDown = !!bb && !!latest && latest.close <= bb.lower && args.orderBook.imbalance < 0;
  const longPressure = args.futuresContext.longShortPressure === "longs_crowded";
  const shortPressure = args.futuresContext.longShortPressure === "shorts_crowded";
  const bullishMomentum = args.priceChange1hPct > 0.25 || macdHistogram > 0;
  const bearishMomentum = args.priceChange1hPct < -0.25 || macdHistogram < 0;

  if (args.orderBook.spreadPct > 0.3 || args.realizedVolatilityPct > 2.5) return "volatile";
  if (breakoutUp || (args.priceChange1hPct > 0.5 && bullishMomentum)) return "breakout";
  if (breakoutDown || (args.priceChange1hPct < -0.5 && bearishMomentum)) return "breakout";
  if (adx >= 25 && (priceAboveEma || bullishMomentum || longPressure)) return "trending_up";
  if (adx >= 25 && (priceBelowEma || bearishMomentum || shortPressure)) return "trending_down";
  if (Math.abs(args.priceChange1hPct) < 0.2 && adx < 18) return "ranging";
  return "unknown";
}

async function fetchCandles(symbol: string, timeframe: string, limit: number, mode: "spot" | "futures"): Promise<CandleBar[]> {
  const category = mode === "spot" ? "spot" : "linear";
  const { data } = await axios.get("https://api.bybit.com/v5/market/kline", {
    params: {
      category,
      symbol,
      interval: toBybitInterval(timeframe),
      limit,
    },
  });

  const list = (data as { result?: { list?: string[][] } }).result?.list ?? [];
  return list
    .map((row) => ({
      timestamp: parseInt(row[0], 10),
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchOrderBook(symbol: string, mode: "spot" | "futures"): Promise<OrderBookSummary> {
  const { data } = await axios.get("https://api.bybit.com/v5/market/orderbook", {
    params: { category: mode === "spot" ? "spot" : "linear", symbol, limit: 5 },
  });
  const result = (data as { result?: { b?: string[][]; a?: string[][] } }).result;
  const bids = (result?.b ?? []).map(([price, size]) => ({ price: parseFloat(price), size: parseFloat(size) }));
  const asks = (result?.a ?? []).map(([price, size]) => ({ price: parseFloat(price), size: parseFloat(size) }));
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const bidDepthTop5 = bids.reduce((sum, level) => sum + level.size, 0);
  const askDepthTop5 = asks.reduce((sum, level) => sum + level.size, 0);
  const mid = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : 0;
  return {
    spreadPct: mid > 0 ? ((bestAsk - bestBid) / mid) * 100 : 0,
    bestBid,
    bestAsk,
    bidDepthTop5,
    askDepthTop5,
    imbalance: bidDepthTop5 + askDepthTop5 > 0 ? (bidDepthTop5 - askDepthTop5) / (bidDepthTop5 + askDepthTop5) : 0,
    bids,
    asks,
  };
}

async function fetchFuturesContext(symbol: string, mode: "spot" | "futures"): Promise<FuturesMarketContext> {
  if (mode === "spot") {
    return {
      fundingRate: null,
      nextFundingTime: null,
      openInterest: null,
      openInterestChangePct: null,
      basisPct: null,
      markPrice: null,
      indexPrice: null,
      liquidationDistancePctLong: null,
      liquidationDistancePctShort: null,
      longShortPressure: "unknown",
    };
  }

  const [{ data: tickers }, { data: oi }, { data: funding }] = await Promise.allSettled([
    axios.get("https://api.bybit.com/v5/market/tickers", { params: { category: "linear", symbol } }),
    axios.get("https://api.bybit.com/v5/market/open-interest", { params: { category: "linear", symbol, intervalTime: "5min", limit: 2 } }),
    axios.get("https://api.bybit.com/v5/market/funding/history", { params: { category: "linear", symbol, limit: 1 } }),
  ]).then((results) => results.map((result) => (result.status === "fulfilled" ? result.value : { data: {} })));

  const ticker = (tickers as { result?: { list?: Array<Record<string, string>> } }).result?.list?.[0] ?? {};
  const oiRows = (oi as { result?: { list?: Array<Record<string, string>> } }).result?.list ?? [];
  const latestOi = parseFloat(oiRows[0]?.openInterest ?? "0");
  const previousOi = parseFloat(oiRows[1]?.openInterest ?? "0");
  const fundingRow = (funding as { result?: { list?: Array<Record<string, string>> } }).result?.list?.[0] ?? {};
  const markPrice = parseFloat(ticker.markPrice ?? "0") || null;
  const indexPrice = parseFloat(ticker.indexPrice ?? "0") || null;
  const basisPct =
    markPrice && indexPrice && indexPrice > 0 ? ((markPrice - indexPrice) / indexPrice) * 100 : null;
  const openInterestChangePct =
    latestOi > 0 && previousOi > 0 ? ((latestOi - previousOi) / previousOi) * 100 : null;

  return {
    fundingRate: parseFloat(fundingRow.fundingRate ?? ticker.fundingRate ?? "0") || null,
    nextFundingTime: ticker.nextFundingTime ? new Date(parseInt(ticker.nextFundingTime, 10)).toISOString() : null,
    openInterest: latestOi || null,
    openInterestChangePct,
    basisPct,
    markPrice,
    indexPrice,
    liquidationDistancePctLong: markPrice ? 2.5 : null,
    liquidationDistancePctShort: markPrice ? 2.5 : null,
    longShortPressure:
      openInterestChangePct === null
        ? "unknown"
        : openInterestChangePct > 3
          ? "longs_crowded"
          : openInterestChangePct < -3
            ? "shorts_crowded"
            : "balanced",
  };
}

export async function buildLiveMarketSnapshot(args: {
  symbol: string;
  mode: "spot" | "futures";
  portfolio: PortfolioSnapshot;
  openPositions: Position[];
  engineConfig: EngineConfig;
}): Promise<MarketSnapshot> {
  const profile = getProfileSnapshot(args.engineConfig);
  const timeframes = Array.from(new Set([args.engineConfig.candleTimeframe, ...profile.primaryTimeframes]));
  const candleSets = await Promise.all(timeframes.map((timeframe) => fetchCandles(args.symbol, timeframe, 80, args.mode).catch(() => [])));
  const primaryCandles = candleSets[0] ?? [];
  const orderBook = await fetchOrderBook(args.symbol, args.mode).catch(() => ({
    spreadPct: 0,
    bestBid: 0,
    bestAsk: 0,
    bidDepthTop5: 0,
    askDepthTop5: 0,
    imbalance: 0,
    bids: [],
    asks: [],
  }));
  const futuresContext = await fetchFuturesContext(args.symbol, args.mode).catch(() => ({
    fundingRate: null,
    nextFundingTime: null,
    openInterest: null,
    openInterestChangePct: null,
    basisPct: null,
    markPrice: null,
    indexPrice: null,
    liquidationDistancePctLong: null,
    liquidationDistancePctShort: null,
    longShortPressure: "unknown" as const,
  }));

  const realizedVolatilityPct = calculateRealizedVolatilityPct(primaryCandles.slice(-40));
  const volatilityBucket = deriveVolatilityBucket(realizedVolatilityPct);
  const indicators = calculateIndicators(primaryCandles, args.engineConfig);
  const priceChange1hPct = calculatePriceChange1hPct(primaryCandles);
  const regimeHint = deriveRegimeHint({
    indicators,
    candles: primaryCandles,
    realizedVolatilityPct,
    priceChange1hPct,
    orderBook,
    futuresContext,
  });

  return {
    symbol: args.symbol,
    exchange: "bybit",
    mode: args.mode,
    profile,
    timestamp: new Date().toISOString(),
    currentPrice: primaryCandles.at(-1)?.close ?? 0,
    regimeHint,
    portfolio: args.portfolio,
    openPositions: args.openPositions,
    recentCandles: primaryCandles.slice(-20),
    multiTimeframeCandles: timeframes.map((timeframe, index): MultiTimeframeCandles => ({
      timeframe,
      candles: candleSets[index].slice(-40),
    })),
    indicators,
    orderBook,
    futuresContext,
    realizedVolatilityPct,
    priceChange1hPct,
    tempoState: {
      volatilityBucket,
      tempoFit: deriveTempoFit(args.engineConfig.tradingProfile, realizedVolatilityPct, orderBook.spreadPct),
    },
    integrity: buildLiveIntegrity({
      primaryCandles,
      currentPrice: primaryCandles.at(-1)?.close ?? 0,
      orderBook,
      futuresContext,
      mode: args.mode,
    }),
  };
}

export function buildReplayMarketSnapshot(args: {
  symbol: string;
  mode: "spot" | "futures";
  portfolio: PortfolioSnapshot;
  openPositions: Position[];
  engineConfig: EngineConfig;
  primaryCandles: CandleBar[];
  multiTimeframeCandles?: MultiTimeframeCandles[];
  timestamp?: string;
}): MarketSnapshot {
  const profile = getProfileSnapshot(args.engineConfig);
  const primary = args.primaryCandles;
  const currentPrice = primary.at(-1)?.close ?? 0;
  const recentCandles = primary.slice(-20);
  const last = primary.at(-1);
  const range = last ? Math.max(0, last.high - last.low) : 0;
  const orderBook: OrderBookSummary = {
    spreadPct: Math.max(0.01, (range / Math.max(currentPrice, 1)) * 100 * 0.15),
    bestBid: currentPrice * 0.9999,
    bestAsk: currentPrice * 1.0001,
    bidDepthTop5: recentCandles.reduce((sum, c) => sum + c.volume, 0) * 0.48,
    askDepthTop5: recentCandles.reduce((sum, c) => sum + c.volume, 0) * 0.52,
    imbalance: -0.04,
    bids: [],
    asks: [],
  };
  const realizedVolatilityPct = calculateRealizedVolatilityPct(primary.slice(-40));
  const volatilityBucket = deriveVolatilityBucket(realizedVolatilityPct);
  const indicators = calculateIndicators(primary, args.engineConfig);
  const priceChange1hPct = calculatePriceChange1hPct(primary);
  const regimeHint = deriveRegimeHint({
    indicators,
    candles: primary,
    realizedVolatilityPct,
    priceChange1hPct,
    orderBook,
    futuresContext: {
      fundingRate: null,
      nextFundingTime: null,
      openInterest: null,
      openInterestChangePct: null,
      basisPct: null,
      markPrice: null,
      indexPrice: null,
      liquidationDistancePctLong: null,
      liquidationDistancePctShort: null,
      longShortPressure: "unknown",
    },
  });

  return {
    symbol: args.symbol,
    exchange: "bybit",
    mode: args.mode,
    profile,
    timestamp: args.timestamp ?? new Date(primary.at(-1)?.timestamp ?? Date.now()).toISOString(),
    currentPrice,
    regimeHint,
    portfolio: args.portfolio,
    openPositions: args.openPositions,
    recentCandles,
    multiTimeframeCandles: args.multiTimeframeCandles ?? [{ timeframe: args.engineConfig.candleTimeframe, candles: primary.slice(-40) }],
    indicators,
    orderBook,
    futuresContext: args.mode === "spot"
      ? {
          fundingRate: null,
          nextFundingTime: null,
          openInterest: null,
          openInterestChangePct: null,
          basisPct: null,
          markPrice: null,
          indexPrice: null,
          liquidationDistancePctLong: null,
          liquidationDistancePctShort: null,
          longShortPressure: "unknown",
        }
      : {
          fundingRate: 0,
          nextFundingTime: null,
          openInterest: recentCandles.reduce((sum, c) => sum + c.volume, 0),
          openInterestChangePct: null,
          basisPct: 0,
          markPrice: currentPrice,
          indexPrice: currentPrice,
          liquidationDistancePctLong: 2.5,
          liquidationDistancePctShort: 2.5,
          longShortPressure: "balanced",
        },
    realizedVolatilityPct,
    priceChange1hPct,
    tempoState: {
      volatilityBucket,
      tempoFit: deriveTempoFit(args.engineConfig.tradingProfile, realizedVolatilityPct, orderBook.spreadPct),
    },
    integrity: {
      isDataComplete: primary.length >= 35 && currentPrice > 0,
      warnings: [
        ...(primary.length >= 35 ? [] : ["Replay window too short for full feature set"]),
        ...(currentPrice > 0 ? [] : ["Missing replay price"]),
      ],
    },
  };
}

export function getDefaultEngineConfig(): EngineConfig {
  return JSON.parse(JSON.stringify(ENGINE_DEFAULTS));
}

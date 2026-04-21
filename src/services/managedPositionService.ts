import type { Position } from "../shared/types.js";

export function buildManagedPositions(args: {
  openTrades: Array<{
    symbol: string;
    side: "BUY" | "SELL";
    entryPrice: number;
    quantity: number;
  }>;
  latestPrices?: Map<string, number>;
}): Position[] {
  return args.openTrades.map((trade) => {
    const markPrice = args.latestPrices?.get(trade.symbol.toUpperCase()) ?? trade.entryPrice;
    const unrealizedPnl = trade.side === "BUY"
      ? (markPrice - trade.entryPrice) * trade.quantity
      : (trade.entryPrice - markPrice) * trade.quantity;

    return {
      symbol: trade.symbol.toUpperCase(),
      side: trade.side,
      entryPrice: trade.entryPrice,
      markPrice,
      quantity: trade.quantity,
      unrealizedPnl,
      liquidationPrice: null,
    };
  });
}

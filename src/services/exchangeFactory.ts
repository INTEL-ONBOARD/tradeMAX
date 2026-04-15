import { BinanceService } from "./binanceService.js";
import { BybitService } from "./bybitService.js";

export type ExchangeServiceInstance = BinanceService | BybitService;

export function createExchangeService(exchange: "binance" | "bybit"): ExchangeServiceInstance {
  if (exchange === "binance") return new BinanceService();
  return new BybitService();
}

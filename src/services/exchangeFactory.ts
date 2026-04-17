import { BybitService } from "./bybitService.js";
import { PaperExchangeService } from "./paperExchangeService.js";

export type ExchangeServiceInstance = BybitService | PaperExchangeService;

export function createExchangeService(exchange: "bybit" | "paper"): ExchangeServiceInstance {
  if (exchange === "paper") return new PaperExchangeService();
  return new BybitService();
}

import { createExchangeService } from "../services/exchangeFactory.js";
import type { ExchangeServiceInstance } from "../services/exchangeFactory.js";
import type { PaperExchangeService } from "../services/paperExchangeService.js";
import { decrypt } from "../services/encryptionService.js";
import { getUserDoc } from "../services/authService.js";
import { logger } from "../services/loggerService.js";
import type { PortfolioSnapshot, Position, MarketTick } from "../shared/types.js";

type AccountCallbacks = {
  onPortfolio: (snap: PortfolioSnapshot) => void;
  onPositions: (positions: Position[]) => void;
  onMarketTick: (tick: MarketTick) => void;
};

class AccountWatcher {
  private exchange: ExchangeServiceInstance | null = null;
  private running = false;
  private callbacks: AccountCallbacks | null = null;
  private positionsCache: Position[] = [];

  setCallbacks(cb: AccountCallbacks): void {
    this.callbacks = cb;
  }

  clearCallbacks(): void {
    this.callbacks = null;
  }

  async start(userId: string): Promise<void> {
    if (this.running) return;
    if (!this.callbacks) return;

    try {
      const user = await getUserDoc(userId);
      const isPaper = user.selectedExchange === "paper";
      const keys = user.exchangeKeys.bybit;
      const userSalt = user.encryptionSalt || undefined;
      const decryptedKey = isPaper || !keys.apiKey ? "" : decrypt(keys.apiKey, userSalt);
      const decryptedSecret = isPaper || !keys.apiSecret ? "" : decrypt(keys.apiSecret, userSalt);

      if (!isPaper && (!keys.apiKey || !keys.apiSecret)) return;

      this.exchange = createExchangeService(user.selectedExchange);
      await this.exchange.initialize(
        { apiKey: decryptedKey, apiSecret: decryptedSecret },
        user.tradingMode,
      );

      if (isPaper && "setStartingBalance" in this.exchange) {
        (this.exchange as PaperExchangeService).setStartingBalance(
          user.engineConfig.paperStartingBalance ?? 10000,
        );
      }

      // Fetch initial state via REST
      const portfolio = await this.exchange.getBalance();
      this.callbacks.onPortfolio(portfolio);

      const positions = await this.exchange.getOpenPositions();
      this.positionsCache = positions;
      this.callbacks.onPositions(positions);

      if (!isPaper && "startAccountStream" in this.exchange) {
        // Start real-time WebSocket streams for live Bybit accounts.
        this.exchange.startAccountStream(
          (snap) => this.callbacks?.onPortfolio(snap),
          (delta) => {
            // Merge delta into cache by symbol rather than replacing the whole array.
            // Bybit sends only changed positions, so unaffected positions must be kept.
            for (const updated of delta) {
              const idx = this.positionsCache.findIndex((p) => p.symbol === updated.symbol);
              if (idx !== -1) {
                this.positionsCache[idx] = updated;
              } else {
                this.positionsCache.push(updated);
              }
            }
            this.positionsCache = this.positionsCache.filter((p) => p.quantity > 0);
            this.callbacks?.onPositions([...this.positionsCache]);
          },
        );
      }

      // Start market ticker stream for live price data
      const symbol = user.engineConfig.tradingSymbol || "BTCUSDT";
      this.exchange.startTickerStream(symbol, (tick) => {
        this.callbacks?.onMarketTick(tick);
      });

      this.running = true;
      await logger.info("SYSTEM", `Account watcher started for ${user.selectedExchange} (${symbol})`);
    } catch (err) {
      await logger.warn("SYSTEM", `Account watcher failed to start: ${err}`);
      this.cleanup();
    }
  }

  async stop(): Promise<void> {
    const wasActive = this.running || this.exchange !== null;
    if (!wasActive) return;
    this.cleanup();
    if (wasActive) {
      await logger.info("SYSTEM", "Account watcher stopped");
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private cleanup(): void {
    if (this.exchange) {
      if ("stopAccountStream" in this.exchange) {
        this.exchange.stopAccountStream();
      }
      this.exchange.destroy();
      this.exchange = null;
    }
    this.positionsCache = [];
    this.running = false;
  }
}

export const accountWatcher = new AccountWatcher();

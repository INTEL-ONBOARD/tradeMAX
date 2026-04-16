import { createExchangeService } from "../services/exchangeFactory.js";
import type { BinanceService } from "../services/binanceService.js";
import type { BybitService } from "../services/bybitService.js";
import { decrypt } from "../services/encryptionService.js";
import { getUserDoc } from "../services/authService.js";
import { logger } from "../services/loggerService.js";
import type { PortfolioSnapshot, Position } from "../shared/types.js";

type RealExchange = BinanceService | BybitService;

type AccountCallbacks = {
  onPortfolio: (snap: PortfolioSnapshot) => void;
  onPositions: (positions: Position[]) => void;
};

class AccountWatcher {
  private exchange: RealExchange | null = null;
  private running = false;
  private callbacks: AccountCallbacks | null = null;

  setCallbacks(cb: AccountCallbacks): void {
    this.callbacks = cb;
  }

  async start(userId: string): Promise<void> {
    if (this.running) return;
    if (!this.callbacks) return;

    try {
      const user = await getUserDoc(userId);

      if (user.selectedExchange === "paper") return;

      const keys = user.exchangeKeys[user.selectedExchange];
      if (!keys.apiKey || !keys.apiSecret) return;

      const userSalt = user.encryptionSalt || undefined;
      const decryptedKey = decrypt(keys.apiKey, userSalt);
      const decryptedSecret = decrypt(keys.apiSecret, userSalt);

      this.exchange = createExchangeService(user.selectedExchange) as RealExchange;
      await this.exchange.initialize(
        { apiKey: decryptedKey, apiSecret: decryptedSecret },
        user.tradingMode,
      );

      // Fetch initial state via REST
      const portfolio = await this.exchange.getBalance();
      this.callbacks.onPortfolio(portfolio);

      const positions = await this.exchange.getOpenPositions();
      this.callbacks.onPositions(positions);

      // Start real-time WebSocket stream
      await this.exchange.startAccountStream(
        (snap) => this.callbacks?.onPortfolio(snap),
        (pos) => this.callbacks?.onPositions(pos),
      );

      this.running = true;
      await logger.info("SYSTEM", `Account watcher started for ${user.selectedExchange}`);
    } catch (err) {
      await logger.warn("SYSTEM", `Account watcher failed to start: ${err}`);
      this.cleanup();
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.cleanup();
    await logger.info("SYSTEM", "Account watcher stopped");
  }

  isRunning(): boolean {
    return this.running;
  }

  private cleanup(): void {
    if (this.exchange) {
      this.exchange.stopAccountStream();
      this.exchange.destroy();
      this.exchange = null;
    }
    this.running = false;
  }
}

export const accountWatcher = new AccountWatcher();

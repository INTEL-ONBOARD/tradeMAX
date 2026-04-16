import { ipcMain, Notification, type BrowserWindow } from "electron";
import { IPC, STREAM } from "../shared/constants.js";
import { apiKeysSchema, claudeKeySchema, settingsUpdateSchema, agentStartSchema } from "../shared/validators.js";
import * as auth from "../services/authService.js";
import { logger } from "../services/loggerService.js";
import { tradeEngine } from "../services/tradeEngine.js";
import { safetyService } from "../services/safetyService.js";
import { alertService } from "../services/alertService.js";
import { TradeModel } from "../db/models/Trade.js";
import { LogModel } from "../db/models/Log.js";
import { saveSession, clearSession } from "./sessionManager.js";
import { createExchangeService } from "../services/exchangeFactory.js";
import { decrypt } from "../services/encryptionService.js";
import { mapExchangeError } from "./exchangeErrors.js";
import { accountWatcher } from "./accountWatcher.js";
import { runBacktest } from "../services/backtestService.js";

let currentUserId: string | null = null;

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function setCurrentUserId(id: string | null): void {
  currentUserId = id;
  if (id) logger.setUserId(id);
  else logger.clearUserId();
}

let mainWindow: BrowserWindow | null = null;

const send = (channel: string, data: unknown) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
};

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

export function registerIpcHandlers(): void {

  // ─── Account Watcher (real-time balance/positions/prices) ──
  accountWatcher.setCallbacks({
    onPortfolio: (snap) => send(STREAM.PORTFOLIO, snap),
    onPositions: (positions) => send(STREAM.POSITIONS, positions),
    onMarketTick: (tick) => send(STREAM.MARKET_TICK, tick),
  });

  // ─── Auth ────────────────────────────────────────────
  ipcMain.handle(IPC.AUTH_REGISTER, async (_e, data) => {
    const result = await auth.register(data);
    saveSession(result.token);
    setCurrentUserId(result.session.userId);
    await logger.info("AUTH", `User registered: ${result.session.email}`);
    return { session: result.session, settings: result.settings };
  });

  ipcMain.handle(IPC.AUTH_LOGIN, async (_e, data) => {
    const result = await auth.login(data);
    saveSession(result.token);
    setCurrentUserId(result.session.userId);
    await logger.info("AUTH", `User logged in: ${result.session.email}`);
    return { session: result.session, settings: result.settings };
  });

  ipcMain.handle(IPC.AUTH_LOGOUT, async () => {
    if (tradeEngine.isRunning()) await tradeEngine.stop();
    await accountWatcher.stop();
    setCurrentUserId(null);
    clearSession();
    await logger.info("AUTH", "User logged out");
  });

  ipcMain.handle(IPC.AUTH_SESSION, async () => {
    return null;
  });

  // ─── Settings ────────────────────────────────────────
  ipcMain.handle(IPC.SETTINGS_SAVE_API_KEYS, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = apiKeysSchema.parse(data);

    // Paper exchange doesn't use real API keys — skip validation and saving
    if (parsed.exchange === "paper") {
      await logger.info("SYSTEM", "Paper exchange selected — no API key validation needed");
      const settings = await auth.getSettings(currentUserId);
      return { settings, portfolio: null };
    }

    const user = await auth.getUserDoc(currentUserId);
    const exchange = createExchangeService(parsed.exchange);

    try {
      await exchange.initialize(
        { apiKey: parsed.apiKey, apiSecret: parsed.apiSecret },
        user.tradingMode,
      );
      const portfolio = await exchange.getBalance();

      const settings = await auth.saveApiKeys(
        currentUserId,
        parsed.exchange,
        parsed.apiKey,
        parsed.apiSecret,
      );
      await logger.info("SYSTEM", `API keys validated and saved for ${parsed.exchange}`);

      // Start real-time account streaming if agent isn't running
      if (!tradeEngine.isRunning()) {
        await accountWatcher.stop();
        await accountWatcher.start(currentUserId!);
      }

      return { settings, portfolio };
    } catch (err) {
      const friendlyMessage = mapExchangeError(err);
      await logger.warn("SYSTEM", `API key validation failed for ${parsed.exchange}: ${err}`);
      throw new Error(friendlyMessage);
    } finally {
      exchange.destroy();
    }
  });

  ipcMain.handle(IPC.SETTINGS_SAVE_CLAUDE_KEY, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = claudeKeySchema.parse(data);
    const updated = await auth.saveClaudeKey(currentUserId, parsed.claudeApiKey);
    await logger.info("SYSTEM", "Claude API key saved");
    return updated;
  });

  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");
    return auth.getSettings(currentUserId);
  });

  ipcMain.handle(IPC.SETTINGS_UPDATE, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = settingsUpdateSchema.parse(data);
    const settings = await auth.updateSettings(currentUserId, parsed);
    return settings;
  });

  // ─── Portfolio & Positions ───────────────────────────
  ipcMain.handle(IPC.PORTFOLIO_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");

    const user = await auth.getUserDoc(currentUserId);
    if (user.selectedExchange === "paper") return null;

    const keys = user.exchangeKeys[user.selectedExchange];
    if (!keys.apiKey || !keys.apiSecret) return null;

    const userSalt = user.encryptionSalt || undefined;
    const exchange = createExchangeService(user.selectedExchange);

    try {
      await exchange.initialize(
        { apiKey: decrypt(keys.apiKey, userSalt), apiSecret: decrypt(keys.apiSecret, userSalt) },
        user.tradingMode,
      );
      return await exchange.getBalance();
    } catch (err) {
      await logger.warn("SYSTEM", `Portfolio fetch failed: ${err}`);
      return null;
    } finally {
      exchange.destroy();
    }
  });

  ipcMain.handle(IPC.POSITIONS_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");

    const user = await auth.getUserDoc(currentUserId);
    if (user.selectedExchange === "paper") return [];

    const keys = user.exchangeKeys[user.selectedExchange];
    if (!keys.apiKey || !keys.apiSecret) return [];

    const userSalt = user.encryptionSalt || undefined;
    const exchange = createExchangeService(user.selectedExchange);

    try {
      await exchange.initialize(
        { apiKey: decrypt(keys.apiKey, userSalt), apiSecret: decrypt(keys.apiSecret, userSalt) },
        user.tradingMode,
      );
      return await exchange.getOpenPositions();
    } catch (err) {
      await logger.warn("SYSTEM", `Positions fetch failed: ${err}`);
      return [];
    } finally {
      exchange.destroy();
    }
  });

  // ─── Trades ──────────────────────────────────────────
  ipcMain.handle(IPC.TRADES_HISTORY, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const limit = (data as { limit?: number })?.limit ?? 50;
    const trades = await TradeModel.find({ userId: currentUserId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return trades.map((t) => ({
      _id: t._id.toString(),
      userId: t.userId.toString(),
      symbol: t.symbol,
      side: t.side,
      type: t.type,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      quantity: t.quantity,
      pnl: t.pnl,
      status: t.status,
      source: t.source,
      exchange: t.exchange,
      mode: t.mode,
      aiDecision: t.aiDecision,
      riskCheck: t.riskCheck,
      createdAt: t.createdAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? null,
    }));
  });

  // ─── AI ──────────────────────────────────────────────
  ipcMain.handle(IPC.AI_LAST_DECISION, async () => {
    return tradeEngine.getLastAIDecision();
  });

  // ─── Agent Control ───────────────────────────────────
  ipcMain.handle(IPC.AGENT_START, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = agentStartSchema.parse(data);

    if (safetyService.getState().frozen) {
      safetyService.resetFreeze();
    }

    tradeEngine.setCallbacks({
      onMarketTick: (tick) => send(STREAM.MARKET_TICK, tick),
      onPortfolio: (snap) => send(STREAM.PORTFOLIO, snap),
      onPositions: (positions) => send(STREAM.POSITIONS, positions),
      onTradeExecuted: (trade) => send(STREAM.TRADE_EXECUTED, trade),
      onAIDecision: (decision) => send(STREAM.AI_DECISION, decision),
      onAgentStatus: (status) => send(STREAM.AGENT_STATUS, status),
    });

    // Wire alert service for in-app + native notifications
    alertService.setCallback((alert) => {
      send(STREAM.NOTIFICATION, {
        id: Date.now().toString(),
        type: alert.type,
        title: alert.title,
        message: alert.message,
        read: false,
        timestamp: new Date().toISOString(),
      });
      // Native OS notification for risk/system alerts only
      if (alert.type === "risk" || alert.type === "system") {
        new Notification({ title: alert.title, body: alert.message }).show();
      }
    });

    // Stop account watcher — agent's own streaming takes over
    await accountWatcher.stop();

    await tradeEngine.start(currentUserId, parsed.symbol);
    await auth.updateSettings(currentUserId, { agentModeEnabled: true });
  });

  ipcMain.handle(IPC.AGENT_STOP, async () => {
    alertService.clearCallback();
    await tradeEngine.stop();
    if (currentUserId) {
      await auth.updateSettings(currentUserId, { agentModeEnabled: false });
      // Resume real-time account watcher now that agent stopped
      await accountWatcher.start(currentUserId);
    }
  });

  ipcMain.handle(IPC.AGENT_KILL_SWITCH, async () => {
    alertService.clearCallback();
    await tradeEngine.killSwitch();
    if (currentUserId) {
      await auth.updateSettings(currentUserId, { agentModeEnabled: false });
      await accountWatcher.start(currentUserId);
    }
  });

  ipcMain.handle(IPC.AGENT_RESET_FREEZE, async () => {
    safetyService.resetFreeze();
    await logger.info("SYSTEM", "User manually reset safety freeze");
  });

  // ─── Exchange Pairs ──────────────────────────────────
  ipcMain.handle(IPC.EXCHANGE_PAIRS, async () => {
    if (!currentUserId) throw new Error("Not authenticated");

    const user = await auth.getUserDoc(currentUserId);
    const selectedExchange = user.selectedExchange;

    // Paper mode uses hardcoded pairs, no keys needed
    if (selectedExchange === "paper") {
      return {
        configured: true,
        pairs: ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT", "LINKUSDT", "LTCUSDT"],
      };
    }

    const keys = user.exchangeKeys[selectedExchange];
    if (!keys.apiKey || !keys.apiSecret) {
      return { configured: false, pairs: [] };
    }

    try {
      const userSalt = user.encryptionSalt || undefined;
      const decryptedKey = decrypt(keys.apiKey, userSalt);
      const decryptedSecret = decrypt(keys.apiSecret, userSalt);

      const exchange = createExchangeService(selectedExchange);
      await exchange.initialize({ apiKey: decryptedKey, apiSecret: decryptedSecret }, user.tradingMode);

      const pairs = await exchange.getSymbols();
      exchange.destroy();
      return { configured: true, pairs };
    } catch (err) {
      await logger.error("SYSTEM", `Failed to fetch exchange pairs: ${err}`);
      return { configured: true, pairs: [] };
    }
  });

  // ─── Backtest ─────────────────────────────────────────
  ipcMain.handle(IPC.BACKTEST_RUN, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");

    const user = await auth.getUserDoc(currentUserId);
    const config = data as {
      symbol: string;
      startDate: string;
      endDate: string;
      startingBalance: number;
    };

    const userSalt = user.encryptionSalt || undefined;
    const claudeApiKey = user.claudeApiKey ? decrypt(user.claudeApiKey, userSalt) : undefined;

    const result = await runBacktest(
      {
        symbol: config.symbol,
        exchange: user.selectedExchange === "paper" ? "binance" : user.selectedExchange,
        mode: user.tradingMode,
        startDate: config.startDate,
        endDate: config.endDate,
        startingBalance: config.startingBalance,
        riskProfile: user.riskProfile,
        engineConfig: user.engineConfig,
        claudeApiKey,
      },
      (progress) => send(STREAM.BACKTEST_PROGRESS, progress),
    );

    return result;
  });

  // ─── Logs ────────────────────────────────────────────
  ipcMain.handle(IPC.LOGS_RECENT, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const limit = (data as { limit?: number })?.limit ?? 100;
    const logs = await LogModel.find({ userId: currentUserId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return logs.map((l) => ({
      _id: l._id.toString(),
      userId: l.userId.toString(),
      level: l.level,
      category: l.category,
      message: l.message,
      meta: l.meta,
      timestamp: l.timestamp.toISOString(),
    }));
  });

  // ─── Log streaming (always active) ──────────────────
  logger.on("log", (entry) => send(STREAM.LOG, entry));
}

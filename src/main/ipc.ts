import { ipcMain, Notification, type BrowserWindow } from "electron";
import { IPC, STREAM } from "../shared/constants.js";
import {
  apiKeysSchema,
  openaiKeySchema,
  settingsUpdateSchema,
  agentStartSchema,
  closePositionSchema,
  selfReviewRequestSchema,
  profileConfigSaveSchema,
  profileConfigIdSchema,
} from "../shared/validators.js";
import * as auth from "../services/authService.js";
import { logger } from "../services/loggerService.js";
import { tradeEngine } from "../services/tradeEngine.js";
import { safetyService } from "../services/safetyService.js";
import { alertService } from "../services/alertService.js";
import { TradeModel } from "../db/models/Trade.js";
import { LogModel } from "../db/models/Log.js";
import { saveSession, clearSession } from "./sessionManager.js";
import { createExchangeService } from "../services/exchangeFactory.js";
import { decrypt, clearKeyCache } from "../services/encryptionService.js";
import { mapExchangeError } from "./exchangeErrors.js";
import { accountWatcher } from "./accountWatcher.js";
import { runBacktest } from "../services/backtestService.js";
import { runSelfReview } from "../services/aiPipelineService.js";
import {
  applyProfileConfig,
  deleteProfileConfig,
  listProfileConfigs,
  saveProfileConfig,
} from "../services/profileConfigService.js";
import type { BacktestRunInput } from "../shared/types.js";

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

    // Start the idle watcher for the selected exchange when the account can support it.
    if (result.settings.selectedExchange === "paper" || result.settings.hasBybitKeys) {
      accountWatcher.start(result.session.userId).catch(() => {});
    }

    return { session: result.session, settings: result.settings };
  });

  ipcMain.handle(IPC.AUTH_LOGOUT, async () => {
    if (tradeEngine.isRunning()) await tradeEngine.stop();
    await accountWatcher.stop();
    clearKeyCache();
    setCurrentUserId(null);
    clearSession();
    await logger.info("AUTH", "User logged out");
  });

  ipcMain.handle(IPC.AUTH_SESSION, async () => {
    const { getToken } = await import("./sessionManager.js");
    const token = getToken();
    if (!token) return null;

    const result = await auth.restoreSession(token);
    if (!result) return null;

    setCurrentUserId(result.session.userId);

    if (result.settings.selectedExchange === "paper" || result.settings.hasBybitKeys) {
      accountWatcher.start(result.session.userId).catch(() => {});
    }

    return { session: result.session, settings: result.settings };
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

  ipcMain.handle(IPC.SETTINGS_SAVE_OPENAI_KEY, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = openaiKeySchema.parse(data);

    // Validate the key by making a lightweight API call.
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${parsed.openaiApiKey}`,
        },
      });

      if (!res.ok) {
        throw new Error(`OPENAI_VALIDATION_${res.status}`);
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("401") || msg.includes("authentication") || msg.includes("invalid")) {
        throw new Error("Invalid OpenAI API key");
      }
      if (msg.includes("permission") || msg.includes("403")) {
        throw new Error("OpenAI API key lacks required permissions");
      }
      if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("fetch")) {
        throw new Error("Could not connect to OpenAI API. Check your internet connection.");
      }
      throw new Error(`OpenAI API key validation failed: ${msg}`);
    }

    const updated = await auth.saveOpenAIKey(currentUserId, parsed.openaiApiKey);
    await logger.info("SYSTEM", "OpenAI API key validated and saved");
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

    const shouldRestartWatcher =
      parsed.selectedExchange !== undefined ||
      parsed.engineConfig?.tradingSymbol !== undefined ||
      (settings.selectedExchange === "paper" && parsed.engineConfig?.paperStartingBalance !== undefined);

    if (shouldRestartWatcher && !tradeEngine.isRunning()) {
      await accountWatcher.stop();
      if (settings.selectedExchange === "paper" || settings.hasBybitKeys) {
        accountWatcher.start(currentUserId).catch(() => {});
      }
    }

    return settings;
  });

  // ─── Portfolio & Positions ───────────────────────────
  ipcMain.handle(IPC.PORTFOLIO_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");

    const user = await auth.getUserDoc(currentUserId);
    if (user.selectedExchange === "paper") {
      const exchange = createExchangeService("paper");
      try {
        await exchange.initialize({ apiKey: "", apiSecret: "" }, user.tradingMode);
        if ("setStartingBalance" in exchange) {
          exchange.setStartingBalance(user.engineConfig.paperStartingBalance ?? 10000);
        }
        return await exchange.getBalance();
      } finally {
        exchange.destroy();
      }
    }

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
    if (user.selectedExchange === "paper") {
      const exchange = createExchangeService("paper");
      try {
        await exchange.initialize({ apiKey: "", apiSecret: "" }, user.tradingMode);
        if ("setStartingBalance" in exchange) {
          exchange.setStartingBalance(user.engineConfig.paperStartingBalance ?? 10000);
        }
        return await exchange.getOpenPositions();
      } finally {
        exchange.destroy();
      }
    }

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

  ipcMain.handle(IPC.POSITION_CLOSE, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");

    const parsed = closePositionSchema.parse(data);
    const user = await auth.getUserDoc(currentUserId);
    const userSalt = user.encryptionSalt || undefined;
    const exchange = createExchangeService(user.selectedExchange);

    const keys = user.exchangeKeys.bybit;
    const isPaper = user.selectedExchange === "paper";
    const apiKey = isPaper || !keys.apiKey ? "" : decrypt(keys.apiKey, userSalt);
    const apiSecret = isPaper || !keys.apiSecret ? "" : decrypt(keys.apiSecret, userSalt);

    try {
      await exchange.initialize({ apiKey, apiSecret }, user.tradingMode);
      if (isPaper && "setStartingBalance" in exchange) {
        exchange.setStartingBalance(user.engineConfig.paperStartingBalance ?? 10000);
      }

      const positionsBefore = await exchange.getOpenPositions();
      const currentPosition = positionsBefore.find(
        (position) => position.symbol === parsed.symbol && position.side === parsed.side,
      );
      const orderResult = await exchange.closePosition(parsed.symbol, parsed.side, parsed.quantity);
      const exitPrice = orderResult.price || currentPosition?.markPrice || currentPosition?.entryPrice || 0;

      const openTrade = await TradeModel.findOne({
        userId: currentUserId,
        symbol: parsed.symbol,
        side: parsed.side,
        status: "OPEN",
      }).sort({ createdAt: -1 });

      if (openTrade) {
        const pnl = parsed.side === "BUY"
          ? (exitPrice - openTrade.entryPrice) * openTrade.quantity
          : (openTrade.entryPrice - exitPrice) * openTrade.quantity;

        openTrade.exitPrice = exitPrice;
        openTrade.pnl = pnl;
        openTrade.status = "CLOSED";
        openTrade.closedAt = new Date();
        await openTrade.save();

        send(STREAM.TRADE_EXECUTED, {
          _id: openTrade._id.toString(),
          userId: openTrade.userId.toString(),
          symbol: openTrade.symbol,
          side: openTrade.side as "BUY" | "SELL",
          type: openTrade.type as "MARKET" | "LIMIT",
          entryPrice: openTrade.entryPrice,
          exitPrice,
          quantity: openTrade.quantity,
          pnl,
          status: "CLOSED",
          source: openTrade.source as "AI" | "MANUAL" | "SYSTEM",
          exchange: openTrade.exchange as "bybit" | "paper",
          mode: openTrade.mode as "spot" | "futures",
          aiDecision: openTrade.aiDecision,
          riskCheck: openTrade.riskCheck,
          pipelineRun: openTrade.pipelineRun ?? null,
          memoryReferences: openTrade.memoryReferences ?? [],
          createdAt: openTrade.createdAt.toISOString(),
          closedAt: openTrade.closedAt.toISOString(),
        });
      }

      await logger.info("TRADE", `Manual position close: ${parsed.symbol} ${parsed.side} qty=${parsed.quantity}`, {
        exitPrice,
        exchange: user.selectedExchange,
      });

      return { success: true, exitPrice };
    } finally {
      exchange.destroy();
    }
  });

  // ─── Exchange Closed PnL ─────────────────────────────
  ipcMain.handle(IPC.EXCHANGE_CLOSED_PNL, async () => {
    if (!currentUserId) throw new Error("Not authenticated");

    const user = await auth.getUserDoc(currentUserId);
    if (user.selectedExchange === "paper") {
      const paperTrades = await TradeModel.find({
        userId: currentUserId,
        exchange: "paper",
        status: "CLOSED",
      })
        .sort({ closedAt: 1 })
        .lean();

      return paperTrades.map((t) => ({
        symbol: t.symbol,
        side: t.side as "BUY" | "SELL",
        quantity: t.quantity,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice ?? 0,
        pnl: t.pnl ?? 0,
        closedAt: t.closedAt?.toISOString() ?? t.createdAt.toISOString(),
      }));
    }

    const keys = user.exchangeKeys.bybit;
    if (!keys.apiKey || !keys.apiSecret) return [];

    const userSalt = user.encryptionSalt || undefined;
    const exchange = createExchangeService(user.selectedExchange);

    try {
      await exchange.initialize(
        { apiKey: decrypt(keys.apiKey, userSalt), apiSecret: decrypt(keys.apiSecret, userSalt) },
        user.tradingMode,
      );
      return await (exchange as any).getClosedPnl(200);
    } catch (err) {
      await logger.warn("SYSTEM", `Closed PnL fetch failed: ${err}`);
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
      pipelineRun: t.pipelineRun ?? null,
      memoryReferences: t.memoryReferences ?? [],
      createdAt: t.createdAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? null,
    }));
  });

  // ─── AI ──────────────────────────────────────────────
  ipcMain.handle(IPC.AI_LAST_DECISION, async () => {
    return tradeEngine.getLastAIDecision();
  });

  ipcMain.handle(IPC.AI_LIST_MODELS, async () => {
    if (!currentUserId) throw new Error("Not authenticated");
    const user = await auth.getUserDoc(currentUserId);
    const encryptedAIKey = user.openaiApiKey || user.claudeApiKey;
    if (!encryptedAIKey) throw new Error("No OpenAI API key configured");
    const userSalt = user.encryptionSalt || undefined;
    const apiKey = decrypt(encryptedAIKey, userSalt);
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
    const json = await res.json() as { data: { id: string; object: string; owned_by: string }[] };

    return json.data
      .map((m) => ({ id: m.id, name: m.id }))
      .filter((m) => m.id.startsWith("gpt-"))
      .sort((a, b) => a.id.localeCompare(b.id));
  });

  ipcMain.handle(IPC.AI_SELF_REVIEW, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = selfReviewRequestSchema.parse(data ?? {});
    const user = await auth.getUserDoc(currentUserId);
    const encryptedAIKey = user.openaiApiKey || user.claudeApiKey;
    const userSalt = user.encryptionSalt || undefined;
    const openaiApiKey = encryptedAIKey ? decrypt(encryptedAIKey, userSalt) : undefined;
    const activeSymbol = tradeEngine.isRunning()
      ? tradeEngine.getSymbol()
      : (user.engineConfig.tradingSymbol || "BTCUSDT");

    const result = await runSelfReview({
      userId: currentUserId,
      symbol: activeSymbol,
      engineConfig: user.engineConfig,
      openaiApiKey,
      force: parsed.force ?? false,
    });

    if (result) {
      send(STREAM.NOTIFICATION, {
        id: result.reviewId,
        type: "ai",
        title: "Self review complete",
        message: result.summary,
        read: false,
        timestamp: result.createdAt,
      });
      await logger.info("AI", `Self review complete for ${result.symbol}`, {
        reviewId: result.reviewId,
        reviewedTradeCount: result.reviewedTradeCount,
        reviewedJournalCount: result.reviewedJournalCount,
      });
    }

    return result;
  });

  // ─── Profile Presets ────────────────────────────────
  ipcMain.handle(IPC.PROFILE_LIST, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const profile = (data as { profile?: "scalp" | "intraday" | "swing" | "custom" } | undefined)?.profile;
    return listProfileConfigs(currentUserId, profile);
  });

  ipcMain.handle(IPC.PROFILE_SAVE, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = profileConfigSaveSchema.parse(data);
    return saveProfileConfig({
      userId: currentUserId,
      name: parsed.name,
      profile: parsed.profile,
      config: parsed.config,
    });
  });

  ipcMain.handle(IPC.PROFILE_APPLY, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = profileConfigIdSchema.parse(data);
    return applyProfileConfig({
      userId: currentUserId,
      profileConfigId: parsed.id,
    });
  });

  ipcMain.handle(IPC.PROFILE_DELETE, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = profileConfigIdSchema.parse(data);
    return deleteProfileConfig({
      userId: currentUserId,
      profileConfigId: parsed.id,
    });
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
    const config = data as BacktestRunInput;

    const userSalt = user.encryptionSalt || undefined;
    const encryptedAIKey = user.openaiApiKey || user.claudeApiKey;
    const openaiApiKey = encryptedAIKey ? decrypt(encryptedAIKey, userSalt) : undefined;

    const result = await runBacktest(
      {
        userId: currentUserId,
        symbol: config.symbol,
        exchange: "bybit",
        mode: user.tradingMode,
        startDate: config.startDate,
        endDate: config.endDate,
        startingBalance: config.startingBalance,
        walkForwardSweep: config.walkForwardSweep ?? false,
        riskProfile: user.riskProfile,
        engineConfig: user.engineConfig,
        openaiApiKey,
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

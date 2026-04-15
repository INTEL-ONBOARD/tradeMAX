import { EventEmitter } from "node:events";
import { RSI, MACD } from "technicalindicators";
import { TradeModel } from "../db/models/Trade.js";
import { UserModel } from "../db/models/User.js";
import { DEFAULT_RISK_PROFILE } from "../shared/constants.js";
import { type AIDecision, type PortfolioSnapshot, type Position, type TradeCandidate, type TradeMode } from "../shared/types.js";
import { AIService } from "./aiService.js";
import { BinanceService } from "./binanceService.js";
import { BybitService } from "./bybitService.js";
import { decryptSecret } from "./encryptionService.js";
import { writeLog } from "./loggerService.js";
import { RiskEngine } from "./riskEngine.js";
import { canTrade, emergencyShutdown, freezeTrading, registerClosedTrade, updateBalance } from "./safetyService.js";

interface RuntimeState {
    loopActive: boolean;
    latestPrice: number;
    priceHistory: number[];
    latestDecision: AIDecision | null;
}

const stateByUser = new Map<string, RuntimeState>();
export const tradeEngineEvents = new EventEmitter();

function getState(userId: string): RuntimeState {
    const existing = stateByUser.get(userId);
    if (existing) {
        return existing;
    }
    const created: RuntimeState = {
        loopActive: false,
        latestPrice: 0,
        priceHistory: [],
        latestDecision: null
    };
    stateByUser.set(userId, created);
    return created;
}

export class TradeEngine {
    private riskEngine = new RiskEngine();
    private aiService = new AIService();

    private async getExchangeClients(userId: string) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error("User not found");
        }
        return {
            user,
            binance: new BinanceService(
                decryptSecret(user.encryptedApiKeys?.binanceKey || ""),
                decryptSecret(user.encryptedApiKeys?.binanceSecret || "")
            ),
            bybit: new BybitService(
                decryptSecret(user.encryptedApiKeys?.bybitKey || ""),
                decryptSecret(user.encryptedApiKeys?.bybitSecret || "")
            )
        };
    }

    async getPortfolio(userId: string, mode: TradeMode): Promise<PortfolioSnapshot> {
        const { binance, bybit } = await this.getExchangeClients(userId);
        const [binanceBal, bybitBal] = await Promise.all([binance.getAccountBalance(mode), bybit.getAccountBalance(mode)]);
        const totalBalance = binanceBal + bybitBal;

        const trades = await TradeModel.find({ userId }).sort({ createdAt: -1 }).limit(200);
        const now = Date.now();
        const dayAgo = now - 24 * 60 * 60 * 1000;
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

        const dailyPnl = trades.filter((t) => new Date(t.createdAt).getTime() > dayAgo).reduce((sum, t) => sum + Number(t.pnl || 0), 0);
        const weeklyPnl = trades.filter((t) => new Date(t.createdAt).getTime() > weekAgo).reduce((sum, t) => sum + Number(t.pnl || 0), 0);

        updateBalance(userId, totalBalance);

        return {
            totalBalance,
            dailyPnl,
            weeklyPnl,
            allocation: [
                { asset: "Binance", value: binanceBal, percent: totalBalance > 0 ? binanceBal / totalBalance : 0 },
                { asset: "Bybit", value: bybitBal, percent: totalBalance > 0 ? bybitBal / totalBalance : 0 }
            ]
        };
    }

    async getPositions(userId: string, mode: TradeMode): Promise<Position[]> {
        const { binance, bybit } = await this.getExchangeClients(userId);
        const [a, b] = await Promise.all([binance.getOpenPositions(mode), bybit.getOpenPositions(mode)]);
        return [...a, ...b];
    }

    async getRecentTrades(userId: string) {
        return TradeModel.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    }

    async getLatestDecision(userId: string): Promise<AIDecision | null> {
        return getState(userId).latestDecision;
    }

    async setAgentMode(userId: string, enabled: boolean): Promise<void> {
        await UserModel.findByIdAndUpdate(userId, { $set: { agentModeEnabled: enabled } });
        await writeLog({ level: "INFO", category: "AGENT", message: `Agent mode ${enabled ? "enabled" : "disabled"}`, userId });
    }

    async killSwitch(userId: string, symbols: string[]): Promise<void> {
        const { user, binance, bybit } = await this.getExchangeClients(userId);
        const mode = user.tradingMode as TradeMode;

        emergencyShutdown(userId);
        for (const symbol of symbols) {
            await Promise.all([binance.cancelAll(symbol, mode), bybit.cancelAll(symbol, mode)]);
        }

        await this.setAgentMode(userId, false);
        getState(userId).loopActive = false;

        await writeLog({ level: "WARN", category: "KILL_SWITCH", message: "Emergency kill switch triggered", userId });
    }

    async start(userId: string, symbol = "BTCUSDT"): Promise<void> {
        const state = getState(userId);
        state.loopActive = true;

        const { user, binance } = await this.getExchangeClients(userId);
        const mode = user.tradingMode as TradeMode;

        binance.startTickerStream(symbol, (price) => {
            state.latestPrice = price;
            state.priceHistory.push(price);
            if (state.priceHistory.length > 250) {
                state.priceHistory.shift();
            }
            tradeEngineEvents.emit("market", { userId, symbol, price, ts: Date.now() });
        });

        const interval = setInterval(async () => {
            if (!state.loopActive) {
                clearInterval(interval);
                binance.stopTickerStream();
                return;
            }

            const safety = canTrade(userId);
            if (!safety.ok) {
                await writeLog({ level: "WARN", category: "SAFETY", message: "Trading blocked by safety", userId, context: { reasons: safety.reasons } });
                return;
            }

            const current = await UserModel.findById(userId).lean();
            if (!current || !current.agentModeEnabled) {
                return;
            }

            if (state.priceHistory.length < 35) {
                return;
            }

            const closes = state.priceHistory;
            const rsiValues = RSI.calculate({ period: 14, values: closes });
            const macdValues = MACD.calculate({
                values: closes,
                fastPeriod: 12,
                slowPeriod: 26,
                signalPeriod: 9,
                SimpleMAOscillator: false,
                SimpleMASignal: false
            });

            const rsi = rsiValues[rsiValues.length - 1] || 50;
            const macd = macdValues[macdValues.length - 1]?.MACD || 0;
            const volume = 1;

            const portfolio = await this.getPortfolio(userId, mode);
            const positions = await this.getPositions(userId, mode);
            const drawdownPct = updateBalance(userId, portfolio.totalBalance).drawdownPct;

            const decision = await this.aiService.decide({
                marketPrice: state.latestPrice,
                indicators: { rsi, macd, volume },
                portfolio: { ...portfolio },
                openPositions: positions
            });
            state.latestDecision = decision;
            tradeEngineEvents.emit("ai", { userId, decision, ts: Date.now() });

            if (decision.decision === "HOLD") {
                await writeLog({ level: "INFO", category: "AI", message: "AI decision HOLD", userId, context: decision as unknown as Record<string, unknown> });
                return;
            }

            const trade: TradeCandidate = {
                exchange: "binance",
                symbol,
                mode,
                side: decision.decision as "BUY" | "SELL",
                quantity: 0.001,
                entry: decision.entry,
                stopLoss: decision.stop_loss,
                takeProfit: decision.take_profit,
                confidence: decision.confidence,
                spreadPct: 0.001,
                volatilityPct: Math.abs((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]),
                leverage: mode === "futures" ? 2 : 1,
                source: "Claude"
            };

            const risk = this.riskEngine.validateTrade({
                trade,
                profile: current.riskProfile || DEFAULT_RISK_PROFILE,
                portfolio,
                positions,
                dailyRealizedLossPct: portfolio.totalBalance > 0 ? Math.abs(Math.min(0, portfolio.dailyPnl)) / portfolio.totalBalance : 0,
                drawdownPct
            });

            if (!risk.approved) {
                await TradeModel.create({
                    userId,
                    exchange: trade.exchange,
                    symbol: trade.symbol,
                    side: trade.side,
                    orderType: "MARKET",
                    quantity: trade.quantity,
                    entry: trade.entry,
                    pnl: 0,
                    source: trade.source,
                    status: "REJECTED",
                    metadata: { reasons: risk.reasons, decision }
                });
                await writeLog({ level: "WARN", category: "RISK", message: "Trade rejected", userId, context: { reasons: risk.reasons } });
                return;
            }

            try {
                await binance.placeOrder({
                    symbol: trade.symbol,
                    side: trade.side,
                    quantity: trade.quantity,
                    mode,
                    leverage: trade.leverage
                });

                await TradeModel.create({
                    userId,
                    exchange: trade.exchange,
                    symbol: trade.symbol,
                    side: trade.side,
                    orderType: "MARKET",
                    quantity: trade.quantity,
                    entry: trade.entry,
                    pnl: 0,
                    source: trade.source,
                    status: "OPEN",
                    metadata: { decision }
                });

                await writeLog({ level: "INFO", category: "EXECUTION", message: "Trade executed", userId, context: trade as unknown as Record<string, unknown> });
            } catch (error: any) {
                freezeTrading(userId);
                await writeLog({ level: "ERROR", category: "EXECUTION", message: "Execution failed, trading frozen", userId, context: { error: error?.message || "unknown" } });
            }
        }, 8000);
    }

    async stop(userId: string): Promise<void> {
        getState(userId).loopActive = false;
        await writeLog({ level: "INFO", category: "AGENT", message: "Agent loop stopped", userId });
    }

    async markClosedTrade(userId: string, tradeId: string, exit: number): Promise<void> {
        const trade = await TradeModel.findById(tradeId);
        if (!trade) {
            return;
        }
        const pnl = (exit - trade.entry) * trade.quantity * (trade.side === "BUY" ? 1 : -1);
        trade.exit = exit;
        trade.pnl = pnl;
        trade.status = "CLOSED";
        await trade.save();

        registerClosedTrade(userId, pnl);
    }
}

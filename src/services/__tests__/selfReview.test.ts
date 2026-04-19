const mockTradeFind = jest.fn();
const mockDecisionJournalFind = jest.fn();
const mockDecisionJournalDeleteMany = jest.fn();
const mockMemoryNoteFindOne = jest.fn();
const mockMemoryNoteCreate = jest.fn();
const mockMemoryNoteDeleteMany = jest.fn();
const mockMarketSnapshotDeleteMany = jest.fn();

jest.mock("../../db/models/Trade.js", () => ({
  TradeModel: {
    find: mockTradeFind,
  },
}));

jest.mock("../../db/models/DecisionJournal.js", () => ({
  DecisionJournalModel: {
    find: mockDecisionJournalFind,
    deleteMany: mockDecisionJournalDeleteMany,
  },
}));

jest.mock("../../db/models/MemoryNote.js", () => ({
  MemoryNoteModel: {
    findOne: mockMemoryNoteFindOne,
    create: mockMemoryNoteCreate,
    deleteMany: mockMemoryNoteDeleteMany,
  },
}));

jest.mock("../../db/models/MarketSnapshot.js", () => ({
  MarketSnapshotModel: {
    deleteMany: mockMarketSnapshotDeleteMany,
  },
}));

jest.mock("../loggerService.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { runSelfReview } from "../aiPipelineService.js";
import { getDefaultEngineConfig } from "../marketSnapshotService.js";
import type { EngineConfig } from "../../shared/types.js";

function makeQueryChain(rows: unknown[]) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
}

describe("runSelfReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("builds and persists a local self-review memory note", async () => {
    const engineConfig = {
      ...getDefaultEngineConfig(),
      tradingProfile: "intraday",
    } as EngineConfig;

    const now = new Date("2025-04-19T12:00:00.000Z");
    jest.useFakeTimers();
    jest.setSystemTime(now);

    mockMemoryNoteFindOne.mockReturnValue(makeQueryChain(null));
    mockTradeFind.mockReturnValue(makeQueryChain([
      {
        _id: "trade-1",
        symbol: "BTCUSDT",
        side: "BUY",
        pnl: 125.5,
        regime: "trending_up",
        volatilityBucket: "normal",
        reason: "TAKE_PROFIT",
        closedAt: new Date("2025-04-19T11:20:00.000Z"),
        pipelineRun: {
          marketAssessment: { regime: "trending_up", volatilityBucket: "normal" },
          finalDecision: { reason: "Trend continuation" },
        },
      },
      {
        _id: "trade-2",
        symbol: "BTCUSDT",
        side: "SELL",
        pnl: -42.75,
        regime: "volatile",
        volatilityBucket: "expanded",
        reason: "STOP_LOSS",
        closedAt: new Date("2025-04-19T11:05:00.000Z"),
        pipelineRun: {
          marketAssessment: { regime: "volatile", volatilityBucket: "expanded" },
          finalDecision: { reason: "Late fade" },
        },
      },
    ]));
    mockDecisionJournalFind.mockReturnValue(makeQueryChain([
      {
        regime: "volatile",
        volatilityBucket: "expanded",
        createdAt: new Date("2025-04-19T11:40:00.000Z"),
        review: { summary: "Late entries hurt" },
        executionResult: { blockedReason: "ENTRY_DEVIATION" },
      },
    ]));
    mockDecisionJournalDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockMemoryNoteCreate.mockResolvedValue({
      _id: "note-1",
    });
    mockMemoryNoteDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockMarketSnapshotDeleteMany.mockResolvedValue({ deletedCount: 0 });

    const result = await runSelfReview({
      userId: "user-1",
      symbol: "BTCUSDT",
      engineConfig,
      force: false,
    });

    expect(result).not.toBeNull();
    expect(result?.reviewId).toBe("note-1");
    expect(result?.reviewedTradeCount).toBe(2);
    expect(result?.reviewedJournalCount).toBe(1);
    expect(mockMemoryNoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        symbol: "BTCUSDT",
        profile: "intraday",
        tags: expect.arrayContaining(["self_review", "intraday"]),
      }),
    );

  });
});

const mockDecisionJournalFind = jest.fn();
const mockMemoryNoteFind = jest.fn();

jest.mock("../../db/models/DecisionJournal.js", () => ({
  DecisionJournalModel: {
    find: mockDecisionJournalFind,
  },
}));

jest.mock("../../db/models/MemoryNote.js", () => ({
  MemoryNoteModel: {
    find: mockMemoryNoteFind,
  },
}));

jest.mock("../loggerService.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { retrieveRelevantMemories } from "../aiPipelineService";
import type { EngineConfig, MarketSnapshot } from "../../shared/types";

function makeQueryChain(rows: unknown[]) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
}

describe("aiPipelineService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("bounds memory retrieval to the replay snapshot timestamp", async () => {
    const snapshotTimestamp = "2025-03-15T12:00:00.000Z";
    const snapshot = {
      symbol: "BTCUSDT",
      timestamp: snapshotTimestamp,
      profile: { profile: "intraday" },
    } as MarketSnapshot;

    mockDecisionJournalFind.mockReturnValue(makeQueryChain([]));
    mockMemoryNoteFind.mockReturnValue(makeQueryChain([]));

    const engineConfig = {
      memoryLookbackDays: 30,
      memoryRetrievalCount: 5,
    } as EngineConfig;

    const result = await retrieveRelevantMemories({
      userId: "user-1",
      snapshot,
      engineConfig,
    });

    expect(result).toEqual([]);

    const journalQuery = mockDecisionJournalFind.mock.calls[0][0] as {
      createdAt: { $gte: Date; $lte: Date };
    };
    const noteQuery = mockMemoryNoteFind.mock.calls[0][0] as {
      createdAt: { $gte: Date; $lte: Date };
    };

    const expectedEnd = new Date(snapshotTimestamp);
    const expectedStart = new Date(expectedEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    expect(journalQuery.createdAt.$lte.toISOString()).toBe(expectedEnd.toISOString());
    expect(journalQuery.createdAt.$gte.toISOString()).toBe(expectedStart.toISOString());
    expect(noteQuery.createdAt.$lte.toISOString()).toBe(expectedEnd.toISOString());
    expect(noteQuery.createdAt.$gte.toISOString()).toBe(expectedStart.toISOString());
  });
});

const mockProfileConfigFind = jest.fn();
const mockProfileConfigFindOneAndUpdate = jest.fn();
const mockProfileConfigDeleteOne = jest.fn();
const mockProfileConfigFindOne = jest.fn();
const mockGetUserDoc = jest.fn();
const mockUpdateSettings = jest.fn();

jest.mock("../../db/models/ProfileConfig.js", () => ({
  ProfileConfigModel: {
    find: mockProfileConfigFind,
    findOneAndUpdate: mockProfileConfigFindOneAndUpdate,
    deleteOne: mockProfileConfigDeleteOne,
    findOne: mockProfileConfigFindOne,
  },
}));

jest.mock("../authService.js", () => ({
  getUserDoc: mockGetUserDoc,
  updateSettings: mockUpdateSettings,
}));

import { applyProfileConfig, deleteProfileConfig, listProfileConfigs, saveProfileConfig } from "../profileConfigService.js";
import { getDefaultEngineConfig } from "../marketSnapshotService.js";
import type { EngineConfig } from "../../shared/types.js";

function makeQueryChain(rows: unknown[]) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
}

function makeSingleQueryChain(row: unknown) {
  return {
    lean: jest.fn().mockResolvedValue(row),
  };
}

describe("profileConfigService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("saves, lists, applies, and deletes profile presets", async () => {
    const userEngineConfig = {
      ...getDefaultEngineConfig(),
      tradingProfile: "intraday",
      loopIntervalSec: 12,
      stageModels: {
        marketAnalyst: "gpt-5.4-mini",
        tradeArchitect: "gpt-5.4-mini",
        executionCritic: "gpt-5.4-mini",
        postTradeReviewer: "gpt-5.4-mini",
      },
    } as EngineConfig;

    mockGetUserDoc.mockResolvedValue({ engineConfig: userEngineConfig });
    mockProfileConfigFindOneAndUpdate.mockReturnValue(makeSingleQueryChain({
      _id: "preset-1",
      userId: "user-1",
      name: "intraday baseline",
      profile: "intraday",
      config: {
        ...userEngineConfig,
        loopIntervalSec: 9,
      },
      createdAt: new Date("2025-04-19T10:00:00.000Z"),
      updatedAt: new Date("2025-04-19T10:30:00.000Z"),
    }));
    mockProfileConfigFind.mockReturnValue(makeQueryChain([
      {
        _id: "preset-1",
        userId: "user-1",
        name: "intraday baseline",
        profile: "intraday",
        config: {
          ...userEngineConfig,
          loopIntervalSec: 9,
        },
        createdAt: new Date("2025-04-19T10:00:00.000Z"),
        updatedAt: new Date("2025-04-19T10:30:00.000Z"),
      },
    ]));
    mockProfileConfigFindOne.mockReturnValue(makeSingleQueryChain({
      _id: "preset-1",
      userId: "user-1",
      name: "intraday baseline",
      profile: "intraday",
      config: {
        ...userEngineConfig,
        loopIntervalSec: 9,
      },
      createdAt: new Date("2025-04-19T10:00:00.000Z"),
      updatedAt: new Date("2025-04-19T10:30:00.000Z"),
    }));
    mockUpdateSettings.mockResolvedValue({
      selectedExchange: "paper",
      tradingMode: "spot",
      riskProfile: { maxRiskPct: 2, maxDailyLossPct: 5, maxOpenPositions: 3, minConfidence: 0.75, maxLeverage: 10 },
      engineConfig: userEngineConfig,
      agentModeEnabled: false,
      themePreference: "light",
      hasOpenAIKey: true,
      hasBybitKeys: false,
    });
    mockProfileConfigDeleteOne.mockResolvedValue({ deletedCount: 1 });

    const saved = await saveProfileConfig({
      userId: "user-1",
      name: "intraday baseline",
      profile: "intraday",
      config: {
        loopIntervalSec: 9,
      } as Partial<EngineConfig>,
    });

    expect(saved.name).toBe("intraday baseline");
    expect(saved.profile).toBe("intraday");
    expect(mockProfileConfigFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-1", profile: "intraday", name: "intraday baseline" },
      expect.objectContaining({
        config: expect.objectContaining({
          loopIntervalSec: 9,
          tradingProfile: "intraday",
        }),
      }),
      expect.any(Object),
    );

    const list = await listProfileConfigs("user-1", "intraday");
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("intraday baseline");

    const applied = await applyProfileConfig({
      userId: "user-1",
      profileConfigId: "preset-1",
    });
    expect(applied.settings.engineConfig.tradingProfile).toBe("intraday");
    expect(mockUpdateSettings).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        engineConfig: expect.objectContaining({
          loopIntervalSec: 9,
        }),
      }),
    );

    const deleted = await deleteProfileConfig({
      userId: "user-1",
      profileConfigId: "preset-1",
    });
    expect(deleted.deleted).toBe(true);
  });
});

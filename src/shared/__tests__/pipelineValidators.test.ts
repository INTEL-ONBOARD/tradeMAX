import {
  executionReviewSchema,
  marketAssessmentSchema,
  postTradeReviewSchema,
  tradeProposalSchema,
} from "../validators";

describe("pipeline validators", () => {
  it("accepts valid market assessment payloads", () => {
    const parsed = marketAssessmentSchema.parse({
      regime: "trending_up",
      volatilityBucket: "normal",
      tempoFit: "aligned",
      directionalBias: "LONG",
      conviction: 0.74,
      noTrade: false,
      noTradeReasons: [],
      keyDrivers: ["higher highs", "positive funding not extreme"],
      riskFlags: ["moderate spread"],
      summary: "Trend continuation environment",
    });

    expect(parsed.directionalBias).toBe("LONG");
  });

  it("rejects malformed trade proposals", () => {
    const parsed = tradeProposalSchema.safeParse({
      action: "BUY",
      confidence: 0.8,
      entryZone: { min: 100, max: 101, preferred: 100.5 },
      leverage: 5,
      sizeUsd: 1000,
      stopLoss: 0,
      takeProfit: 105,
      trailingStopPct: null,
      maxHoldMinutes: 60,
      exitStyle: "fixed",
      thesis: "Breakout continuation",
      invalidation: "Breakout fails",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts valid execution reviews and post-trade reviews", () => {
    expect(
      executionReviewSchema.parse({
        verdict: "DOWNGRADE",
        finalAction: "BUY",
        finalConfidence: 0.61,
        adjustedLeverage: 3,
        adjustedSizeUsd: 750,
        entryPrice: 100,
        stopLoss: 97,
        takeProfit: 106,
        trailingStopPct: 1.5,
        maxHoldMinutes: 120,
        reasons: ["Spread acceptable", "Reduced size due to crowding"],
        exchangeWarnings: ["Funding elevated"],
      }).verdict,
    ).toBe("DOWNGRADE");

    expect(
      postTradeReviewSchema.parse({
        outcomeLabel: "good",
        decisionQualityScore: 0.8,
        executionQualityScore: 0.72,
        riskDisciplineScore: 0.9,
        lessons: ["Trailing exit preserved gains"],
        memoryNote: "Avoid oversizing when funding expands quickly.",
        summary: "Solid trade with disciplined risk.",
      }).outcomeLabel,
    ).toBe("good");
  });
});

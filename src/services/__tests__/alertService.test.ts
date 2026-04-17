import { alertService } from "../alertService";

describe("alertService", () => {
  let received: Array<{ type: string; title: string; message: string }>;

  beforeEach(() => {
    received = [];
    alertService.setCallback((alert) => received.push(alert));
    alertService.resetDaily();
  });

  afterEach(() => {
    alertService.clearCallback();
  });

  it("emits trade executed alert", () => {
    alertService.onTradeExecuted("BTCUSDT", "BUY", 0.5, 50000);
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("trade");
    expect(received[0].title).toBe("Trade Executed");
  });

  it("emits position closed with correct type based on PnL", () => {
    alertService.onPositionClosed("BTCUSDT", "TAKE_PROFIT", 150);
    expect(received[0].type).toBe("trade");

    alertService.onPositionClosed("ETHUSDT", "STOP_LOSS", -80);
    expect(received[1].type).toBe("risk");
  });

  it("emits safety freeze alert", () => {
    alertService.onSafetyFreeze("CONSECUTIVE_LOSSES");
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("risk");
    expect(received[0].message).toContain("CONSECUTIVE_LOSSES");
  });

  it("emits daily loss warning only once", () => {
    alertService.onDailyLossWarning(400, 500);
    alertService.onDailyLossWarning(420, 500);
    alertService.onDailyLossWarning(450, 500);
    expect(received).toHaveLength(1); // deduped
  });

  it("resets daily loss flag", () => {
    alertService.onDailyLossWarning(400, 500);
    expect(received).toHaveLength(1);
    alertService.resetDaily();
    alertService.onDailyLossWarning(400, 500);
    expect(received).toHaveLength(2);
  });

  it("skips HOLD decisions", () => {
    alertService.onAIDecision("HOLD", 0.5, "no signal");
    expect(received).toHaveLength(0);
  });

  it("emits non-HOLD AI decisions", () => {
    alertService.onAIDecision("BUY", 0.85, "strong signal");
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("ai");
  });

  it("emits API error only near threshold", () => {
    alertService.onApiError("bybit", 1, 3);
    expect(received).toHaveLength(0); // not near threshold

    alertService.onApiError("bybit", 2, 3);
    expect(received).toHaveLength(1); // at threshold - 1
  });

  it("does nothing without callback", () => {
    alertService.clearCallback();
    alertService.onTradeExecuted("BTCUSDT", "BUY", 0.5, 50000);
    // should not throw
  });
});

import { notificationService } from "../notificationService";

describe("notificationService", () => {
  const inApp: Array<{ type: string; title: string; message: string }> = [];
  const native: Array<{ type: string; title: string; message: string }> = [];

  beforeEach(() => {
    inApp.length = 0;
    native.length = 0;
    notificationService.setDispatch({
      onInApp: (notification) => inApp.push(notification),
      onNative: (notification) => native.push(notification),
    });
  });

  afterEach(() => {
    notificationService.clearDispatch();
    notificationService.clearSettings();
  });

  it("emits in-app and native notifications when enabled", () => {
    notificationService.configure({
      enabled: true,
      desktopEnabled: true,
      trade: true,
      risk: true,
      system: true,
      ai: true,
    });

    notificationService.notify({
      type: "trade",
      title: "Trade opened",
      message: "BUY BTCUSDT",
    });

    expect(inApp).toHaveLength(1);
    expect(native).toHaveLength(1);
    expect(inApp[0].title).toBe("Trade opened");
  });

  it("filters categories and suppresses desktop popups when disabled", () => {
    notificationService.configure({
      enabled: true,
      desktopEnabled: false,
      trade: false,
      risk: true,
      system: true,
      ai: false,
    });

    notificationService.notify({
      type: "trade",
      title: "Trade opened",
      message: "BUY BTCUSDT",
    });
    notificationService.notify({
      type: "risk",
      title: "Risk warning",
      message: "Daily loss limit nearing",
    });

    expect(inApp).toHaveLength(1);
    expect(inApp[0].type).toBe("risk");
    expect(native).toHaveLength(0);
  });
});

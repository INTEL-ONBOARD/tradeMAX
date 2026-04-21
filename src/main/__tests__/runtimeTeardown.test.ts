const mockUpdateSettings = jest.fn();
const mockAlertClearCallback = jest.fn();
const mockTradeIsRunning = jest.fn();
const mockTradeClearCallbacks = jest.fn();
const mockTradeStop = jest.fn();
const mockAccountClearCallbacks = jest.fn();
const mockAccountStop = jest.fn();

jest.mock("../../services/authService.js", () => ({
  updateSettings: mockUpdateSettings,
}));

jest.mock("../../services/alertService.js", () => ({
  alertService: {
    clearCallback: mockAlertClearCallback,
  },
}));

jest.mock("../../services/tradeEngine.js", () => ({
  tradeEngine: {
    isRunning: mockTradeIsRunning,
    clearCallbacks: mockTradeClearCallbacks,
    stop: mockTradeStop,
  },
}));

jest.mock("../accountWatcher.js", () => ({
  accountWatcher: {
    clearCallbacks: mockAccountClearCallbacks,
    stop: mockAccountStop,
  },
}));

describe("runtimeTeardown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTradeIsRunning.mockReturnValue(true);
    mockTradeStop.mockResolvedValue(undefined);
    mockAccountStop.mockResolvedValue(undefined);
    mockUpdateSettings.mockResolvedValue(undefined);
  });

  it("stops live emitters and disables agent mode after renderer loss", async () => {
    const { teardownMainProcessStreams } = await import("../runtimeTeardown");

    await teardownMainProcessStreams("user-1", "render-process-gone");

    expect(mockAlertClearCallback).toHaveBeenCalledTimes(1);
    expect(mockTradeClearCallbacks).toHaveBeenCalledTimes(1);
    expect(mockAccountClearCallbacks).toHaveBeenCalledTimes(1);
    expect(mockTradeStop).toHaveBeenCalledTimes(1);
    expect(mockAccountStop).toHaveBeenCalledTimes(1);
    expect(mockUpdateSettings).toHaveBeenCalledWith("user-1", { agentModeEnabled: false });

    expect(mockTradeClearCallbacks.mock.invocationCallOrder[0]).toBeLessThan(
      mockTradeStop.mock.invocationCallOrder[0],
    );
    expect(mockAccountClearCallbacks.mock.invocationCallOrder[0]).toBeLessThan(
      mockAccountStop.mock.invocationCallOrder[0],
    );
  });

  it("skips agent-mode persistence when the agent is already stopped", async () => {
    mockTradeIsRunning.mockReturnValue(false);
    const { teardownMainProcessStreams } = await import("../runtimeTeardown");

    await teardownMainProcessStreams("user-1", "window-closed");

    expect(mockTradeStop).toHaveBeenCalledTimes(1);
    expect(mockAccountStop).toHaveBeenCalledTimes(1);
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });
});

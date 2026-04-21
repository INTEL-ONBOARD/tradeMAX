import { EventEmitter } from "node:events";
import { createWindowRuntime } from "../windowLifecycle";

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

class FakeWebContents extends EventEmitter {
  destroyed = false;
  crashed = false;
  send = jest.fn();

  isDestroyed(): boolean {
    return this.destroyed;
  }

  isCrashed(): boolean {
    return this.crashed;
  }
}

class FakeBrowserWindow extends EventEmitter {
  destroyed = false;

  constructor(public webContents: FakeWebContents) {
    super();
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }
}

describe("windowLifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns false when no window is registered", () => {
    const teardown = jest.fn();
    const runtime = createWindowRuntime(teardown);

    expect(runtime.safeSend("stream:log", { ok: true })).toBe(false);
    expect(teardown).not.toHaveBeenCalled();
  });

  it("returns false when the window is destroyed", () => {
    const teardown = jest.fn();
    const runtime = createWindowRuntime(teardown);
    const webContents = new FakeWebContents();
    const window = new FakeBrowserWindow(webContents);
    window.destroyed = true;

    runtime.setMainWindow(window);

    expect(runtime.safeSend("stream:log", { ok: true })).toBe(false);
    expect(webContents.send).not.toHaveBeenCalled();
  });

  it("returns false when the renderer is crashed", () => {
    const teardown = jest.fn();
    const runtime = createWindowRuntime(teardown);
    const webContents = new FakeWebContents();
    const window = new FakeBrowserWindow(webContents);
    webContents.crashed = true;

    runtime.setMainWindow(window);

    expect(runtime.safeSend("stream:log", { ok: true })).toBe(false);
    expect(webContents.send).not.toHaveBeenCalled();
  });

  it("swallows recoverable send failures and triggers teardown", async () => {
    const teardown = jest.fn().mockResolvedValue(undefined);
    const runtime = createWindowRuntime(teardown);
    const webContents = new FakeWebContents();
    const window = new FakeBrowserWindow(webContents);
    const error = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });

    webContents.send.mockImplementation(() => {
      throw error;
    });

    runtime.setMainWindow(window);

    let result = false;
    expect(() => {
      result = runtime.safeSend("stream:log", { ok: true });
    }).not.toThrow();

    await flushAsyncWork();

    expect(result).toBe(false);
    expect(teardown).toHaveBeenCalledWith("send-failed:stream:log");
  });

  it("tears down when the renderer process disappears", async () => {
    const teardown = jest.fn().mockResolvedValue(undefined);
    const runtime = createWindowRuntime(teardown);
    const webContents = new FakeWebContents();
    const window = new FakeBrowserWindow(webContents);

    runtime.attachWindowLifecycle(window);
    webContents.emit("render-process-gone", {}, { reason: "crashed" });

    await flushAsyncWork();

    expect(teardown).toHaveBeenCalledWith("render-process-gone:crashed");
  });

  it("ignores aborted main-frame loads", async () => {
    const teardown = jest.fn().mockResolvedValue(undefined);
    const runtime = createWindowRuntime(teardown);
    const webContents = new FakeWebContents();
    const window = new FakeBrowserWindow(webContents);

    runtime.attachWindowLifecycle(window);
    webContents.emit("did-fail-load", {}, -3, "aborted", "http://localhost:5173", true);

    await flushAsyncWork();

    expect(teardown).not.toHaveBeenCalled();
  });
});

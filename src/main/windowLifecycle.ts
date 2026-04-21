import { safeProcessLog, isRecoverableTransportError } from "../shared/processDiagnostics.js";

type WindowUnavailableHandler = (reason: string) => Promise<void> | void;

type ManagedWebContents = {
  send: (channel: string, data: unknown) => void;
  isDestroyed: () => boolean;
  isCrashed?: () => boolean;
  on: (...args: any[]) => unknown;
};

type ManagedBrowserWindow = {
  isDestroyed: () => boolean;
  on: (...args: any[]) => unknown;
  webContents: ManagedWebContents;
};

const ERR_ABORTED = -3;

export function createWindowRuntime(onWindowUnavailable: WindowUnavailableHandler) {
  let mainWindow: ManagedBrowserWindow | null = null;
  let teardownInFlight: Promise<void> | null = null;

  const requestTeardown = (reason: string, error?: unknown): void => {
    if (error) {
      safeProcessLog("MAIN", `Renderer transport degraded (${reason})`, error);
    } else {
      safeProcessLog("MAIN", `Renderer lifecycle event: ${reason}`);
    }

    if (teardownInFlight) {
      return;
    }

    teardownInFlight = Promise.resolve()
      .then(() => onWindowUnavailable(reason))
      .catch((teardownError) => {
        safeProcessLog("MAIN", `Failed during renderer teardown (${reason})`, teardownError);
      })
      .finally(() => {
        teardownInFlight = null;
      });
  };

  const setMainWindow = (window: ManagedBrowserWindow | null): void => {
    mainWindow = window;
  };

  const safeSend = (channel: string, data: unknown): boolean => {
    const window = mainWindow;
    const webContents = window?.webContents;

    if (!window || window.isDestroyed() || !webContents || webContents.isDestroyed()) {
      return false;
    }

    if (typeof webContents.isCrashed === "function" && webContents.isCrashed()) {
      return false;
    }

    try {
      webContents.send(channel, data);
      return true;
    } catch (error) {
      if (isRecoverableTransportError(error)) {
        requestTeardown(`send-failed:${channel}`, error);
        return false;
      }

      safeProcessLog("MAIN", `Failed to send IPC event ${channel}`, error);
      return false;
    }
  };

  const attachWindowLifecycle = (window: ManagedBrowserWindow): void => {
    setMainWindow(window);

    window.on("close", () => {
      requestTeardown("window-close");
    });

    window.on("closed", () => {
      if (mainWindow === window) {
        setMainWindow(null);
      }
      requestTeardown("window-closed");
    });

    window.on("unresponsive", () => {
      safeProcessLog("MAIN", "Browser window became unresponsive");
    });

    window.webContents.on("render-process-gone", (_event: unknown, details: { reason?: unknown }) => {
      const reason =
        details && typeof details === "object" && "reason" in details
          ? String((details as { reason?: unknown }).reason ?? "unknown")
          : "unknown";
      requestTeardown(`render-process-gone:${reason}`);
    });

    window.webContents.on(
      "did-fail-load",
      (
        _event: unknown,
        errorCode: number,
        errorDescription: string,
        validatedURL: string,
        isMainFrame: boolean,
      ) => {
        if (!isMainFrame || errorCode === ERR_ABORTED) {
          return;
        }

        requestTeardown(
          `did-fail-load:${errorCode}`,
          new Error(`${errorDescription} (${validatedURL || "unknown-url"})`),
        );
      },
    );

    window.webContents.on("devtools-closed", () => {
      safeProcessLog("MAIN", "Detached DevTools closed");
    });
  };

  return {
    attachWindowLifecycle,
    safeSend,
    setMainWindow,
  };
}

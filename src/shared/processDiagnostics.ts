const LOG_THROTTLE_MS = 5_000;
const recentMessages = new Map<string, number>();

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : null;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isRecoverableTransportError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code === "EPIPE" || code === "ERR_IPC_CHANNEL_CLOSED" || code === "ERR_STREAM_DESTROYED") {
    return true;
  }

  const message = describeError(error).toLowerCase();
  return (
    message.includes("epipe") ||
    message.includes("channel closed") ||
    message.includes("stream destroyed") ||
    message.includes("object has been destroyed") ||
    message.includes("render frame was disposed")
  );
}

export function safeProcessLog(scope: string, message: string, error?: unknown): void {
  const rendered = error ? `${message} :: ${describeError(error)}` : message;
  const key = `${scope}:${rendered}`;
  const now = Date.now();
  const lastSeen = recentMessages.get(key) ?? 0;

  if (now - lastSeen < LOG_THROTTLE_MS) {
    return;
  }

  recentMessages.set(key, now);

  try {
    process.stderr.write(`[${scope}] ${rendered}\n`);
  } catch {
    // Ignore diagnostics transport failures to avoid recursive EPIPE crashes.
  }
}

let crashGuardsInstalled = false;

export function installMainProcessCrashGuards(): void {
  if (crashGuardsInstalled) {
    return;
  }

  crashGuardsInstalled = true;

  process.on("uncaughtException", (error) => {
    if (isRecoverableTransportError(error)) {
      safeProcessLog("MAIN", "Recovered uncaught transport error", error);
      return;
    }

    safeProcessLog("MAIN", "Uncaught exception in main process", error);
  });

  process.on("unhandledRejection", (reason) => {
    if (isRecoverableTransportError(reason)) {
      safeProcessLog("MAIN", "Recovered unhandled transport rejection", reason);
      return;
    }

    safeProcessLog("MAIN", "Unhandled rejection in main process", reason);
  });
}

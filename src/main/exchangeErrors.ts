/**
 * Maps raw exchange API and network errors to user-friendly messages.
 */
export function mapExchangeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = typeof (err as any)?.code === "string" ? (err as any).code : "";

  // Bybit auth errors: codes 10003 and 10004
  if (message.includes("10003") || message.includes("10004")) {
    return "Invalid API key or secret";
  }

  // Bybit permission error
  if (message.includes("10010")) {
    return "API key lacks required permissions. Enable 'Read' access.";
  }

  // Network errors
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || message.includes("timeout") || message.includes("ENOTFOUND")) {
    return "Could not connect to exchange. Check your internet connection.";
  }

  // Catch-all
  return `Failed to validate keys: ${message}`;
}

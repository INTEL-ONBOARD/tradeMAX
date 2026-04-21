import * as auth from "../services/authService.js";
import { alertService } from "../services/alertService.js";
import { tradeEngine } from "../services/tradeEngine.js";
import { accountWatcher } from "./accountWatcher.js";
import { safeProcessLog } from "../shared/processDiagnostics.js";

export async function teardownMainProcessStreams(
  currentUserId: string | null,
  reason: string,
): Promise<void> {
  const wasAgentRunning = tradeEngine.isRunning();

  alertService.clearCallback();
  tradeEngine.clearCallbacks();
  accountWatcher.clearCallbacks();

  const results = await Promise.allSettled([
    tradeEngine.stop(),
    accountWatcher.stop(),
    wasAgentRunning && currentUserId
      ? auth.updateSettings(currentUserId, { agentModeEnabled: false })
      : Promise.resolve(),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      safeProcessLog("MAIN", `Teardown failure after ${reason}`, result.reason);
    }
  }
}

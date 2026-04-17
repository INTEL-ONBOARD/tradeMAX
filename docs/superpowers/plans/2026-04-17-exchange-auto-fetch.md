# Exchange Auto-Fetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate exchange API keys before saving, wire up wallet balance and position fetching, and auto-populate the dashboard on load — so users see their account data immediately after adding keys and on every app startup.

**Architecture:** The backend IPC handlers (`SETTINGS_SAVE_API_KEYS`, `PORTFOLIO_GET`, `POSITIONS_GET`) are updated to create temporary exchange service instances, call the exchange, and return real data. The frontend handles the new response shape and fetches data on session restore. An error mapper translates exchange errors into user-friendly messages.

**Tech Stack:** Electron IPC (main process), Binance REST API / Bybit REST SDK, React + Zustand (renderer)

---

## File Structure

| File | Role | Change |
|---|---|---|
| `src/main/exchangeErrors.ts` | **Create** — Maps raw exchange/network errors to user-friendly messages | New file |
| `src/main/ipc.ts` | **Modify** — Rewrite `SETTINGS_SAVE_API_KEYS` (validate-before-save), implement `PORTFOLIO_GET` and `POSITIONS_GET` | Lines 67-104 |
| `src/renderer/components/SettingsModal.tsx` | **Modify** — Add saving/error states to `ExchangeKeyRow`, handle `{ settings, portfolio }` response | Lines 149-189 |
| `src/renderer/App.tsx` | **Modify** — Fetch portfolio + positions on `session:restored` | Lines 52-64 |

---

### Task 1: Create the exchange error mapper

**Files:**
- Create: `src/main/exchangeErrors.ts`

- [ ] **Step 1: Create the error mapper module**

Create `src/main/exchangeErrors.ts`:

```typescript
/**
 * Maps raw exchange API and network errors to user-friendly messages.
 */
export function mapExchangeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = typeof (err as any)?.code === "string" ? (err as any).code : "";

  // Binance auth errors: codes -2014 and -2015
  if (message.includes("-2014") || message.includes("-2015")) {
    return "Invalid API key or secret";
  }

  // Bybit auth errors: codes 10003 and 10004
  if (message.includes("10003") || message.includes("10004")) {
    return "Invalid API key or secret";
  }

  // Bybit permission error
  if (message.includes("10010")) {
    return "API key lacks required permissions. Enable 'Read' access.";
  }

  // Binance permission error
  if (message.toLowerCase().includes("not allowed")) {
    return "API key lacks required permissions. Enable 'Read' access.";
  }

  // Network errors
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || message.includes("timeout") || message.includes("ENOTFOUND")) {
    return "Could not connect to exchange. Check your internet connection.";
  }

  // Catch-all
  return `Failed to validate keys: ${message}`;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/main/exchangeErrors.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main/exchangeErrors.ts
git commit -m "feat: add exchange error mapper for user-friendly validation messages"
```

---

### Task 2: Rewrite `SETTINGS_SAVE_API_KEYS` handler to validate before saving

**Files:**
- Modify: `src/main/ipc.ts:1-10` (imports)
- Modify: `src/main/ipc.ts:67-73` (SETTINGS_SAVE_API_KEYS handler)

- [ ] **Step 1: Add new imports to ipc.ts**

At the top of `src/main/ipc.ts`, add the two new imports after the existing import block (after line 10):

```typescript
import { createExchangeService } from "../services/exchangeFactory.js";
import { decrypt } from "../services/encryptionService.js";
import { mapExchangeError } from "./exchangeErrors.js";
```

- [ ] **Step 2: Rewrite the SETTINGS_SAVE_API_KEYS handler**

Replace the current handler at lines 67-73:

```typescript
  // Current code:
  ipcMain.handle(IPC.SETTINGS_SAVE_API_KEYS, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = apiKeysSchema.parse(data);
    const updated = await auth.saveApiKeys(currentUserId, parsed.exchange, parsed.apiKey, parsed.apiSecret);
    await logger.info("SYSTEM", `API keys saved for ${parsed.exchange}`);
    return updated;
  });
```

With the new validate-before-save version:

```typescript
  ipcMain.handle(IPC.SETTINGS_SAVE_API_KEYS, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = apiKeysSchema.parse(data);

    const user = await auth.getUserDoc(currentUserId);
    const exchange = createExchangeService(parsed.exchange);

    try {
      await exchange.initialize(
        { apiKey: parsed.apiKey, apiSecret: parsed.apiSecret },
        user.tradingMode,
      );
      const portfolio = await exchange.getBalance();

      const settings = await auth.saveApiKeys(
        currentUserId,
        parsed.exchange,
        parsed.apiKey,
        parsed.apiSecret,
      );
      await logger.info("SYSTEM", `API keys validated and saved for ${parsed.exchange}`);
      return { settings, portfolio };
    } catch (err) {
      const friendlyMessage = mapExchangeError(err);
      await logger.warn("SYSTEM", `API key validation failed for ${parsed.exchange}: ${err}`);
      throw new Error(friendlyMessage);
    } finally {
      exchange.destroy();
    }
  });
```

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts
git commit -m "feat: validate exchange API keys before saving, return portfolio on success"
```

---

### Task 3: Implement `PORTFOLIO_GET` handler

**Files:**
- Modify: `src/main/ipc.ts:96-99` (PORTFOLIO_GET handler)

- [ ] **Step 1: Replace the stub PORTFOLIO_GET handler**

Replace the current handler at lines 96-99:

```typescript
  // Current code:
  ipcMain.handle(IPC.PORTFOLIO_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");
    return null;
  });
```

With:

```typescript
  ipcMain.handle(IPC.PORTFOLIO_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");

    const user = await auth.getUserDoc(currentUserId);
    const keys = user.exchangeKeys[user.selectedExchange];
    if (!keys.apiKey || !keys.apiSecret) return null;

    const userSalt = user.encryptionSalt || undefined;
    const exchange = createExchangeService(user.selectedExchange);

    try {
      await exchange.initialize(
        { apiKey: decrypt(keys.apiKey, userSalt), apiSecret: decrypt(keys.apiSecret, userSalt) },
        user.tradingMode,
      );
      return await exchange.getBalance();
    } catch (err) {
      await logger.warn("SYSTEM", `Portfolio fetch failed: ${err}`);
      return null;
    } finally {
      exchange.destroy();
    }
  });
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc.ts
git commit -m "feat: implement PORTFOLIO_GET handler with real exchange data"
```

---

### Task 4: Implement `POSITIONS_GET` handler

**Files:**
- Modify: `src/main/ipc.ts:101-104` (POSITIONS_GET handler)

- [ ] **Step 1: Replace the stub POSITIONS_GET handler**

Replace the current handler at lines 101-104:

```typescript
  // Current code:
  ipcMain.handle(IPC.POSITIONS_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");
    return [];
  });
```

With:

```typescript
  ipcMain.handle(IPC.POSITIONS_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");

    const user = await auth.getUserDoc(currentUserId);
    const keys = user.exchangeKeys[user.selectedExchange];
    if (!keys.apiKey || !keys.apiSecret) return [];

    const userSalt = user.encryptionSalt || undefined;
    const exchange = createExchangeService(user.selectedExchange);

    try {
      await exchange.initialize(
        { apiKey: decrypt(keys.apiKey, userSalt), apiSecret: decrypt(keys.apiSecret, userSalt) },
        user.tradingMode,
      );
      return await exchange.getOpenPositions();
    } catch (err) {
      await logger.warn("SYSTEM", `Positions fetch failed: ${err}`);
      return [];
    } finally {
      exchange.destroy();
    }
  });
```

- [ ] **Step 2: Remove the now-redundant dynamic imports from EXCHANGE_PAIRS handler**

The `EXCHANGE_PAIRS` handler at lines 183-211 uses dynamic imports for `decrypt` and `createExchangeService`. Since we now import them at the top of the file (from Task 2 Step 1), update lines 194-195 to remove the dynamic imports.

Replace:

```typescript
      const { decrypt } = await import("../services/encryptionService.js");
      const { createExchangeService } = await import("../services/exchangeFactory.js");
```

With nothing — remove these two lines. The static imports from Task 2 Step 1 already provide `decrypt` and `createExchangeService`.

Also update the variable references at lines 198-201 to use the top-level imports (they already will, since the dynamic import variable names match the static import names — just removing the dynamic imports is sufficient).

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts
git commit -m "feat: implement POSITIONS_GET handler, clean up dynamic imports"
```

---

### Task 5: Update `ExchangeKeyRow` with validation states and error display

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx:149-189` (ExchangeKeyRow component)

- [ ] **Step 1: Rewrite the ExchangeKeyRow component**

Replace the entire `ExchangeKeyRow` function (lines 149-189) with:

```tsx
function ExchangeKeyRow({ exchange }: { exchange: "binance" | "bybit" }) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const setPortfolio = useAppStore((s) => s.setPortfolio);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasKeys = exchange === "binance" ? settings?.hasBinanceKeys : settings?.hasBybitKeys;

  const handleSave = async () => {
    if (!apiKey || !apiSecret) return;
    setSaving(true);
    setError(null);
    try {
      const result = await window.api.invoke(IPC.SETTINGS_SAVE_API_KEYS, {
        exchange, apiKey, apiSecret,
      }) as { settings: any; portfolio: any };
      setSettings(result.settings);
      setPortfolio(result.portfolio);
      setApiKey(""); setApiSecret("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err?.message ?? "Validation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SettingRow label="API Key" description={`Your ${exchange} API key`}>
        <div className="flex items-center gap-2">
          {hasKeys && !apiKey && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-profit)] font-medium">
              <CheckCircle size={10} /> Active
            </span>
          )}
          <PasswordInput value={apiKey} placeholder={hasKeys ? "••••••••••••" : "Enter API key"} onChange={(v) => { setApiKey(v); setError(null); }} />
        </div>
      </SettingRow>
      <SettingRow label="API Secret" description={`Your ${exchange} API secret`}>
        <div className="flex items-center gap-2">
          <PasswordInput value={apiSecret} placeholder={hasKeys ? "••••••••••••" : "Enter API secret"} onChange={(v) => { setApiSecret(v); setError(null); }} />
          <button
            onClick={handleSave}
            disabled={!apiKey || !apiSecret || saving}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: saved ? "var(--color-profit-bg)" : "var(--color-info-bg)",
              color: saved ? "var(--color-profit)" : "var(--color-info)",
              border: `1px solid ${saved ? "var(--color-profit-border)" : "var(--color-info-border)"}`,
            }}
          >
            {saving ? (
              <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Validating...</span>
            ) : saved ? (
              <span className="flex items-center gap-1"><CheckCircle size={11} /> Validated</span>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </SettingRow>
      {error && (
        <div className="px-1 py-2">
          <p className="text-[11px] text-[var(--color-loss)] font-medium">{error}</p>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "feat: add key validation states and inline error display to ExchangeKeyRow"
```

---

### Task 6: Auto-fetch portfolio and positions on session restore

**Files:**
- Modify: `src/renderer/App.tsx:39-66` (useEffect with stream listeners)

- [ ] **Step 1: Add auto-fetch logic after session:restored**

In `src/renderer/App.tsx`, find the `session:restored` handler inside the second `useEffect` (around lines 52-64). After `store.setScreen("dashboard");` (line 63), add the auto-fetch:

Replace the `session:restored` handler:

```typescript
    unsubs.push(
      api.on("session:restored", (d: any) => {
        const data = d as { session: UserSession; settings: UserSettings };
        store.setUser(data.session);
        store.setSettings(data.settings);
        // Prefer localStorage theme; fall back to server preference
        const savedPref = localStorage.getItem("theme-preference") as "dark" | "light" | null;
        const theme = savedPref ?? data.settings.themePreference ?? "light";
        store.setTheme(theme);
        store.setScreen("dashboard");
      })
    );
```

With:

```typescript
    unsubs.push(
      api.on("session:restored", (d: any) => {
        const data = d as { session: UserSession; settings: UserSettings };
        store.setUser(data.session);
        store.setSettings(data.settings);
        const savedPref = localStorage.getItem("theme-preference") as "dark" | "light" | null;
        const theme = savedPref ?? data.settings.themePreference ?? "light";
        store.setTheme(theme);
        store.setScreen("dashboard");

        // Auto-fetch portfolio and positions if exchange keys are configured
        if (data.settings.hasBinanceKeys || data.settings.hasBybitKeys) {
          api.invoke("portfolio:get").then((p) => {
            if (p) store.setPortfolio(p as PortfolioSnapshot);
          }).catch(() => {});
          api.invoke("positions:get").then((pos) => {
            const arr = pos as Position[];
            if (arr.length > 0) store.setPositions(arr);
          }).catch(() => {});
        }
      })
    );
```

Note: We import `IPC` from constants but the `session:restored` handler uses string literals for `api.invoke`. Use the string literals `"portfolio:get"` and `"positions:get"` directly here (matching the existing preload allowlist) since `IPC` is not currently imported in App.tsx and adding the import would require also importing from the shared constants barrel which may cause bundler issues in the renderer.

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: auto-fetch portfolio and positions on session restore"
```

---

### Task 7: Manual smoke test

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: App launches, no console errors

- [ ] **Step 2: Test invalid key validation**

1. Log in to the app
2. Open Settings → API & Auth
3. Enter obviously invalid keys (e.g., `test123` / `test456`) for Binance or Bybit
4. Click Save
5. Expected: Button shows "Validating..." spinner, then red error text appears (e.g., "Invalid API key or secret"). Keys remain in the input fields.

- [ ] **Step 3: Test valid key flow (if you have test keys)**

1. Enter valid API keys (read-only keys recommended)
2. Click Save
3. Expected: Button shows "Validating..." → "Validated" checkmark. Portfolio panel updates with your balance.

- [ ] **Step 4: Test session restore auto-fetch**

1. With valid keys saved, refresh the app (Cmd+R)
2. Expected: After login restores, the portfolio panel shows your balance without starting the agent

- [ ] **Step 5: Test no-keys graceful handling**

1. Create a new account (no exchange keys configured)
2. Navigate to dashboard
3. Expected: Portfolio panel shows $0.00, no errors in console

- [ ] **Step 6: Commit any fixes if needed**

If any issues were found and fixed during testing:

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```

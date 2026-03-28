import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { BrowserContext } from "playwright-core";
import { firefox } from "./playwright-extra-setup.js";

const SESSION_TTL_MS = 30_000;
const SESSION_ID_MAX_LEN = 128;
/** URL/path-safe segment: no slashes or control chars */
const SESSION_ID_RE = /^[\w.-]{1,128}$/;

const WS_RESOLVE_ATTEMPTS = 50;
const WS_RESOLVE_INTERVAL_MS = 100;

const sessions = new Map<string, SessionEntry>();
const pendingSessionIds = new Set<string>();

function validateSessionId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (id.length === 0 || id.length > SESSION_ID_MAX_LEN) return null;
  if (!SESSION_ID_RE.test(id)) return null;
  return id;
}

/** Docker: set BROWSER_USER_DATA_ROOT to a mounted volume (e.g. /data/firefox-profiles). */
function getUserDataRoot(): string {
  const raw = process.env.BROWSER_USER_DATA_ROOT?.trim();
  return raw && raw.length > 0 ? raw : "/tmp";
}

function userDataDirForSession(sessionId: string): string {
  return path.join(getUserDataRoot(), `user_data_${sessionId}`);
}

type SessionEntry = {
  context: BrowserContext;
  wsEndpoint: string;
  ticket: string;
  timer: ReturnType<typeof setTimeout> | null;
  cdpPort: number;
  expiresAt: number;
};

function generateTicket(): string {
  return randomBytes(32).toString("hex");
}

function ticketsMatch(expected: string, provided: string): boolean {
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getExecutablePath(): string | undefined {
  const pw = process.env.PLAYWRIGHT_EXECUTABLE_PATH?.trim();
  if (pw) return pw;
  const legacy = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  return legacy || undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickWsUrlFromVersionJson(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const direct = o.webSocketDebuggerUrl;
  if (typeof direct === "string" && direct.startsWith("ws")) return direct;
  const bidi = o.bidi;
  if (typeof bidi === "string" && bidi.startsWith("ws")) return bidi;
  return null;
}

/**
 * Firefox exposes a debugger WebSocket URL on the remote-debugging HTTP port
 * (Playwright does not provide Puppeteer-compatible browser.wsEndpoint()).
 */
async function resolveFirefoxWsEndpoint(cdpPort: number): Promise<string> {
  const url = `http://127.0.0.1:${cdpPort}/json/version`;
  let lastErr: unknown;
  for (let i = 0; i < WS_RESOLVE_ATTEMPTS; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const json: unknown = await res.json();
        const ws = pickWsUrlFromVersionJson(json);
        if (ws) return ws;
      }
    } catch (e) {
      lastErr = e;
    }
    await delay(WS_RESOLVE_INTERVAL_MS);
  }
  throw new Error(
    `Failed to resolve WebSocket debugger URL on port ${cdpPort}: ${String(lastErr ?? "no webSocketDebuggerUrl")}`
  );
}

/** Firefox: fixed remote debugging port for WebDriver BiDi; window size via -width/-height. */
function defaultLaunchArgs(extra: string[], debugPort: number): string[] {
  const w = process.env.VIEWPORT_WIDTH ?? "1366";
  const h = process.env.VIEWPORT_HEIGHT ?? "768";
  return [
    "-width",
    w,
    "-height",
    h,
    ...extra,
  ];
}

function armExpiry(sessionId: string): void {
  const entry = sessions.get(sessionId);
  if (!entry) return;

  if (entry.timer) clearTimeout(entry.timer);

  entry.expiresAt = Date.now() + SESSION_TTL_MS;
  entry.timer = setTimeout(() => {
    void destroySession(sessionId);
  }, SESSION_TTL_MS);
}

async function destroySession(sessionId: string): Promise<void> {
  const entry = sessions.get(sessionId);
  if (!entry) return;

  sessions.delete(sessionId);
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }

  try {
    await entry.context.close();
  } catch (e) {
    // process may already be gone
    console.error("Error closing browser", e);
  }
}

export function getSessionCount(): number {
  return sessions.size;
}

export type CreateSessionResult =
  | {
    ok: true;
    sessionId: string;
    ticket: string;
    wsEndpoint: string;
    cdpPort: number;
    expiresAt: number;
  }
  | { ok: false; error: "INVALID_SESSION_ID" | "SESSION_ID_IN_USE" };

const CDP_PORT_MIN = parseInt(process.env.CDP_PORT_MIN || "9223");
const CDP_PORT_MAX = parseInt(process.env.CDP_PORT_MAX || "9323");
function getAvailableCdpPort(): number {
  const usedCdpPorts = Array.from(sessions.values()).map(session => session.cdpPort);
  for (let port = CDP_PORT_MIN; port <= CDP_PORT_MAX; port++) {
    if (!usedCdpPorts.includes(port)) {
      return port;
    }
  }
  throw new Error("No available CDP port found");
}

export async function createSession(
  sessionIdRaw: unknown,
  args: string[] = []
): Promise<CreateSessionResult> {
  const sessionId = validateSessionId(sessionIdRaw);
  if (!sessionId) {
    return { ok: false, error: "INVALID_SESSION_ID" };
  }
  if (sessions.has(sessionId) || pendingSessionIds.has(sessionId)) {
    return { ok: false, error: "SESSION_ID_IN_USE" };
  }

  pendingSessionIds.add(sessionId);

  const ticket = generateTicket();

  mkdirSync(getUserDataRoot(), { recursive: true });
  const cdpPort = getAvailableCdpPort();

  const execPath = getExecutablePath();

  let context: BrowserContext;
  try {
    context = await firefox.launchPersistentContext(
      userDataDirForSession(sessionId),
      {
        ...(execPath ? { executablePath: execPath } : {}),
        headless: false,
        args: defaultLaunchArgs(args, cdpPort),
        firefoxUserPrefs: {
          "devtools.debugger.remote.force-local": false,
        },
      }
    );
  } catch (e) {
    pendingSessionIds.delete(sessionId);
    throw e;
  }

  let wsEndpoint: string;
  try {
    wsEndpoint = "ws://127.0.0.1:9223/devtools/browser/86073637-379e-486f-8130-100033478543" //await resolveFirefoxWsEndpoint(cdpPort);
  } catch (e) {
    pendingSessionIds.delete(sessionId);
    try {
      await context.close();
    } catch {
      /* ignore */
    }
    throw e;
  }

  const publicHost = process.env.PUBLIC_WS_HOST?.trim();
  if (publicHost) {
    try {
      const u = new URL(wsEndpoint);
      u.hostname = publicHost;
      wsEndpoint = u.toString();
    } catch {
      /* keep original */
    }
  }

  const entry: SessionEntry = {
    context,
    wsEndpoint,
    ticket,
    timer: null,
    cdpPort,
    expiresAt: 0,
  };
  sessions.set(sessionId, entry);
  pendingSessionIds.delete(sessionId);

  context.on("close", () => {
    const current = sessions.get(sessionId);
    if (!current) return;
    sessions.delete(sessionId);
    if (current.timer) clearTimeout(current.timer);
  });

  armExpiry(sessionId);

  return {
    ok: true,
    sessionId,
    ticket,
    wsEndpoint,
    cdpPort,
    expiresAt: sessions.get(sessionId)!.expiresAt,
  };
}

export type RenewResult =
  | { ok: true; expiresAt: number }
  | { ok: false; error: "NOT_FOUND" | "UNAUTHORIZED" };

export function renewSession(sessionId: string, ticket: string): RenewResult {
  const entry = sessions.get(sessionId);
  if (!entry) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (!ticketsMatch(entry.ticket, ticket)) {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  armExpiry(sessionId);
  const updated = sessions.get(sessionId);
  if (!updated) {
    return { ok: false, error: "NOT_FOUND" };
  }
  return { ok: true, expiresAt: updated.expiresAt };
}

export type CloseResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "UNAUTHORIZED" };

export async function closeSession(
  sessionId: string,
  ticket: string
): Promise<CloseResult> {
  const entry = sessions.get(sessionId);
  if (!entry) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (!ticketsMatch(entry.ticket, ticket)) {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  await destroySession(sessionId);
  return { ok: true };
}

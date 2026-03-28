import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Browser } from "puppeteer";
import puppeteerCore from "puppeteer";
import { addExtra, type VanillaPuppeteer } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const puppeteer = addExtra(puppeteerCore as unknown as VanillaPuppeteer);
puppeteer.use(StealthPlugin());

const SESSION_TTL_MS = 30_000;
const SESSION_ID_MAX_LEN = 128;
/** URL/path-safe segment: no slashes or control chars */
const SESSION_ID_RE = /^[\w.-]{1,128}$/;

const sessions = new Map<string, SessionEntry>();
const pendingSessionIds = new Set<string>();

function validateSessionId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (id.length === 0 || id.length > SESSION_ID_MAX_LEN) return null;
  if (!SESSION_ID_RE.test(id)) return null;
  return id;
}

/** Docker: set BROWSER_USER_DATA_ROOT to a mounted volume (e.g. /data/chrome-profiles). */
function getUserDataRoot(): string {
  const raw = process.env.BROWSER_USER_DATA_ROOT?.trim();
  return raw && raw.length > 0 ? raw : "/tmp";
}

function userDataDirForSession(sessionId: string): string {
  const safe = createHash("sha256").update(sessionId).digest("hex");
  return path.join(getUserDataRoot(), `user_data_${safe}`);
}

type SessionEntry = {
  browser: Browser;
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

function defaultLaunchArgs(extra: string[], cdpPort: number): string[] {
  return [
    "--disable-infobars",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--lang=zh-CN,zh",
    "--disable-blink-features=AutomationControlled",
    `--window-size=${process.env.VIEWPORT_WIDTH},${process.env.VIEWPORT_HEIGHT}`,
    // `--remote-debugging-port=${cdpPort}`,
    // "--remote-debugging-address=0.0.0.0",
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
    await entry.browser.close();
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

  let instance: Browser;
  try {
    instance = await puppeteer.launch({
      browser: "chrome",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: false,
      ignoreDefaultArgs: ['--enable-automation'],
      args: defaultLaunchArgs(args, cdpPort),
      userDataDir: userDataDirForSession(sessionId),
    });
  } catch (e) {
    pendingSessionIds.delete(sessionId);
    throw e;
  }

  const wsEndpoint = "ws://127.0.0.1:9223/devtools/browser/86073637-379e-486f-8130-100033478543" // instance.wsEndpoint();

  const entry: SessionEntry = {
    browser: instance,
    wsEndpoint,
    ticket,
    timer: null,
    cdpPort: 0,
    expiresAt: 0,
  };
  sessions.set(sessionId, entry);
  pendingSessionIds.delete(sessionId);

  instance.on("disconnected", () => {
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

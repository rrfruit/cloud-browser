import type { BrowserContext } from "playwright-core";
import { launchPersistentContext, type LaunchPersistentContextOptions } from 'cloakbrowser';
import { access, rm } from 'node:fs/promises';

export const VNC_URL = process.env.VNC_URL!;

function getFirefoxProfilePath(id: string) {
  return `/data/firefox-profiles/${id}`;
}

type Session = {
  id: string;
  browser: BrowserContext;
  expiresAt: number;
}

const sessions: Record<string, Session> = {};

const defaultArgs: string[] = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--window-position=0,0',
  '--start-maximized' // 让浏览器一出来就最大化铺满屏幕
]

export type CreateBrowserOptions = {
  args?: string[];
  userDataDir?: string;
  requireExistingProfile?: boolean;
} & Omit<LaunchPersistentContextOptions, 'args' | 'userDataDir'>;

async function createBrowser(id: string, options: CreateBrowserOptions = {}) {
  if (sessions[id]) {
    throw new Error('Session already exists');
  }

  let browser: BrowserContext | undefined;
  try {
    const profilePath = getFirefoxProfilePath(id);
    if (options.requireExistingProfile) {
      try {
        await access(profilePath);
      } catch {
        throw new Error(`Profile path does not exist: ${profilePath}`);
      }
    }

    browser = await launchPersistentContext({
      ...options,
      args: [...defaultArgs, ...(options.args ?? [])],
      userDataDir: profilePath,
    });

    browser.on("close", () => {
      closeSession(id);
    });

    const page = await browser.newPage();
    await page.goto('https://protected-site.com');

    const session: Session = {
      id,
      browser,
      expiresAt: Date.now() + 60 * 60 * 1000,
    }
    sessions[id] = session;

    return session;
  } catch (error) {
    browser?.close();
    console.error(error);
    throw new Error('Failed to create browser');
  }
}

async function renewSession(sessionId: string) {
  const session = sessions[sessionId];
  if (!session) {
    throw new Error('Session not found');
  }
  session.expiresAt = Date.now() + 30 * 1000;
  return session;
}

async function closeSession(sessionId: string) {
  try {
    const session = sessions[sessionId];
    if (!session) {
      throw new Error('Session not found');
    }
    delete sessions[sessionId];
    await session.browser.close();
  } catch (error) {
    // const errorMessage = error instanceof Error ? error.message : 'Failed to close session';
    // console.error(errorMessage);
  }
}

async function deleteProfile(sessionId: string) {
  if (sessions[sessionId]) {
    await closeSession(sessionId);
  }
  await rm(getFirefoxProfilePath(sessionId), { recursive: true, force: true });
}

function startSessionKeepAlive(sessionId: string, maxKeepAliveTimeMs: number = 60 * 60 * 1000) {
  const session = sessions[sessionId];
  if (!session) {
    throw new Error('Session not found');
  }
  if (session.expiresAt < Date.now()) {
    throw new Error('Session expired');
  }
  const startKeepAliveTime = Date.now();
  const keepAlive = setInterval(async () => {
    if (Date.now() - startKeepAliveTime > maxKeepAliveTimeMs) {
      clearInterval(keepAlive);
      return;
    }
    if (!sessions[sessionId]) {
      clearInterval(keepAlive);
      return;
    }
    await renewSession(sessionId);
  }, 10 * 1000);
  return {
    stop: () => clearInterval(keepAlive),
  };
}

setInterval(async () => {
  const now = Date.now();
  for (const session of Object.values(sessions)) {
    if (session.expiresAt < now) {
      await closeSession(session.id);
    }
  }
}, 30_000); // 30秒检查一次

export const cloudBrowserClient = {
  createBrowser,
  renewSession,
  closeSession,
  deleteProfile,
  startSessionKeepAlive,
}

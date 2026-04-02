import type { Browser, LaunchOptions } from "puppeteer-core";
import { launch } from 'cloakbrowser/puppeteer';
import { access, readdir, rm } from 'node:fs/promises';



export const VNC_URL = process.env.VNC_URL!;

function getFirefoxProfilePath(id: string) {
  return `/data/profiles/${id}`;
}

function getProfileSingletonPaths(id: string) {
  const profilePath = getFirefoxProfilePath(id);
  return [
    `${profilePath}/SingletonCookie`,
    `${profilePath}/SingletonLock`,
    `${profilePath}/SingletonSocket`,
  ];
}

type Session = {
  id: string;
  browser: Browser;
  cdpPort: number;
  endpointURL: string;
  expiresAt: number;
}

const sessions: Record<string, Session> = {};

const defaultArgs: string[] = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--window-position=0,0',
  '--start-maximized', // 让浏览器一出来就最大化铺满屏幕
]

export function getSession(sessionId: string) {
  return sessions[sessionId];
}

export type CreateBrowserOptions = {
  args?: string[];
  userDataDir?: string;
  requireExistingProfile?: boolean;
} & Omit<LaunchOptions, 'args' | 'userDataDir'>;

async function createBrowser(id: string, options: CreateBrowserOptions = {}) {
  if (sessions[id]) {
    throw new Error('Session already exists');
  }

  let browser: Browser | undefined;
  try {
    const profilePath = getFirefoxProfilePath(id);
    if (options.requireExistingProfile) {
      try {
        await access(profilePath);
      } catch {
        throw new Error(`Profile path does not exist: ${profilePath}`);
      }
    }

    const args = [
      ...defaultArgs,
      ...(options.args ?? []),
      '--user-data-dir=' + profilePath,
      '--remote-debugging-port=9223',
    ];
    browser = await launch({
      ...options,
      args,
      headless: false,
    });

    browser.on("close", () => {
      closeSession(id);
    });

    const page = await browser.newPage();
    await page.goto('https://baidu.com');

    const endpointURL = browser.wsEndpoint();

    const session: Session = {
      id,
      browser,
      cdpPort: Number(endpointURL.split(':')[2]),
      endpointURL,
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
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  session.expiresAt = Date.now() + 30 * 1000;
  return session;
}

async function closeSession(sessionId: string) {
  try {
    const session = getSession(sessionId);
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
  if (getSession(sessionId)) {
    await closeSession(sessionId);
  }
  await rm(getFirefoxProfilePath(sessionId), { recursive: true, force: true });
}

async function unlockProfile(profileId: string) {
  if (getSession(profileId)) {
    await closeSession(profileId);
  }

  const paths = getProfileSingletonPaths(profileId);
  await Promise.all(paths.map((path) => rm(path, { recursive: true, force: true })));

  return {
    id: profileId,
    removed: paths,
  };
}

function startSessionKeepAlive(sessionId: string, maxKeepAliveTimeMs: number = 60 * 60 * 1000) {
  const session = getSession(sessionId);
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
    if (!getSession(sessionId)) {
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

function getSessions() {
  return Object.values(sessions).map(({ id, expiresAt }) => ({ id, expiresAt }));
}

async function getProfiles() {
  try {
    const entries = await readdir('/data/profiles', { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const session = getSession(entry.name);
        return {
          id: entry.name,
          active: Boolean(session),
          cdpPort: session?.cdpPort ?? null,
          endpointURL: session?.endpointURL ?? null,
          expiresAt: session?.expiresAt ?? null,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export const cloudBrowserClient = {
  getSession,
  createBrowser,
  renewSession,
  closeSession,
  deleteProfile,
  unlockProfile,
  startSessionKeepAlive,
  getSessions,
  getProfiles,
}

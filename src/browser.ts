import type { Browser } from "puppeteer";
import puppeteerCore from "puppeteer";
import { addExtra, type VanillaPuppeteer } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const puppeteer = addExtra(puppeteerCore as unknown as VanillaPuppeteer);
puppeteer.use(StealthPlugin());

let browser: Browser | null = null;
let wsEndpoint: string | null = null;

export function getState() {
  return { browser, wsEndpoint };
}

export async function launchBrowser(_id: string, args: string[] = []) {
  if (browser) {
    return { wsEndpoint: wsEndpoint as string, created: false };
  }

  const instance = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      `--window-size=${process.env.VIEWPORT_WIDTH},${process.env.VIEWPORT_HEIGHT}`,
      "--remote-debugging-port=0",
      "--remote-debugging-address=0.0.0.0",
      ...args,
    ],
  });

  browser = instance;
  wsEndpoint = instance.wsEndpoint();

  instance.on("disconnected", () => {
    browser = null;
    wsEndpoint = null;
  });

  return { wsEndpoint, created: true };
}

export async function closeBrowser(): Promise<boolean> {
  if (!browser) {
    return false;
  }

  await browser.close();
  browser = null;
  wsEndpoint = null;

  return true;
}

export async function renewBrowser(id: string, args: string[] = []) {
  await closeBrowser();
  return launchBrowser(id, args);
}

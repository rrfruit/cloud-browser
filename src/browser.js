import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin()); 

let browser = null;
let wsEndpoint = null;

export function getState() {
  return { browser, wsEndpoint };
}

export async function startBrowser() {
  if (browser) {
    return { wsEndpoint, created: false };
  }

  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      `--window-size=${process.env.VIEWPORT_WIDTH},${process.env.VIEWPORT_HEIGHT}`,
      "--remote-debugging-port=9222",
      "--remote-debugging-address=0.0.0.0",
    ],
  });

  wsEndpoint = browser.wsEndpoint();

  browser.on("disconnected", () => {
    browser = null;
    wsEndpoint = null;
  });

  return { wsEndpoint, created: true };
}

export async function stopBrowser() {
  if (!browser) {
    return false;
  }

  await browser.close();
  browser = null;
  wsEndpoint = null;

  return true;
}

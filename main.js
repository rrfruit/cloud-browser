"use strict";

const { Hono } = require("hono");
const { serve } = require("@hono/node-server");

const app = new Hono();

let browser = null;
let wsEndpoint = null;

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/browser/status", (c) => {
  if (browser) {
    return c.json({ running: true, wsEndpoint });
  }
  return c.json({ running: false, wsEndpoint: null });
});

app.post("/browser/start", async (c) => {
  if (browser) {
    return c.json({ running: true, wsEndpoint }, 200);
  }

  const puppeteer = require("puppeteer");

  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--remote-debugging-port=9222",
      "--remote-debugging-address=0.0.0.0",
    ],
  });

  wsEndpoint = browser.wsEndpoint();

  browser.on("disconnected", () => {
    browser = null;
    wsEndpoint = null;
  });

  return c.json({ running: true, wsEndpoint }, 201);
});

app.post("/browser/stop", async (c) => {
  if (!browser) {
    return c.json({ running: false }, 200);
  }

  await browser.close();
  browser = null;
  wsEndpoint = null;

  return c.json({ running: false }, 200);
});

const PORT = parseInt(process.env.PORT || "3000", 10);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Cloud Browser service listening on port ${PORT}`);
});

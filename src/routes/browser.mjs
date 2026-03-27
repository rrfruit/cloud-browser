import { Hono } from "hono";
import { getState, launchBrowser, closeBrowser } from "../browser.mjs";

const router = new Hono();

router.get("/status", (c) => {
  const { wsEndpoint } = getState();
  return c.json(
    wsEndpoint
      ? { running: true, wsEndpoint }
      : { running: false, wsEndpoint: null }
  );
});

router.post("/launch", async (c) => {
  const body = await c.req.json();
  const { created, wsEndpoint } = await launchBrowser(body);
  return c.json({ running: true, wsEndpoint }, created ? 201 : 200);
});

router.post("/close", async (c) => {
  const body = await c.req.json();
  const stopped = await closeBrowser(body);
  return c.json({ running: false }, stopped ? 200 : 200);
});

router.post("/renew", async (c) => {
  const { created, wsEndpoint } = await startBrowser();
  return c.json({ running: true, wsEndpoint }, created ? 201 : 200);
});

export default router;

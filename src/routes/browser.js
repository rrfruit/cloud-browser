import { Hono } from "hono";
import { getState, startBrowser, stopBrowser } from "../browser.js";

const router = new Hono();

router.get("/status", (c) => {
  const { wsEndpoint } = getState();
  return c.json(
    wsEndpoint
      ? { running: true, wsEndpoint }
      : { running: false, wsEndpoint: null }
  );
});

router.post("/start", async (c) => {
  const { created, wsEndpoint } = await startBrowser();
  return c.json({ running: true, wsEndpoint }, created ? 201 : 200);
});

router.post("/stop", async (c) => {
  const stopped = await stopBrowser();
  return c.json({ running: false }, stopped ? 200 : 200);
});

export default router;

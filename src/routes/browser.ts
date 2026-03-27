import { Hono } from "hono";
import {
  getState,
  launchBrowser,
  closeBrowser,
  renewBrowser,
} from "../browser.js";

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
  const body = (await c.req.json()) as { id?: string; args?: string[] };
  const { created, wsEndpoint } = await launchBrowser(
    body.id ?? "default",
    body.args ?? []
  );
  return c.json({ running: true, wsEndpoint }, created ? 201 : 200);
});

router.post("/close", async (c) => {
  await c.req.json().catch(() => ({}));
  const stopped = await closeBrowser();
  return c.json({ running: false }, stopped ? 200 : 200);
});

router.post("/renew", async (c) => {
  const body = (await c.req.json()) as { id?: string; args?: string[] };
  const { created, wsEndpoint } = await renewBrowser(
    body.id ?? "default",
    body.args ?? []
  );
  return c.json({ running: true, wsEndpoint }, created ? 201 : 200);
});

export default router;

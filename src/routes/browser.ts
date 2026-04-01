import { Hono } from "hono";
import { cloudBrowserClient } from "../browser.js";

const router = new Hono()
  .get("/profiles", async (c) => {
    return c.json(await cloudBrowserClient.getProfiles());
  })
  .post("/session", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      sessionId: string;
      args?: string[];
    };
    const result = await cloudBrowserClient.createBrowser(body.sessionId!);
    return c.json(result, 201);
  })
  .post("/session/:id/renew", async (c) => {
    const sessionId = c.req.param("id");
    const result = await cloudBrowserClient.renewSession(sessionId!);
    return c.json(result, 200);
  })
  .post("/session/:id/close", async (c) => {
    const sessionId = c.req.param("id");
    const result = await cloudBrowserClient.closeSession(sessionId!);
    return c.json(result, 200);
  });

export default router;

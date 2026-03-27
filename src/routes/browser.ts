import { Hono } from "hono";
import {
  closeSession,
  createSession,
  getSessionCount,
  renewSession,
} from "../browser.js";

const router = new Hono();

router.get("/status", (c) => {
  return c.json({ sessionCount: getSessionCount() });
});

router.post("/session", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    sessionId?: string;
    args?: string[];
  };
  const result = await createSession(body.sessionId, body.args ?? []);
  if (!result.ok) {
    const status =
      result.error === "INVALID_SESSION_ID" ? 400 : 409;
    return c.json({ error: result.error }, status);
  }
  const { sessionId, ticket, wsEndpoint, expiresAt } = result;
  return c.json({ sessionId, ticket, wsEndpoint, expiresAt }, 201);
});

router.post("/session/:id/renew", async (c) => {
  const sessionId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { ticket?: string };
  const ticket = body.ticket ?? "";

  const result = renewSession(sessionId, ticket);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 401;
    return c.json({ error: result.error }, status);
  }

  return c.json({ expiresAt: result.expiresAt });
});

router.post("/session/:id/close", async (c) => {
  const sessionId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { ticket?: string };
  const ticket = body.ticket ?? "";

  const result = await closeSession(sessionId, ticket);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 401;
    return c.json({ error: result.error }, status);
  }

  return c.json({ closed: true });
});

export default router;

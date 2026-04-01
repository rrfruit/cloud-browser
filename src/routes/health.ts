import { Hono } from "hono";

const router = new Hono().get("/", (c) => c.json({ status: "ok" }));

export default router;

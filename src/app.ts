import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import path from "node:path";
import healthRouter from "./routes/health.js";
import browserRouter from "./routes/browser.js";

const app = new Hono()
.use("/web/*", serveStatic({ root: path.resolve(__dirname, "../public") }))
.use(logger())
.route("/health", healthRouter)
.route("/browser", browserRouter);

export default app;
export type AppType = typeof app;

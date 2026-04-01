import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import path from "node:path";
import healthRouter from "./routes/health.js";
import browserRouter from "./routes/browser.js";
import { fileURLToPath } from "node:url";
import { adminAuthRoute } from "./routes/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = new Hono()
.use("/web/*", serveStatic({ root: path.resolve(__dirname, "../public") }))
.use(logger())
.use(cors())
.route("/auth", adminAuthRoute)
.route("/health", healthRouter)
.route("/browser", browserRouter);

export default app;
export type AppType = typeof app;

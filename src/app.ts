import { Hono } from "hono";
import { logger } from "hono/logger";
import healthRouter from "./routes/health.js";
import browserRouter from "./routes/browser.js";


const app = new Hono().use(logger());

app.route("/health", healthRouter);
app.route("/browser", browserRouter);

export default app;

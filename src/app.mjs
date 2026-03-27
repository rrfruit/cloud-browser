import { Hono } from "hono";
import healthRouter from "./routes/health.mjs";
import browserRouter from "./routes/browser.mjs";

const app = new Hono();

app.route("/health", healthRouter);
app.route("/browser", browserRouter);

export default app;

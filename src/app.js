import { Hono } from "hono";
import healthRouter from "./routes/health.js";
import browserRouter from "./routes/browser.js";

const app = new Hono();

app.route("/health", healthRouter);
app.route("/browser", browserRouter);

export default app;

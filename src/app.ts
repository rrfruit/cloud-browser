import { Hono } from "hono";
import { logger } from "hono/logger";
import healthRouter from "./routes/health.js";
import browserRouter from "./routes/browser.js";
import { createSession } from "./browser.js";

const sessionId = "session111111111";
const args: string[] = [];

const app = new Hono().use(logger());

app.route("/health", healthRouter);
app.route("/browser", browserRouter);

setTimeout(async () => {
  const result = await createSession(sessionId, args);
  console.log(result);
}, 3000);


export default app;

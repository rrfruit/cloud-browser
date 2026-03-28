import { serve } from "@hono/node-server";
import app from "./app.js";

const PORT = 9222

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Cloud Browser service listening on port ${PORT}`);
});

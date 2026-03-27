import { serve } from "@hono/node-server";
import app from "./app.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Cloud Browser service listening on port ${PORT}`);
});

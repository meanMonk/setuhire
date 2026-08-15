import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { healthRoutes } from "./routes/health.js";
import { setupDocs } from "./docs.js";
import { dbRoutes } from "./routes/db.js";

const app = new Hono();

app.use("*", logger());
app.route("/health", healthRoutes);
app.route("/db", dbRoutes);
setupDocs(app);

const port = Number(process.env.PORT ?? 3000);
console.log(`setuhireapi listening on :${port}  (docs: http://localhost:${port}/docs)`);

serve({ fetch: app.fetch, port });

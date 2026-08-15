import { Hono } from "hono";
import { requireAuth } from "../lib/auth.js";
import { json } from "../lib/http.js";
import {
  activityLog,
  attentionFeed,
  dashboardSummary,
} from "../services/pipeline.js";

export const dashboardRoutes = new Hono();

dashboardRoutes.use("*", requireAuth);

dashboardRoutes.get("/summary", async (c) => {
  return json(c, await dashboardSummary());
});

dashboardRoutes.get("/attention-feed", async (c) => {
  return json(c, await attentionFeed());
});

dashboardRoutes.get("/activity-log", async (c) => {
  const raw = Number(c.req.query("limit") ?? "10");
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : 10;
  return json(c, await activityLog(limit));
});

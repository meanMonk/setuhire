import { Hono } from "hono";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  candidates,
  clients,
  interviews,
  jobCandidateMatches,
  jobs,
} from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { error, json } from "../lib/http.js";
import { isInterviewStatus, toDate } from "../services/pipeline.js";

export const interviewsRoutes = new Hono();

interviewsRoutes.use("*", requireAuth);

const rowShape = {
  id: interviews.id,
  matchId: interviews.matchId,
  round: interviews.round,
  interviewer: interviews.interviewer,
  scheduledAt: interviews.scheduledAt,
  status: interviews.status,
  feedback: interviews.feedback,
  createdAt: interviews.createdAt,
  candidateId: candidates.id,
  candidateName: candidates.name,
  jobId: jobs.id,
  jobTitle: jobs.title,
  clientId: clients.id,
  clientName: clients.name,
} as const;

interviewsRoutes.get("/", async (c) => {
  const q = c.req.query();
  const conditions = [];

  if (q.job_id) conditions.push(eq(jobs.id, q.job_id));
  if (q.candidate_id) conditions.push(eq(candidates.id, q.candidate_id));
  if (q.client_id) conditions.push(eq(clients.id, q.client_id));
  if (q.status) {
    if (!isInterviewStatus(q.status)) {
      return error(c, 400, `invalid status: ${q.status}`);
    }
    conditions.push(eq(interviews.status, q.status));
  }
  const from = toDate(q.from);
  const to = toDate(q.to);
  if (from) conditions.push(gte(interviews.scheduledAt, from));
  if (to) conditions.push(lte(interviews.scheduledAt, to));

  const rows = await db
    .select(rowShape)
    .from(interviews)
    .innerJoin(jobCandidateMatches, eq(interviews.matchId, jobCandidateMatches.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(interviews.scheduledAt));

  return json(c, rows);
});

interviewsRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);

  const matchId = typeof body?.match_id === "string" ? body.match_id : "";
  if (!matchId) return error(c, 400, "match_id is required");

  const [match] = await db
    .select({ id: jobCandidateMatches.id })
    .from(jobCandidateMatches)
    .where(eq(jobCandidateMatches.id, matchId))
    .limit(1);
  if (!match) return error(c, 404, "match not found");

  const round = typeof body?.round === "string" ? body.round.trim() : null;
  const interviewer =
    typeof body?.interviewer === "string" ? body.interviewer.trim() : null;
  const scheduledAt = toDate(body?.scheduled_at);
  if (body?.scheduled_at !== undefined && !scheduledAt) {
    return error(c, 400, "invalid scheduled_at");
  }

  const [created] = await db
    .insert(interviews)
    .values({
      matchId,
      round: round || null,
      interviewer: interviewer || null,
      scheduledAt,
      status: "scheduled",
    })
    .returning();

  return json(c, created, 201);
});

interviewsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(interviews)
    .where(eq(interviews.id, id))
    .limit(1);
  if (!existing) return error(c, 404, "interview not found");

  const body = await c.req.json().catch(() => null);

  const updates: Partial<typeof interviews.$inferInsert> = {};

  if (body?.status !== undefined) {
    if (!isInterviewStatus(body.status)) {
      return error(c, 400, `invalid status: ${body.status}`);
    }
    updates.status = body.status;
  }
  if (body?.feedback !== undefined) {
    updates.feedback = typeof body.feedback === "string" ? body.feedback : null;
  }
  if (body?.scheduled_at !== undefined) {
    const d = toDate(body.scheduled_at);
    if (!d) return error(c, 400, "invalid scheduled_at");
    updates.scheduledAt = d;
  }

  const [updated] = await db
    .update(interviews)
    .set(updates)
    .where(eq(interviews.id, id))
    .returning();

  return json(c, updated);
});

interviewsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [deleted] = await db
    .delete(interviews)
    .where(eq(interviews.id, id))
    .returning();
  if (!deleted) return error(c, 404, "interview not found");
  return json(c, { ok: true });
});

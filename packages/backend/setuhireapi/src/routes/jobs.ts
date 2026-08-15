import { Hono } from "hono";
import { requireAuth } from "../lib/auth.js";
import { error, json } from "../lib/http.js";
import { parseJobFromText, parseJobFromUrl } from "../services/ai.js";
import {
  assignVendor,
  createJob,
  deleteJob,
  getJob,
  getPipelineSummary,
  getVendorAssignments,
  listJobs,
  matchJob,
  updateJob,
  type CreateJobInput,
  type UpdateJobInput,
} from "../services/jobs.js";

const JOB_STATUSES = ["open", "on_hold", "filled", "closed"] as const;
const EMPLOYMENT_TYPES = ["fte", "contract"] as const;

const isStatus = (v: unknown): v is (typeof JOB_STATUSES)[number] =>
  typeof v === "string" && (JOB_STATUSES as readonly string[]).includes(v);
const isEmploymentType = (v: unknown): v is (typeof EMPLOYMENT_TYPES)[number] =>
  typeof v === "string" && (EMPLOYMENT_TYPES as readonly string[]).includes(v);

export const jobsRoutes = new Hono();

jobsRoutes.use("*", requireAuth);

jobsRoutes.get("/", async (c) => {
  const clientId = c.req.query("client_id");
  const techStack = c.req.query("tech_stack");
  const status = c.req.query("status");
  const employmentType = c.req.query("employment_type");

  if (status && !isStatus(status)) return error(c, 400, "invalid status");
  if (employmentType && !isEmploymentType(employmentType))
    return error(c, 400, "invalid employment_type");

  const rows = await listJobs({
    clientId,
    techStack,
    status: status as (typeof JOB_STATUSES)[number] | undefined,
    employmentType: employmentType as (typeof EMPLOYMENT_TYPES)[number] | undefined,
  });
  return json(c, rows);
});

jobsRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const clientId = typeof body?.client_id === "string" ? body.client_id.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!clientId || !title) return error(c, 400, "client_id and title are required");

  const employmentType = body?.employment_type;
  if (employmentType != null && !isEmploymentType(employmentType))
    return error(c, 400, "invalid employment_type");

  const input: CreateJobInput = {
    clientId,
    title,
    techStack: Array.isArray(body?.tech_stack) ? body.tech_stack.filter((s: unknown) => typeof s === "string") : undefined,
    experienceRequired: typeof body?.experience_required === "string" ? body.experience_required : undefined,
    targetSellingCost: body?.target_selling_cost == null ? undefined : Number(body.target_selling_cost),
    currency: typeof body?.currency === "string" ? body.currency : undefined,
    employmentType: employmentType == null ? undefined : (employmentType as (typeof EMPLOYMENT_TYPES)[number]),
    description: typeof body?.description === "string" ? body.description : undefined,
    rawJdText: typeof body?.raw_jd_text === "string" ? body.raw_jd_text : undefined,
    sourceUrl: typeof body?.source_url === "string" ? body.source_url : undefined,
  };

  const job = await createJob(input);
  return json(c, job, 201);
});

jobsRoutes.post("/fetch-from-url", async (c) => {
  const body = await c.req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return error(c, 400, "url is required");
  return json(c, await parseJobFromUrl(url));
});

jobsRoutes.post("/parse-text", async (c) => {
  const body = await c.req.json().catch(() => null);
  const rawText = typeof body?.raw_text === "string" ? body.raw_text : "";
  if (!rawText) return error(c, 400, "raw_text is required");
  return json(c, await parseJobFromText(rawText));
});

jobsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const job = await getJob(id);
  if (!job) return error(c, 404, "not found");

  const [vendorAssignments, pipelineSummary] = await Promise.all([
    getVendorAssignments(id),
    getPipelineSummary(id),
  ]);
  return json(c, { ...job, vendorAssignments, pipelineSummary });
});

jobsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await getJob(id);
  if (!existing) return error(c, 404, "not found");

  const body = await c.req.json().catch(() => null);

  const employmentType = body?.employment_type;
  if (employmentType != null && !isEmploymentType(employmentType))
    return error(c, 400, "invalid employment_type");
  const status = body?.status;
  if (status != null && !isStatus(status)) return error(c, 400, "invalid status");

  const input: UpdateJobInput = {};
  if (typeof body?.client_id === "string") input.clientId = body.client_id.trim();
  if (typeof body?.title === "string") input.title = body.title.trim();
  if (Array.isArray(body?.tech_stack)) input.techStack = body.tech_stack.filter((s: unknown) => typeof s === "string");
  if (typeof body?.experience_required === "string") input.experienceRequired = body.experience_required;
  if (body?.target_selling_cost != null) input.targetSellingCost = Number(body.target_selling_cost);
  if (typeof body?.currency === "string") input.currency = body.currency;
  if (employmentType != null) input.employmentType = employmentType as (typeof EMPLOYMENT_TYPES)[number];
  if (status != null) input.status = status as (typeof JOB_STATUSES)[number];
  if (typeof body?.description === "string") input.description = body.description;
  if (typeof body?.raw_jd_text === "string") input.rawJdText = body.raw_jd_text;
  if (typeof body?.source_url === "string") input.sourceUrl = body.source_url;

  const updated = await updateJob(id, input);
  return json(c, updated);
});

jobsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await getJob(id);
  if (!existing) return error(c, 404, "not found");
  await deleteJob(id);
  return json(c, { ok: true });
});

jobsRoutes.post("/:id/match", async (c) => {
  const id = c.req.param("id");
  const job = await getJob(id);
  if (!job) return error(c, 404, "not found");
  return json(c, await matchJob(id));
});

jobsRoutes.post("/:id/assign-vendor", async (c) => {
  const id = c.req.param("id");
  const job = await getJob(id);
  if (!job) return error(c, 404, "not found");

  const body = await c.req.json().catch(() => null);
  const vendorId = typeof body?.vendor_id === "string" ? body.vendor_id.trim() : "";
  if (!vendorId) return error(c, 400, "vendor_id is required");

  const sourcingCost = body?.sourcing_cost == null ? null : Number(body.sourcing_cost);
  const assignment = await assignVendor(id, vendorId, sourcingCost);
  return json(c, assignment, 201);
});

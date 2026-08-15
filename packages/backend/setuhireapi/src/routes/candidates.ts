import { Hono } from "hono";
import { requireAuth } from "../lib/auth.js";
import { error, json } from "../lib/http.js";
import {
  MAX_RESUME_BYTES,
  createCandidate,
  deleteCandidate,
  getCandidateDetail,
  isCandidateStatus,
  isSourceType,
  listCandidates,
  resumeContentType,
  storeResume,
  updateCandidate,
  type CandidateFilters,
  type CandidateInput,
} from "../services/candidates.js";

export const candidatesRoutes = new Hono();

candidatesRoutes.use("*", requireAuth);

const numInput = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

function buildInput(body: Record<string, unknown>): CandidateInput {
  const skills = Array.isArray(body.skills) ? body.skills.map(String) : [];
  return {
    name: String(body.name ?? "").trim(),
    email: strOrNull(body.email),
    phone: strOrNull(body.phone),
    skills,
    experienceYears: numInput(body.experience_years),
    currentStatus: isCandidateStatus(String(body.current_status ?? ""))
      ? (body.current_status as CandidateInput["currentStatus"])
      : undefined,
    sourceType: isSourceType(String(body.source_type ?? ""))
      ? (body.source_type as CandidateInput["sourceType"])
      : undefined,
    sourceVendorId: strOrNull(body.source_vendor_id),
    rateExpectation: numInput(body.rate_expectation),
    resumeUrl: strOrNull(body.resume_url),
  };
}

candidatesRoutes.get("/", async (c) => {
  const status = c.req.query("status");
  const source = c.req.query("source");
  const skill = c.req.query("skill");

  if (status && !isCandidateStatus(status)) return error(c, 400, "invalid status");
  if (source && !isSourceType(source)) return error(c, 400, "invalid source");

  const filters: CandidateFilters = {
    status: status as CandidateFilters["status"],
    source: source as CandidateFilters["source"],
    skill: skill ?? undefined,
  };

  return json(c, await listCandidates(filters));
});

candidatesRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return error(c, 400, "invalid body");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return error(c, 400, "name is required");

  if (body.current_status !== undefined && !isCandidateStatus(String(body.current_status))) {
    return error(c, 400, "invalid current_status");
  }
  if (body.source_type !== undefined && !isSourceType(String(body.source_type))) {
    return error(c, 400, "invalid source_type");
  }

  return json(c, await createCandidate(buildInput(body as Record<string, unknown>)), 201);
});

candidatesRoutes.post("/upload-resume", async (c) => {
  const body = await c.req.parseBody().catch(() => null);
  const file = body?.file;

  if (!file || typeof file === "string") {
    return error(c, 400, "multipart field 'file' is required");
  }

  const f = file as File;
  const filename = f.name;
  if (!filename || !/\.(pdf|docx)$/i.test(filename)) {
    return error(c, 400, "only PDF and DOCX files are accepted");
  }
  if (f.size > MAX_RESUME_BYTES) {
    return error(c, 400, "file exceeds 10MB limit");
  }

  const buffer = Buffer.from(await f.arrayBuffer());
  const { parsedProfile, resumeKey } = await storeResume(
    buffer,
    filename,
    resumeContentType(filename, f.type),
  );

  return json(c, { parsed_profile: parsedProfile, resume_key: resumeKey });
});

candidatesRoutes.get("/:id", async (c) => {
  const detail = await getCandidateDetail(c.req.param("id"));
  if (!detail) return error(c, 404, "candidate not found");
  return json(c, detail);
});

candidatesRoutes.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return error(c, 400, "invalid body");

  if (body.current_status !== undefined && !isCandidateStatus(String(body.current_status))) {
    return error(c, 400, "invalid current_status");
  }
  if (body.source_type !== undefined && !isSourceType(String(body.source_type))) {
    return error(c, 400, "invalid source_type");
  }

  const input = buildInput(body as Record<string, unknown>);
  const patch: Partial<CandidateInput> = {};

  if (body.name !== undefined) patch.name = input.name;
  if (body.email !== undefined) patch.email = input.email;
  if (body.phone !== undefined) patch.phone = input.phone;
  if (body.skills !== undefined) patch.skills = input.skills;
  if (body.experience_years !== undefined) patch.experienceYears = input.experienceYears;
  if (body.current_status !== undefined) patch.currentStatus = input.currentStatus;
  if (body.source_type !== undefined) patch.sourceType = input.sourceType;
  if (body.source_vendor_id !== undefined) patch.sourceVendorId = input.sourceVendorId;
  if (body.rate_expectation !== undefined) patch.rateExpectation = input.rateExpectation;
  if (body.resume_url !== undefined) patch.resumeUrl = input.resumeUrl;

  if (Object.keys(patch).length === 0) return error(c, 400, "nothing to update");

  const updated = await updateCandidate(c.req.param("id"), patch);
  if (!updated) return error(c, 404, "candidate not found");
  return json(c, updated);
});

candidatesRoutes.delete("/:id", async (c) => {
  const ok = await deleteCandidate(c.req.param("id"));
  if (!ok) return error(c, 404, "candidate not found");
  return json(c, { ok: true });
});

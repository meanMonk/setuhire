import Anthropic from "@anthropic-ai/sdk";
import type { candidates, jobs } from "../db/schema.js";

export type Job = typeof jobs.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;

export type JobPreview = {
  title: string;
  skills: { must_have: string[]; nice_to_have: string[] };
  min_experience?: number | null;
  max_experience?: number | null;
  employment_type?: "fte" | "contract" | null;
  seniority?: string | null;
};

export type CandidateProfile = {
  skills: string[];
  experience_years?: number | null;
  roles?: { title: string; company: string; duration?: string; tech?: string[] }[];
  education?: string;
  certifications?: string[];
};

export type MatchResult = {
  candidate: Candidate;
  score: number;
  rationale: string;
  source: string;
  key_skills_overlap: string[];
  rate_fit: "ok" | "above_tsc";
};

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
const MAX_TOKENS = 1500;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");

const SKILL_SYNONYMS: Record<string, string> = {
  "reactjs": "react",
  "react.js": "react",
  "nodejs": "node",
  "node.js": "node",
  "nextjs": "next",
  "next.js": "next",
  "vuejs": "vue",
  "vue.js": "vue",
  "typescript": "ts",
  "golang": "go",
  "postgresql": "postgres",
  "amazonwebservices": "aws",
};

const canonicalSkill = (s: string): string => {
  const n = normalize(s).replace(/\./g, "");
  return SKILL_SYNONYMS[n] ?? n;
};

const skillMatches = (required: string, candidate: string): boolean => {
  const a = canonicalSkill(required);
  const b = canonicalSkill(candidate);
  if (a === "" || b === "") return false;
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3) return a.includes(b) || b.includes(a);
  return false;
};

const dedupe = (arr: string[]): string[] => [...new Set(arr)];

const extractTokens = (line: string): string[] =>
  line
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

const titleCase = (s: string) =>
  s
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    return new Anthropic({ apiKey: key });
  } catch {
    return null;
  }
}

function stripFences(text: string): string {
  return text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(stripFences(text)) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function complete(system: string, user: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
    });
    return res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
  } catch {
    return null;
  }
}

const JOB_SYSTEM = `You are a technical recruiter parsing a job description into a structured preview.
Respond with ONLY a JSON object (no markdown, no explanation) shaped exactly as:
{
  "title": string,
  "skills": { "must_have": string[], "nice_to_have": string[] },
  "min_experience": number | null,
  "max_experience": number | null,
  "employment_type": "fte" | "contract" | null,
  "seniority": string | null
}`;

const RESUME_SYSTEM = `You are a technical recruiter parsing a resume into a structured candidate profile.
Respond with ONLY a JSON object (no markdown, no explanation) shaped exactly as:
{
  "skills": string[],
  "experience_years": number | null,
  "roles": [{ "title": string, "company": string, "duration": string | null, "tech": string[] }],
  "education": string | null,
  "certifications": string[]
}`;

function sanitizeJobPreview(raw: unknown, fallback: JobPreview): JobPreview {
  const o = (raw ?? {}) as Partial<JobPreview> & {
    skills?: Partial<JobPreview["skills"]>;
  };
  const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : fallback.title;
  const must = Array.isArray(o.skills?.must_have)
    ? o.skills!.must_have!.filter((s): s is string => typeof s === "string")
    : fallback.skills.must_have;
  const nice = Array.isArray(o.skills?.nice_to_have)
    ? o.skills!.nice_to_have!.filter((s): s is string => typeof s === "string")
    : fallback.skills.nice_to_have;
  const numOr = (v: unknown, fb: number | null | undefined): number | null | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : fb;
  const emp = o.employment_type === "fte" || o.employment_type === "contract" ? o.employment_type : fallback.employment_type;
  const seniority = typeof o.seniority === "string" ? o.seniority : fallback.seniority;
  return {
    title,
    skills: { must_have: dedupe(must), nice_to_have: dedupe(nice) },
    min_experience: numOr(o.min_experience, fallback.min_experience),
    max_experience: numOr(o.max_experience, fallback.max_experience),
    employment_type: emp,
    seniority,
  };
}

function sanitizeProfile(raw: unknown, fallback: CandidateProfile): CandidateProfile {
  const o = (raw ?? {}) as Partial<CandidateProfile>;
  const skills = Array.isArray(o.skills)
    ? o.skills.filter((s): s is string => typeof s === "string")
    : fallback.skills;
  const roles = Array.isArray(o.roles)
    ? o.roles
        .filter((r): r is NonNullable<CandidateProfile["roles"]>[number] => !!r && typeof r === "object")
        .map((r) => ({
          title: typeof r.title === "string" ? r.title : "Unknown role",
          company: typeof r.company === "string" ? r.company : "Unknown company",
          duration: typeof r.duration === "string" ? r.duration : undefined,
          tech: Array.isArray(r.tech) ? r.tech.filter((t): t is string => typeof t === "string") : undefined,
        }))
    : fallback.roles;
  return {
    skills: dedupe(skills),
    experience_years:
      typeof o.experience_years === "number" && Number.isFinite(o.experience_years)
        ? o.experience_years
        : fallback.experience_years,
    roles: roles && roles.length > 0 ? roles : fallback.roles,
    education: typeof o.education === "string" ? o.education : fallback.education,
    certifications: Array.isArray(o.certifications)
      ? o.certifications.filter((c): c is string => typeof c === "string")
      : fallback.certifications,
  };
}

async function fetchUrlText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "setuhire-api" } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    const stripped = text.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return stripped.length > 40 ? stripped.slice(0, 12000) : null;
  } catch {
    return null;
  }
}

function slugTitle(url: string): string {
  const clean = (url ?? "").trim();
  const last = clean.split("/").filter(Boolean).pop() ?? "";
  return titleCase(last.replace(/[-_]+/g, " ").replace(/\.[a-z0-9]+$/i, "").trim()) || "Untitled position";
}

export async function parseJobFromUrl(url: string): Promise<JobPreview> {
  const fallback: JobPreview = {
    title: slugTitle(url),
    skills: { must_have: [], nice_to_have: [] },
    min_experience: null,
    max_experience: null,
    employment_type: null,
    seniority: null,
  };
  if (!getClient()) return fallback;

  const pageText = await fetchUrlText(url);
  const input = pageText ?? url;
  const out = await complete(JOB_SYSTEM, input);
  if (!out) return fallback;
  return sanitizeJobPreview(parseJson<JobPreview>(out), fallback);
}

export async function parseJobFromText(rawText: string): Promise<JobPreview> {
  const lines = (rawText ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const title = titleCase(lines[0] ?? "") || "Untitled position";
  const mustHave: string[] = [];
  const niceToHave: string[] = [];
  for (const line of lines.slice(1)) {
    const low = line.toLowerCase();
    if (low.startsWith("nice") || low.startsWith("good to have") || low.startsWith("preferred")) {
      niceToHave.push(...extractTokens(line));
    } else {
      mustHave.push(...extractTokens(line));
    }
  }
  const exp = lines[0]?.match(/(\d+)\s*\+?\s*(?:yrs?|years?)/i);
  const fallback: JobPreview = {
    title,
    skills: { must_have: dedupe(mustHave), nice_to_have: dedupe(niceToHave) },
    min_experience: exp ? Number(exp[1]) : null,
    max_experience: null,
    employment_type: null,
    seniority: null,
  };
  if (!getClient() || !(rawText ?? "").trim()) return fallback;

  const out = await complete(JOB_SYSTEM, rawText);
  if (!out) return fallback;
  return sanitizeJobPreview(parseJson<JobPreview>(out), fallback);
}

function extractTextFromBuffer(buffer: Buffer): string | null {
  try {
    const text = buffer.toString("utf8");
    const printable = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ");
    const lines = printable
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 1);
    const joined = lines.join("\n");
    return joined.length > 80 ? joined.slice(0, 12000) : null;
  } catch {
    return null;
  }
}

export async function parseResume(buffer: Buffer, filename: string): Promise<CandidateProfile> {
  const base = (filename ?? "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
  const fallback: CandidateProfile = {
    skills: [],
    experience_years: null,
    roles: [{ title: titleCase(base) || "Unknown role", company: "Unknown company" }],
  };
  if (!getClient()) return fallback;

  const text = extractTextFromBuffer(buffer ?? Buffer.alloc(0));
  if (!text) return fallback;
  const out = await complete(RESUME_SYSTEM, text);
  if (!out) return fallback;
  return sanitizeProfile(parseJson<CandidateProfile>(out), fallback);
}

function expRangeFromString(exp: string | null | undefined): { min: number | null; max: number | null } {
  if (!exp) return { min: null, max: null };
  const range = exp.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const plus = exp.match(/(\d+(?:\.\d+)?)\s*\+/);
  if (plus) return { min: Number(plus[1]), max: null };
  return { min: null, max: null };
}

function fallbackRationale(mustMatched: string[], expYears: number | null, minExp: number | null, rateFitFlag: "ok" | "above_tsc", tsc: number | null): string {
  const skill = mustMatched.length ? `Strong ${mustMatched.slice(0, 3).join(", ")}` : "Limited skill overlap";
  const exp = expYears != null ? `${expYears} yrs vs ${minExp ?? "-"}+ required` : "experience unknown";
  const rate = tsc != null ? `rate ${rateFitFlag === "ok" ? "ok" : "above TSC"}` : "rate N/A";
  return `${skill}; ${exp}; ${rate}.`;
}

async function enrichRationales(job: Job, results: MatchResult[], mustHave: string[], niceHave: string[]): Promise<void> {
  const client = getClient();
  if (!client) return;
  const parsed = job.parsedRequirements ?? null;
  const preview = {
    title: job.title,
    must_have: mustHave,
    nice_to_have: niceHave,
    min_experience: parsed?.min_experience ?? null,
    max_experience: parsed?.max_experience ?? null,
    target_selling_cost: job.targetSellingCost != null ? Number(job.targetSellingCost) : null,
  };
  const top = results.slice(0, 20);
  const rows = top.map((r, i) => ({
    idx: i,
    name: r.candidate.name,
    skills: r.candidate.skills ?? [],
    experience_years: r.candidate.experienceYears != null ? Number(r.candidate.experienceYears) : null,
    rate_expectation: r.candidate.rateExpectation != null ? Number(r.candidate.rateExpectation) : null,
    score: r.score,
  }));

  const system = `You are a recruiting assistant. For each candidate (by idx), write a 2-3 sentence plain-English rationale explaining why they match (or don't) the job, referencing skill overlap, experience, and rate fit.
Respond with ONLY a JSON object: { "rationales": { "<idx>": "<rationale>" } }`;
  const out = await complete(system, JSON.stringify({ job: preview, candidates: rows }, null, 2));
  if (!out) return;
  const parsedOut = parseJson<{ rationales?: Record<string, string> }>(out);
  if (!parsedOut?.rationales) return;

  for (let i = 0; i < top.length; i++) {
    const text = parsedOut.rationales[String(i)];
    if (typeof text === "string" && text.trim()) top[i]!.rationale = text.trim();
  }
}

export async function runMatch(job: Job, candidateRows: Candidate[]): Promise<MatchResult[]> {
  const rows = candidateRows ?? [];
  if (rows.length === 0) return [];

  const parsed = job.parsedRequirements ?? null;
  const mustHave = parsed?.must_have_skills?.length ? parsed.must_have_skills : (job.techStack ?? []);
  const niceHave = parsed?.nice_to_have_skills ?? [];
  const derived = expRangeFromString(job.experienceRequired);
  const minExp = parsed?.min_experience ?? derived.min;
  const maxExp = parsed?.max_experience ?? derived.max;
  const tsc = job.targetSellingCost != null ? Number(job.targetSellingCost) : null;

  const results: MatchResult[] = rows.map((cand) => {
    const skills = cand.skills ?? [];
    const mustMatched = mustHave.filter((r) => skills.some((s) => skillMatches(r, s)));
    const niceMatched = niceHave.filter((r) => skills.some((s) => skillMatches(r, s)));
    const overlap = dedupe([...mustMatched, ...niceMatched]);

    const mustCov = mustHave.length ? mustMatched.length / mustHave.length : 0;
    const niceCov = niceHave.length ? niceMatched.length / niceHave.length : 0;

    const expYears = cand.experienceYears != null ? Number(cand.experienceYears) : null;
    let expFit: number;
    if (expYears == null) expFit = 0.5;
    else if (minExp != null && expYears < minExp) expFit = -0.5;
    else if (maxExp != null && expYears > maxExp) expFit = -0.2;
    else expFit = 1;

    const rate = cand.rateExpectation != null ? Number(cand.rateExpectation) : null;
    let rateFit: number;
    if (rate == null) rateFit = 0.5;
    else if (tsc == null) rateFit = 1;
    else if (rate <= tsc) rateFit = 1;
    else rateFit = tsc > 0 ? tsc / rate : 0;

    const score = clamp(Math.round(50 * mustCov + 15 * niceCov + 20 * expFit + 15 * rateFit));
    const rateFitFlag: "ok" | "above_tsc" = rate != null && tsc != null && rate > tsc ? "above_tsc" : "ok";

    return {
      candidate: cand,
      score,
      rationale: fallbackRationale(mustMatched, expYears, minExp, rateFitFlag, tsc),
      source: cand.sourceType ?? "direct",
      key_skills_overlap: overlap,
      rate_fit: rateFitFlag,
    };
  });

  results.sort((a, b) => b.score - a.score);

  await enrichRationales(job, results, mustHave, niceHave);

  return results;
}

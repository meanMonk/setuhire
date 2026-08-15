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

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");

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

export async function parseJobFromUrl(url: string): Promise<JobPreview> {
  const clean = (url ?? "").trim();
  const last = clean.split("/").filter(Boolean).pop() ?? "";
  const title =
    titleCase(last.replace(/[-_]+/g, " ").replace(/\.[a-z0-9]+$/i, "").trim()) ||
    "Untitled position";
  return {
    title,
    skills: { must_have: [], nice_to_have: [] },
    min_experience: null,
    max_experience: null,
    employment_type: null,
    seniority: null,
  };
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
    } else if (low.startsWith("must") || low.startsWith("required") || low.startsWith("requirement")) {
      mustHave.push(...extractTokens(line));
    } else {
      mustHave.push(...extractTokens(line));
    }
  }
  const dedupe = (arr: string[]) => [...new Set(arr)];
  const exp = lines[0]?.match(/(\d+)\s*\+?\s*(?:yrs?|years?)/i);
  return {
    title,
    skills: { must_have: dedupe(mustHave), nice_to_have: dedupe(niceToHave) },
    min_experience: exp ? Number(exp[1]) : null,
    max_experience: null,
    employment_type: null,
    seniority: null,
  };
}

export async function parseResume(_buffer: Buffer, filename: string): Promise<CandidateProfile> {
  const base = (filename ?? "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
  return {
    skills: [],
    experience_years: null,
    roles: [{ title: titleCase(base) || "Unknown role", company: "Unknown company" }],
  };
}

export async function runMatch(job: Job, candidateRows: Candidate[]): Promise<MatchResult[]> {
  const required = job.techStack ?? [];
  const tsc = job.targetSellingCost != null ? Number(job.targetSellingCost) : null;

  const results = (candidateRows ?? []).map((cand) => {
    const skills = cand.skills ?? [];
    const overlap = required.filter((r) =>
      skills.some((s) => {
        const a = normalize(r);
        const b = normalize(s);
        return a !== "" && (a === b || a.includes(b) || b.includes(a));
      }),
    );
    const score = required.length === 0 ? 0 : Math.round((overlap.length / required.length) * 100);
    const rationale = overlap.length
      ? `Covers ${overlap.length}/${required.length} required skills (${overlap.join(", ")}).`
      : "No overlap with required skills.";
    const rate = cand.rateExpectation != null ? Number(cand.rateExpectation) : null;
    const rateFit: "ok" | "above_tsc" =
      rate != null && tsc != null && rate > tsc ? "above_tsc" : "ok";
    return {
      candidate: cand,
      score,
      rationale,
      source: cand.sourceType ?? "direct",
      key_skills_overlap: overlap,
      rate_fit: rateFit,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

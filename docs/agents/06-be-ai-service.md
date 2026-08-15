# 06 — BE-AI-SERVICE (Wave 1, parallel)

Upgrades `src/services/ai.ts` (stub created by agent 00). Touch ONLY that file.

## Context
Agent 00 shipped a deterministic-fallback stub with these exact signatures. Keep the signatures identical (agents 03/04 already import them). Replace the bodies with real AI where possible, **keeping the deterministic fallback when no `ANTHROPIC_API_KEY` is set.**

```
parseJobFromUrl(url: string) -> Promise<JobPreview>
parseJobFromText(rawText: string) -> Promise<JobPreview>
parseResume(buffer: Buffer, filename: string) -> Promise<CandidateProfile>
runMatch(job: Job, candidates: Candidate[]) -> Promise<MatchResult[]>
```

## Implementation
- **LLM client:** Anthropic SDK (`@anthropic-ai/sdk`, add dep). API key from `ANTHROPIC_API_KEY`. Model: `claude-sonnet-4-20250514` (or current default). Use `{ messages, max_tokens }` with a JSON-output prompt; parse the JSON safely (strip fences). If key missing or call fails → fall back to the deterministic stub and proceed.
- **JobPreview shape** (PRD §5): `{ title, skills: { must_have: string[], nice_to_have: string[] }, min_experience?, max_experience?, employment_type?, seniority? }`.
- **CandidateProfile shape** (PRD §5): `{ skills: string[], experience_years?, roles: [{title, company, duration?, tech: string[]}], education?, certifications? }`.
- **`runMatch` (deterministic — no LLM per candidate, per PRD §5 note):**
  1. Must-have coverage (50%): `matched_must / must_have.length` with synonym matching (case-insensitive; substring/normalize "ReactJS"="React").
  2. Nice-to-have coverage (15%): same.
  3. Experience fit (20%): score 1 if within [min,max]; -0.5 if below min; -0.2 if above max; 0.5 if no exp data.
  4. Rate fit (15%): candidate.rate_expectation vs job.target_selling_cost — 1 if rate <= TSC; scale down if exceeds.
  5. `score = round((50*1 + 15*2 + 20*3 + 15*4))`, clamp 0–100.
- **`match_rationale`:** single LLM call for top-N (max 20) candidates (PRD §5 Stage 3): input = candidate profile + job preview → 2–3 line plain-English rationale. Fallback: build a short deterministic sentence ("Strong <skill overlap>; <exp> yrs vs <min>+ required; rate <ok/above TSC>").
- `MatchResult`: `{ candidate, score, rationale, source, key_skills_overlap: string[], rate_fit: 'ok'|'above_tsc' }`.

## Rules
- No route code, no schema changes. Only `services/ai.ts` + package.json dep.
- Guard against empty input (no skills / no candidates → return gracefully, never throw).
- Parse LLM JSON robustly: try/catch + strip code fences; on any failure return the deterministic result.

## Verify
```bash
cd packages/backend/setuhireapi && pnpm typecheck
# without ANTHROPIC_API_KEY (fallback path):
pnpm dev  # then: login + curl -X POST localhost:3400/api/v1/jobs/j1/match
# with a key set, same call → real rationale text in the response.
```
Report: signatures unchanged, fallback + LLM evidence.

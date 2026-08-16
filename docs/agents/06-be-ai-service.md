# 06 — BE-AI-SERVICE (Wave 1, parallel)

**Owner files:** `src/services/ai.ts` only (+ package.json dep if needed)  
**PO lens:** AI is a *force multiplier*, not a black box. Parsing must be editable. Matching must be fast, explainable, and flag “call now” (≥90). Never block the product if the API key is missing.

---

## Signatures (LOCKED — do not change)

```ts
parseJobFromUrl(url: string): Promise<JobPreview>
parseJobFromText(rawText: string): Promise<JobPreview>
parseResume(buffer: Buffer, filename: string): Promise<CandidateProfile>
runMatch(job: Job, candidates: Candidate[]): Promise<MatchResult[]>
```

Foundation stub already exports these. Replace bodies; keep fallbacks.

---

## Output shapes (what UI edits)

### JobPreview
```ts
{
  title: string,
  skills: { must_have: string[], nice_to_have: string[] },
  min_experience?: number,
  max_experience?: number,
  employment_type?: 'fte' | 'contract' | string,
  seniority?: string,
  experience_required?: string,  // e.g. "6+ years" for form field
  description?: string
}
```

### CandidateProfile
```ts
{
  skills: string[],
  experience_years?: number,
  roles?: Array<{ title: string, company: string, duration?: string, tech?: string[] }>,
  education?: string | string[],
  certifications?: string[],
  // optional extract if present in resume:
  name?, email?, phone?, rate_hint?
}
```

### MatchResult
```ts
{
  candidate: Candidate,       // pass-through input row
  score: number,              // 0–100
  rationale: string,          // 2–3 lines plain English
  source: string,             // 'direct' or vendor label if available on candidate
  key_skills_overlap: string[],
  rate_fit: 'ok' | 'above_tsc'
}
```

---

## Implementation

### LLM (optional path)
- `@anthropic-ai/sdk`, key `ANTHROPIC_API_KEY`, model `claude-sonnet-4-20250514` (or current default)  
- JSON-only prompts; strip fences; try/catch  
- Missing key OR failure → **deterministic fallback**, never throw to caller  

### `runMatch` scoring (deterministic — always)
| Factor | Weight | Logic |
|--------|--------|-------|
| Must-have coverage | 50% | matched_must / must_have.length; synonym/normalize (reactjs≈react) |
| Nice-to-have | 15% | same |
| Experience fit | 20% | 1 in [min,max]; 0.5 if no data; −0.5 below min; −0.2 above max |
| Rate fit | 15% | 1 if rate ≤ TSC; scale down if above; 0.5 if missing |

`score = round(100 * weighted)` clamp 0–100  

Bands (document for UI):  
- 90–100 priority call  
- 75–89 strong  
- <75 visible, not flagged  

### Rationale
- Prefer **one** LLM batch for top-N (max 20) after scores sorted  
- Fallback sentence: `"Strong <overlap>; <exp> yrs vs <min>+ required; rate <ok|above TSC>"`  

### Job parse fallback (no key)
- Heuristic: first line title-ish; tokenize skills from known tech dictionary; exp regex `(\d+)\+?\s*years?`  

### Resume parse fallback
- PDF text extract if simple; else empty skills + filename-based stub — still return valid object  

### Guards
- Empty candidates → `[]`  
- Empty must_have → score from nice/exp/rate only (renormalize or treat must as 1)  
- Never throw on bad buffer — return empty profile  

---

## Verify
```bash
cd packages/backend/setuhireapi && pnpm typecheck
# without key: POST /jobs/:id/match → scores + deterministic rationales
# with key: rationales richer English
```
Report: signatures unchanged; fallback + optional LLM evidence.

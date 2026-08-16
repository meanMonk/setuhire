# 02 — BE-CLIENTS-VENDORS (Wave 1, parallel)

**Owner files:**  
- `src/routes/clients.ts`, `src/routes/vendors.ts`  
- `src/services/clients.ts`, `src/services/vendors.ts` (optional if thin)

**PO lens:** Clients = money in. Vendors = supply. CEO needs “who pays us, who supplies us, what’s open, what’s stuck” in one glance.

---

## A. Clients — product model

### Why these fields exist
| Field | CEO use |
|-------|---------|
| `name`, `industry` | Find account fast; segment pipeline |
| `contact_person/email/phone` | Call in 5 sec from detail |
| `status` active/on_hold/lost | Don’t chase dead accounts |
| `engagement_start_date` | Tenure / relationship age |
| jobsCount / activeJobsCount | Workload per account |
| lastEngagementAt | Who went cold (max note date or job activity) |
| resourcesHired[] | Who is billing under this client today |
| engagementHistory[] | Call log — never lose tribal notes |
| pricing snapshot per job | TSC vs sourcing vs margin without Excel |

### Endpoints
```
GET    /api/v1/clients              ?status=&industry=&q=
POST   /api/v1/clients              { name, industry?, contact_person?, contact_email?, contact_phone?, status?, engagement_start_date? }
GET    /api/v1/clients/:id          → full detail (below)
PATCH  /api/v1/clients/:id
DELETE /api/v1/clients/:id
GET    /api/v1/clients/:id/jobs     ?status=
POST   /api/v1/clients/:id/notes    { note }
```

### List row shape (each client)
```ts
{
  id, name, industry, status,
  contactPerson, contactEmail, contactPhone,
  engagementStartDate,
  jobsCount: number,           // all jobs
  activeJobsCount: number,     // status=open
  lastEngagementAt: string|null, // latest client_notes.createdAt OR latest job.createdAt
  createdAt
}
```
- Filters: `status` enum eq, `industry` ILIKE contains, optional `q` ILIKE on name  
- Order: name ASC  

### Detail shape
```ts
{
  ...list fields,
  jobs: Array<{
    id, title, status, employmentType, techStack,
    targetSellingCost, currency, experienceRequired,
    pipelineCount,          // matches not rejected/placed optional: all non-rejected
    topMatchScore: number|null,
    // pricing block for CEO
    sourcingCost: number|null,   // from primary/latest job_vendor_assignment
    margin: number|null,         // TSC - sourcingCost when both set
    assignedVendors: Array<{ vendorId, vendorName, sourcingCost, assignedAt }>
  }>,
  resourcesHired: Array<{
    candidateId, candidateName, jobId, jobTitle,
    employmentType, stage: 'placed', placedAt, matchId
  }>,
  profilesSent: Array<{
    matchId, candidateId, candidateName, jobId, jobTitle,
    stage, matchScore, createdAt
  }>,  // all matches for client's jobs (or stage != rejected)
  engagementHistory: Array<{
    id, note, createdAt, createdBy: { id, name }
  }>,  // newest first
}
```

### Create / patch body
| Field | Req on create | Notes |
|-------|---------------|-------|
| name | yes | unique-ish not enforced MVP |
| industry | no | free text |
| contact_person, contact_email, contact_phone | no | |
| status | no | default `active`; enum only |
| engagement_start_date | no | ISO date |

### Notes
- `POST .../notes` → `createdBy = getUserId()`  
- 404 missing id; 400 bad enum  

---

## B. Vendors — product model

### Why these fields
| Field | CEO use |
|-------|---------|
| specialization[] | “Who has Salesforce supply?” |
| status preferred/active/blacklisted | Prefer winners; hide bad actors |
| rate_notes | Typical cost bands without opening Excel |
| performanceStats | Trust score: submit → place ratio |
| resourcesSupplied[] | What’s in flight from this partner |

### Endpoints
```
GET    /api/v1/vendors                 ?specialization=&status=&q=
POST   /api/v1/vendors                 { name, specialization[], contact_person?, contact_email?, contact_phone?, status?, rate_notes? }
GET    /api/v1/vendors/:id
PATCH  /api/v1/vendors/:id
DELETE /api/v1/vendors/:id
GET    /api/v1/vendors/:id/candidates  ?stage=
GET    /api/v1/vendors/:id/performance
```

### List row shape
```ts
{
  id, name, specialization, status,
  contactPerson, contactEmail, contactPhone,
  activeSubmissions: number,  // matches on their candidates where stage ∈ applied|screened|interview|offer
  placedCount: number,        // stage=placed
  rateNotesPreview: string|null, // first 80 chars optional
  createdAt
}
```
- `specialization` filter: jsonb array contains  
- `q` ILIKE name  

### Detail shape
```ts
{
  ...header fields,
  rateNotes: string|null,
  performanceStats: {
    submissions,      // matches count for vendor's candidates (or source_vendor_id)
    shortlisted,      // stage ∈ screened|interview|offer|placed
    placed,           // stage=placed
    ratio: number     // placed/submissions * 100, 0 if none
  },
  resourcesSupplied: Array<{
    candidateId, candidateName, jobId, jobTitle, clientName,
    stage, matchScore, suppliedAt, matchId
  }>,
  // optional: open job assignments
  assignedJobs: Array<{ jobId, jobTitle, clientName, sourcingCost, assignedAt, jobStatus }>
}
```

### Performance endpoint
Same as `performanceStats` — used by list badges and detail cards.

### Counting rules (consistent)
- Submissions = rows in `job_candidate_matches` where candidate.source_vendor_id = vendor OR match.source_vendor_id = vendor  
- Prefer match.source_vendor_id when set, else candidate.source_vendor_id  
- shortlisted = stage in `screened, interview, offer, placed`  
- placed = stage `placed`  

---

## Rules (both)
- `requireAuth` all routes  
- snake↔camel per schema; `numeric` → number in JSON  
- `json` / `error` helpers  

### Verify
```bash
cd packages/backend/setuhireapi && pnpm typecheck && pnpm dev
# after login cookie:
curl -b c.txt 'localhost:3400/api/v1/clients?status=active'
curl -b c.txt localhost:3400/api/v1/clients/<id>   # jobs + pricing + notes + hired
curl -b c.txt localhost:3400/api/v1/vendors/v1/performance
```
Report: endpoints + curl evidence.

# 08 — WEB-CLIENTS-VENDORS (Wave 2, parallel)

**Owner files:**  
- `src/pages/Clients/ListPage.tsx`, `DetailPage.tsx`  
- `src/pages/Vendors/ListPage.tsx`, `DetailPage.tsx`  
- `src/api/clients.ts`, `src/api/vendors.ts`

**PO lens:** Two money sides of the desk. Screens must answer in <10 seconds: *Who’s active? What’s open? What’s the margin story? Who do I call?*

Use `api/client.ts` + `components/ui.tsx`. INR: `₹` + `toLocaleString('en-IN')`. Loading + error on every fetch.

---

## Shared UX patterns
- Sticky filter bar; Enter applies text filters  
- Empty state: one line + primary CTA  
- Inline “+ Add” drawer/panel preferred over separate route  
- Status pills: active=green, on_hold=amber, lost/blacklisted=red, preferred=blue  
- Clickable counts → navigate with query where possible  

---

# CLIENTS

## 1. List — `/clients` (PRD §3.3)

### Layout
```
[Filters: Status ▾] [Industry ________] [Search name ________]          [+ Add Client]
--------------------------------------------------------------------
Table (expandable rows)
```

### Columns
| Col | Source | Behavior |
|-----|--------|----------|
| ▸ | — | Expand/collapse |
| Client Name | name | Link → `/clients/:id` |
| Industry | industry | text |
| Active Jobs | activeJobsCount | bold if >0 |
| Status | status | StatusPill |
| Primary contact | contactPerson + phone | muted secondary line OK |
| Last engagement | lastEngagementAt | relative (“3d ago”) or — |
| Actions | — | Edit (patch modal), optional |

### Expand row (lazy `GET /clients/:id/jobs`)
Mini-table:
| Job title (link) | Status | Type | TSC | Pipeline # | Top match |

### Filters → API
`?status=&industry=&q=`

### + Add Client form fields
| Field | Control | Required |
|-------|---------|----------|
| name | text | yes |
| industry | text | no |
| contact_person | text | no |
| contact_email | email | no |
| contact_phone | tel | no |
| status | select active/on_hold/lost | default active |
| engagement_start_date | date | no |

Submit → POST → prepend row / refetch.

---

## 2. Detail — `/clients/:id` (PRD §3.4)

### Header strip (always visible)
```
[Name]  [StatusPill]  [Industry]
Contact: person · email (mailto) · phone (tel:)
Engaged since: date · Jobs: N open / M total
                    [Edit] [Add Job → /jobs/new?client_id=]
```

### Section A — KPI chips (compute client-side from detail payload)
| Chip | Calc |
|------|------|
| Open jobs | count status=open |
| In pipeline | sum pipelineCount |
| Placed resources | resourcesHired.length |
| Profiles sent | profilesSent.length |
| Est. margin at risk | sum (TSC − sourcing) on open jobs when both set |

### Section B — Jobs & pricing (CEO core)
Table:
| Title →/jobs/:id | Status | Type FTE/Contract | Exp | TSC ₹ | Sourcing ₹ | Margin ₹ | Vendors | Pipeline |

- Margin cell green if >0, red if ≤0 or missing sourcing  
- Vendors: chip list from assignedVendors  

### Section C — Resources hired
| Candidate → | Job | Type tag | Placed at |

Empty: “No placements yet”

### Section D — Profiles sent (pipeline under this client)
| Candidate | Job | Stage pill | Score | Sent |
Filter chips: All / Interview+ / Offer  

### Section E — Engagement timeline
- Vertical list: date · author · note  
- Composer: textarea + “Log note” → POST `/clients/:id/notes` → unshift  

### Data
`GET /clients/:id` once; jobs endpoint only if list expand needed elsewhere.

---

# VENDORS

## 3. List — `/vendors` (PRD §3.5)

### Layout
```
[Status ▾] [Specialization ________] [Search]                    [+ Add Vendor]
Accordion list OR table+expand
```

### Columns / header row
| Name (link) | Specialization tags | Active submissions | Placed | Status | Contact |

### Expand (lazy candidates or use detail.resources)
| Candidate | Job | Client | Stage | Score | Date |

### + Add Vendor fields
| Field | Control | Required |
|-------|---------|----------|
| name | text | yes |
| specialization | tag input (Enter adds) | no |
| contact_person/email/phone | text | no |
| status | active/preferred/blacklisted | default active |
| rate_notes | textarea | no |

---

## 4. Detail — `/vendors/:id` (PRD §3.6)

### Header
Name · StatusPill · specialization tags  
Contact block · [Edit]

### Performance cards (GET `/vendors/:id/performance` or embed)
| Submissions | Shortlisted | Placed | Placement ratio % |
Ratio color: ≥20% green, 10–20 amber, <10 red (tune OK)

### Rate card
Full `rateNotes` in Card (pre-wrap)

### Resources supplied table
| Candidate → | Job → | Client | Stage | Score | Supplied |

### Assigned open jobs (if API returns assignedJobs)
| Job | Client | Sourcing cost | Assigned |

### Notes
MVP: show rate_notes as commercial log; if no vendor_notes table, don’t invent UI for missing API.

---

## API helpers (`src/api/clients.ts` / `vendors.ts`)
Typed wrappers: `listClients(params)`, `getClient(id)`, `createClient`, `updateClient`, `listClientJobs`, `addClientNote`, same pattern for vendors + `vendorPerformance`.

### Verify
```bash
cd packages/web/setuhireweb && pnpm typecheck && pnpm dev
# Clients: seeded rows, expand jobs, detail pricing+margin+timeline
# Vendors: expand supply, performance ratio cards
```
Report: files + routes working.

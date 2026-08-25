from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

NAVY = RGBColor(0x1E, 0x3A, 0x5F)
GREY = RGBColor(0x55, 0x55, 0x55)

def set_cell_shading(cell, color_hex):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), color_hex)
    cell._tc.get_or_add_tcPr().append(shd)

def add_heading(doc, text, size=16, color=NAVY, space_before=18, space_after=8):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(size)
    r.font.color.rgb = color
    return p

def add_body(doc, text, size=11, bold=False, color=RGBColor(0,0,0), italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run(text)
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    r.font.color.rgb = color
    return p

def add_bullet(doc, text, size=11):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text)
    r.font.size = Pt(size)
    return p

def add_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ""
        p = hdr[i].paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(10.5)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_shading(hdr[i], "1E3A5F")
    for row in rows:
        cells = table.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(10.5)
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Inches(w)
    return table

doc = Document()

# Base font
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)

# ---------- TITLE ----------
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = title.add_run("SetuHire — Project Proposal & Quotation")
r.bold = True
r.font.size = Pt(22)
r.font.color.rgb = NAVY

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub.add_run("IT Staffing / Bench-Sales Management Platform — Discussion Draft")
r.font.size = Pt(12)
r.font.color.rgb = GREY
r.italic = True

doc.add_paragraph()

# ---------- INTRO ----------
add_body(doc, "Thanks for the time on the call — glad the demo gave a clear sense of direction. Below is the proposed scope, timeline, and pricing structure for SetuHire, along with the discussion points we'll walk through together.", size=11.5)

# ---------- SCOPE ----------
add_heading(doc, "1. Scope of Work")
add_body(doc, "Matches what was demoed in the POC — six core modules, already architected end-to-end (schema, matching logic, and design system in place):", italic=True, color=GREY)
scope_items = [
    "Client Management — client profiles, engagement history, jobs raised, pricing (TSC vs sourcing cost vs margin) per active job",
    "Vendor Management — vendor profiles, performance stats (submissions/shortlist/placement ratio), resources supplied",
    "Resource & Candidate Management — structured profiles, resume parsing, availability status",
    "Job / Requirement Management — job intake (URL fetch or manual), requirement-to-profile AI matching with ranked scores",
    "Multi-login Dashboards — role-based views (Admin / Sales / Manager), each seeing data scoped to their role",
    "Finance & Reporting — billing vs payout vs commission tracking, with permission-gated visibility for sensitive amounts",
]
for item in scope_items:
    add_bullet(doc, item)

add_body(doc, "Anything outside these six modules (new features, integrations, major workflow changes) is treated as a change request and scoped/quoted separately — this is what protects the 6-week timeline and the price below.")

# ---------- TIMELINE ----------
add_heading(doc, "2. Timeline")
add_body(doc, "Working v1 in 6 weeks. Because the schema, matching engine design, and UI system are already built out from prior work, there's a realistic chance this compresses — we'll flag early if that happens, but 6 weeks is the committed outer bound.")

# ---------- PRICING ----------
add_heading(doc, "3. Investment")
add_body(doc, "Total project cost: ₹4,80,000 — milestone-based, so payment always trails visible progress, not the other way round.")

add_table(
    doc,
    ["Milestone", "%", "Trigger", "Amount"],
    [
        ["Advance", "25%", "Kickoff — before work starts", "₹1,20,000"],
        ["Milestone 1", "25%", "Core data model + dashboard shell live", "₹1,20,000"],
        ["Milestone 2", "25%", "Matching engine + role-based dashboards functional", "₹1,20,000"],
        ["Final", "25%", "UAT sign-off + full source handover + deployment docs", "₹1,20,000"],
    ],
    col_widths=[1.5, 0.6, 3.2, 1.2],
)
doc.add_paragraph()
add_body(doc, "Full source code and deployment access transfer at final payment — fully self-hosted, no ongoing dependency on us.")

# ---------- SUPPORT ----------
add_heading(doc, "4. Post-Launch Support")
add_bullet(doc, "15 days free bug-fixing on delivered scope after go-live (defects only, not new features).")
add_bullet(doc, "Beyond that: either a monthly AMC retainer or pay-as-you-go support — exact terms to be worked out once live and usage patterns are clear.")

# ---------- TALKING POINTS ----------
add_heading(doc, "5. Points to Talk Through Tomorrow")
talk_points = [
    "Lead with the POC — it's already working, which is why we're comfortable asking for the advance upfront.",
    "Full source + self-hosted delivery is priced differently than a SaaS subscription would be — they're getting the IP outright, not renting access to it.",
    "The milestone structure is what keeps this affordable for them starting out — they're never paying ahead of visible progress.",
    "Scope is locked to the six modules above in writing; anything beyond is a separate change request — keeps both timeline and budget protected.",
    "If they push on price, the lever is milestone scope (e.g., defer admin reporting to a v1.1 phase), not cutting the price on the same scope.",
]
for tp in talk_points:
    add_bullet(doc, tp)

# ---------- POINTS TO NOTE ----------
add_heading(doc, "6. Points to Note (Internal — don't say out loud)")
notes = [
    "₹4,80,000 is a single fixed number, not a range — a range invites them to negotiate down from the top; a fixed number redirects negotiation to scope instead, which is easier to control.",
    "Internal cost floor: ~150-160 hrs at $30/hr (~₹3.2L-4L) — reusing the existing schema, matching logic, and design system is what makes this achievable inside their stated ceiling.",
    "If they hesitate on the 25% advance despite having seen a working POC, that's a signal on how serious the commitment actually is — worth noting, not necessarily a blocker.",
    "Don't offer \"we'll move faster with AI\" as a price-reduction lever — any speed gained should protect margin, not lower the quote further.",
    "Support/AMC pricing is deliberately left open — committing to a number now, before knowing their usage pattern, under-prices future support.",
]
for n in notes:
    add_bullet(doc, n)

# ---------- FALLBACK ----------
add_heading(doc, "7. Fallback Version (if they push back on ₹4.8L)")
add_body(doc, "Don't cut the price on the same scope. Instead, trim milestone scope and phase the rest:")
add_table(
    doc,
    ["Milestone", "%", "Trigger", "Amount"],
    [
        ["Advance", "25%", "Kickoff — before work starts", "₹95,000"],
        ["Milestone 1", "25%", "Core data model + dashboard shell live", "₹95,000"],
        ["Milestone 2", "25%", "Matching engine + sales dashboards (core roles only)", "₹95,000"],
        ["Final", "25%", "UAT sign-off + source handover + deployment docs", "₹95,000"],
    ],
    col_widths=[1.5, 0.6, 3.2, 1.2],
)
doc.add_paragraph()
add_body(doc, "Total: ₹3,80,000 for a v1 that excludes admin reporting and finance permission-gating (deferred to a v1.1 phase, quoted separately once v1 is live). Frame this explicitly as \"same core platform, smaller v1 boundary\" — not a discount on the same deliverable.")
add_body(doc, "Alternative fallback lever: keep the full ₹4.8L scope but extend timeline from 6 to 8 weeks instead of reducing price — trade timeline, not the number.")

doc.save("/Users/apple/work/vaayulab/projects/setuhire/docs/clientdiscussion/SetuHire_Proposal.docx")
print("saved")

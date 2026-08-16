import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createInterview, listInterviews, updateInterview } from "../../api/pipeline";
import { listClients } from "../../api/clients";
import { listJobs } from "../../api/jobs";
import { listMatches } from "../../api/candidates";
import type { Client, Interview, Job, Match } from "../../api/types";
import { Button, EmptyState, ErrorBox, Icon, Loading, StatusPill, Table } from "../../components/ui";

const ROUNDS = ["L1", "L2", "Client", "HR", "Other"];

export default function InterviewsListPage() {
  const [searchParams] = useSearchParams();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [clientId, setClientId] = useState(searchParams.get("client_id") ?? "");
  const [jobId, setJobId] = useState(searchParams.get("job_id") ?? "");
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [round, setRound] = useState("L1");
  const [interviewer, setInterviewer] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listClients().then(setClients).catch(() => setClients([]));
    listJobs().then(setJobs).catch(() => setJobs([]));
  }, []);

  function load() {
    setLoading(true);
    setError("");
    listInterviews({
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
      clientId: clientId || undefined,
      jobId: jobId || undefined,
    })
      .then(setInterviews)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load interviews"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, from, to, clientId, jobId]);

  async function openForm() {
    setShowForm(true);
    if (matches.length === 0) {
      try {
        setMatches(await listMatches());
      } catch {
        setMatches([]);
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId || !scheduledAt) return;
    setBusy(true);
    setError("");
    try {
      await createInterview({
        matchId,
        round: round || undefined,
        interviewer: interviewer || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setMatchId("");
      setInterviewer("");
      setScheduledAt("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Interviews</h1>
          <p className="page-subtitle">
            {interviews.length} interview{interviews.length === 1 ? "" : "s"} on the calendar
          </p>
        </div>
        <div className="row">
          <Button variant={view === "list" ? "primary" : undefined} onClick={() => setView("list")}>
            List
          </Button>
          <Button
            variant={view === "calendar" ? "primary" : undefined}
            onClick={() => setView("calendar")}
          >
            <Icon name="calendar" /> Calendar
          </Button>
          <Button variant="primary" onClick={() => (showForm ? setShowForm(false) : openForm())}>
            <Icon name="plus" /> {showForm ? "Cancel" : "Schedule"}
          </Button>
        </div>
      </div>

      <div className="filter-bar">
        <select
          className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px]"
          style={{ width: "auto" }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="cleared">Cleared</option>
          <option value="rejected">Rejected</option>
          <option value="no_show">No Show</option>
        </select>
        <label className="mb-0 flex items-center gap-2 text-[13px] text-ink-600">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ width: "auto" }}
          />
        </label>
        <label className="mb-0 flex items-center gap-2 text-[13px] text-ink-600">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: "auto" }}
          />
        </label>
        <select
          className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px]"
          style={{ width: "auto" }}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px]"
          style={{ width: "auto" }}
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
        >
          <option value="">All jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <form className="card mb-4" onSubmit={submit}>
          <div className="grid cols-2">
            <div className="field">
              <label>Match (candidate · job)</label>
              <select value={matchId} onChange={(e) => setMatchId(e.target.value)} required>
                <option value="">Select match…</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.candidateName ?? "—"} · {m.jobTitle ?? "—"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Round</label>
              <select value={round} onChange={(e) => setRound(e.target.value)}>
                {ROUNDS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Interviewer</label>
              <input value={interviewer} onChange={(e) => setInterviewer(e.target.value)} />
            </div>
            <div className="field">
              <label>Scheduled At</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            Schedule Interview
          </Button>
        </form>
      )}

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : interviews.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No interviews scheduled"
          description={
            status || from || to || clientId || jobId
              ? "No interviews match your filters. Try adjusting them."
              : "Schedule your first interview to track candidate progress."
          }
          action={
            !status && !from && !to && !clientId && !jobId ? (
              <Button variant="primary" onClick={openForm}>
                <Icon name="plus" /> Schedule Interview
              </Button>
            ) : undefined
          }
        />
      ) : view === "list" ? (
        <Table
          headers={[
            "Candidate",
            "Job",
            "Client",
            "Round",
            "Interviewer",
            "When",
            "Status",
            "Flags",
          ]}
          footer={
            <span>
              Showing {interviews.length} interview
              {interviews.length === 1 ? "" : "s"}
            </span>
          }
        >
          {interviews.map((i) => (
            <InterviewRow key={i.id} interview={i} onChanged={load} />
          ))}
        </Table>
      ) : (
        <CalendarView interviews={interviews} />
      )}
    </div>
  );
}

function flags(interview: Interview): string[] {
  const out: string[] = [];
  if (!interview.scheduledAt) return out;
  const t = new Date(interview.scheduledAt).getTime();
  const now = Date.now();
  if (interview.status === "scheduled") {
    if (t < now) out.push("⚠️ overdue");
    else if (t <= now + 24 * 3600_000) out.push("⏰ <24h");
  }
  return out;
}

function InterviewRow({
  interview,
  onChanged,
}: {
  interview: Interview;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(interview.feedback ?? "");
  const [editTime, setEditTime] = useState(
    interview.scheduledAt ? interview.scheduledAt.slice(0, 16) : "",
  );
  const [saving, setSaving] = useState(false);

  async function saveFeedback() {
    setSaving(true);
    try {
      await updateInterview(interview.id, { feedback });
      onChanged();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: string) {
    setSaving(true);
    try {
      await updateInterview(interview.id, { status });
      onChanged();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function saveTime() {
    if (!editTime) return;
    setSaving(true);
    try {
      await updateInterview(interview.id, { scheduledAt: new Date(editTime).toISOString() });
      onChanged();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr onClick={() => setOpen((v) => !v)}>
        <td className="font-medium">{interview.candidateName ?? "—"}</td>
        <td>{interview.jobTitle ?? "—"}</td>
        <td>{interview.clientName ?? "—"}</td>
        <td>{interview.round ?? "—"}</td>
        <td>{interview.interviewer ?? "—"}</td>
        <td className="whitespace-nowrap">
          {interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleString() : "—"}
        </td>
        <td>
          <StatusPill status={interview.status} />
        </td>
        <td className="whitespace-nowrap">{flags(interview).join(" ")}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-surface-bg/50">
            <div className="flex flex-wrap items-start gap-2">
              <textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Feedback notes…"
                style={{ flex: 1, minWidth: 200 }}
              />
              <Button onClick={saveFeedback} disabled={saving}>
                Save Feedback
              </Button>
            </div>
            <div className="row mt-2">
              <Button onClick={() => setStatus("cleared")} disabled={saving}>
                Mark cleared
              </Button>
              <Button onClick={() => setStatus("rejected")} disabled={saving}>
                Rejected
              </Button>
              <Button onClick={() => setStatus("no_show")} disabled={saving}>
                No-show
              </Button>
              <input
                type="datetime-local"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                style={{ width: "auto" }}
              />
              <Button onClick={saveTime} disabled={saving || !editTime}>
                Edit time
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CalendarView({ interviews }: { interviews: Interview[] }) {
  const now = new Date();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, Interview[]>();
    for (const i of interviews) {
      if (!i.scheduledAt) continue;
      const key = i.scheduledAt.slice(0, 10);
      m.set(key, [...(m.get(key) ?? []), i]);
    }
    return m;
  }, [interviews]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const keyOf = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = cursor.toLocaleString("en", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button onClick={() => setCursor(new Date(year, month - 1, 1))}>‹ Prev</Button>
        <h3 className="m-0 font-heading text-[14px] font-semibold">{monthLabel}</h3>
        <Button onClick={() => setCursor(new Date(year, month + 1, 1))}>Next ›</Button>
      </div>
      <div className="grid cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold uppercase text-ink-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid cols-7">
        {cells.map((d, idx) => {
          if (d === null) return <div key={`b-${idx}`} className="h-16 border border-surface-border/40" />;
          const key = keyOf(d);
          const dayInterviews = byDay.get(key) ?? [];
          const active = selectedDay === key;
          return (
            <div
              key={key}
              onClick={() => setSelectedDay(active ? null : key)}
              className={`h-16 cursor-pointer border border-surface-border/40 p-1 ${
                active ? "bg-accent-50" : ""
              }`}
            >
              <div className="text-[12px] text-ink-600">{d}</div>
              {dayInterviews.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {dayInterviews.slice(0, 3).map((i) => (
                    <span key={i.id} className="tech-pill" title={i.candidateName ?? ""}>
                      {i.candidateName?.split(" ")[0]}
                    </span>
                  ))}
                  {dayInterviews.length > 3 && (
                    <span className="tech-pill overflow">+{dayInterviews.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selectedDay && (
        <div className="card mt-3">
          <h3 className="mb-2 font-heading text-[13px] font-semibold">{selectedDay}</h3>
          {(byDay.get(selectedDay) ?? []).length === 0 ? (
            <div className="muted">No interviews this day.</div>
          ) : (
            <ul className="m-0 pl-5">
              {(byDay.get(selectedDay) ?? []).map((i) => (
                <li key={i.id}>
                  <span className="font-medium">{i.candidateName}</span>
                  <span className="muted">
                    {" "}
                    · {i.round} ·{" "}
                    {i.scheduledAt ? new Date(i.scheduledAt).toLocaleTimeString() : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

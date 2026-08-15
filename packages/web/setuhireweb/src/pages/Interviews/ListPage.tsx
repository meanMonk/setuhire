import { useEffect, useState } from "react";
import {
  createInterview,
  listInterviews,
  updateInterview,
} from "../../api/pipeline";
import type { Interview } from "../../api/types";
import { Button, ErrorBox, Loading, StatusPill, Table } from "../../components/ui";

export default function InterviewsListPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [matchId, setMatchId] = useState("");
  const [round, setRound] = useState("L1");
  const [interviewer, setInterviewer] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    setError("");
    listInterviews({
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    })
      .then(setInterviews)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load interviews"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, from, to]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId) return;
    setBusy(true);
    setError("");
    try {
      await createInterview({
        matchId,
        round: round || undefined,
        interviewer: interviewer || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      setMatchId("");
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
      <div className="toolbar">
        <h1 className="page-title">Interviews</h1>
        <div className="row">
          <Button variant={view === "list" ? "primary" : undefined} onClick={() => setView("list")}>
            List
          </Button>
          <Button
            variant={view === "calendar" ? "primary" : undefined}
            onClick={() => setView("calendar")}
          >
            Calendar
          </Button>
          <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Schedule"}
          </Button>
        </div>
      </div>

      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto" }}>
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="cleared">Cleared</option>
          <option value="rejected">Rejected</option>
          <option value="no_show">No Show</option>
        </select>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "auto" }} />
        </label>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "auto" }} />
        </label>
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <div className="grid cols-2">
            <div className="field">
              <label>Match ID</label>
              <input value={matchId} onChange={(e) => setMatchId(e.target.value)} required />
            </div>
            <div className="field">
              <label>Round</label>
              <input value={round} onChange={(e) => setRound(e.target.value)} />
            </div>
            <div className="field">
              <label>Interviewer</label>
              <input value={interviewer} onChange={(e) => setInterviewer(e.target.value)} />
            </div>
            <div className="field">
              <label>Scheduled At</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
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
      ) : view === "list" ? (
        <Table
          headers={["Candidate", "Job", "Client", "Round", "Interviewer", "Scheduled", "Status"]}
        >
          {interviews.map((i) => (
            <InterviewRow key={i.id} interview={i} />
          ))}
        </Table>
      ) : (
        <CalendarView interviews={interviews} />
      )}
    </div>
  );
}

function InterviewRow({ interview }: { interview: Interview }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(interview.feedback ?? "");
  const [saving, setSaving] = useState(false);

  async function saveFeedback() {
    setSaving(true);
    try {
      await updateInterview(interview.id, { feedback });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr onClick={() => setOpen((v) => !v)} style={{ cursor: "pointer" }}>
        <td>{interview.candidateName ?? "—"}</td>
        <td>{interview.jobTitle ?? "—"}</td>
        <td>{interview.clientName ?? "—"}</td>
        <td>{interview.round ?? "—"}</td>
        <td>{interview.interviewer ?? "—"}</td>
        <td>
          {interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleString() : "—"}
        </td>
        <td>
          <StatusPill status={interview.status} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ background: "#fafbfc" }}>
            <div className="row">
              <textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Feedback notes…"
                style={{ flex: 1 }}
              />
              <Button onClick={saveFeedback} disabled={saving}>
                Save
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CalendarView({ interviews }: { interviews: Interview[] }) {
  const byDay = new Map<string, Interview[]>();
  for (const i of interviews) {
    if (!i.scheduledAt) continue;
    const key = i.scheduledAt.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), i]);
  }
  const days = [...byDay.keys()].sort();
  return (
    <div className="grid cols-3">
      {days.length === 0 ? (
        <div className="muted">No scheduled interviews.</div>
      ) : (
        days.map((d) => (
          <div key={d} className="card">
            <h3>{d}</h3>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {(byDay.get(d) ?? []).map((i) => (
                <li key={i.id}>
                  {i.candidateName} <span className="muted">· {i.round}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

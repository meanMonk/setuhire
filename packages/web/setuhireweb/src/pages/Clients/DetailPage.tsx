import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addClientNote, getClient, type ClientDetail } from "../../api/clients";
import { Button, Card, ErrorBox, formatInr, Loading, StatusPill } from "../../components/ui";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setClient(await getClient(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load client");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !note.trim()) return;
    setBusy(true);
    try {
      await addClientNote(id, note);
      setNote("");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!client) return <ErrorBox message="Client not found" />;

  const jobs = client.jobs ?? [];
  const resources = client.resourcesHired ?? [];
  const history = client.engagementHistory ?? [];

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title">{client.name}</h1>
        <StatusPill status={client.status} />
      </div>
      <p className="muted">
        {[client.industry, client.contactPerson, client.contactEmail, client.contactPhone]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <Card title="Jobs">
        {jobs.length === 0 ? (
          <div className="muted">No jobs.</div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>TSC</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link to={`/jobs/${j.id}`}>{j.title}</Link>
                    </td>
                    <td>
                      <StatusPill status={j.status} />
                    </td>
                    <td>{j.employmentType?.toUpperCase() ?? "—"}</td>
                    <td>{formatInr(j.targetSellingCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="side-by-side mt-2">
        <Card title="Resources Hired">
          {resources.length === 0 ? (
            <div className="muted">None placed yet.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {resources.map((r) => (
                <li key={r.matchId ?? r.candidateId}>
                  {r.candidateName}
                  {r.employmentType && (
                    <span className="muted"> · {r.employmentType.toUpperCase()}</span>
                  )}
                  {r.jobTitle && <span className="muted"> · {r.jobTitle}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Engagement History">
          {history.length === 0 ? (
            <div className="muted">No notes yet.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {history.map((h) => (
                <li key={h.id}>
                  {h.note}
                  {h.createdAt && (
                    <span className="muted"> · {new Date(h.createdAt).toLocaleString()}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={submitNote} className="row" style={{ marginTop: "0.75rem" }}>
            <input
              placeholder="Add a note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button type="submit" variant="primary" disabled={busy}>
              Add Note
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

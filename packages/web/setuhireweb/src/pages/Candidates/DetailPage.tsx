import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCandidate, type CandidateDetail } from "../../api/candidates";
import { Card, ErrorBox, formatInr, Loading, StatusPill, Tags } from "../../components/ui";

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getCandidate(id)
      .then(setCandidate)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load candidate"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!candidate) return <ErrorBox message="Candidate not found" />;

  const profile = candidate.parsedProfile;
  const matches = candidate.matchHistory ?? [];

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title">{candidate.name}</h1>
        <StatusPill status={candidate.currentStatus} />
      </div>
      <p className="muted">
        {[candidate.email, candidate.phone].filter(Boolean).join(" · ")} · Source:{" "}
        {candidate.sourceType === "vendor" ? candidate.sourceVendorName ?? "Vendor" : "Direct"} ·
        Rate {formatInr(candidate.rateExpectation)}
      </p>

      {candidate.resumeUrl && (
        <p>
          Resume: <span className="muted">{candidate.resumeUrl}</span> (on file)
        </p>
      )}

      <div className="side-by-side">
        <Card title="Skills">
          <Tags items={profile?.skills ?? candidate.skills} />
        </Card>
        <Card title="Experience">
          <div className="muted">
            {profile?.experience_years ?? candidate.experienceYears ?? "—"} years
          </div>
        </Card>
      </div>

      {profile?.roles && profile.roles.length > 0 && (
        <Card title="Experience Timeline">
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {profile.roles.map((r, i) => (
              <li key={i}>
                <strong>{r.title}</strong> — {r.company}
                {r.duration && <span className="muted"> · {r.duration}</span>}
                {r.tech && r.tech.length > 0 && (
                  <span className="muted"> · {r.tech.join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {profile?.education && (
        <Card title="Education">
          <div>{profile.education}</div>
        </Card>
      )}

      {profile?.certifications && profile.certifications.length > 0 && (
        <Card title="Certifications">
          <Tags items={profile.certifications} />
        </Card>
      )}

      <Card title="Match History">
        {matches.length === 0 ? (
          <div className="muted">No match history.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Score</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.jobId ? <Link to={`/jobs/${m.jobId}`}>{m.jobTitle ?? m.jobId}</Link> : "—"}
                  </td>
                  <td>{m.score ?? m.matchScore ?? "—"}</td>
                  <td>
                    <StatusPill status={m.stage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

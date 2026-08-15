import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { assignVendor, getJob, runMatch } from "../../api/jobs";
import { createMatch, listMatches, updateMatch } from "../../api/candidates";
import type { Job, Match } from "../../api/types";
import {
  Badge,
  Button,
  ErrorBox,
  formatInr,
  Loading,
  StatusPill,
  Tags,
} from "../../components/ui";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState("");

  const [vendorId, setVendorId] = useState("");
  const [sourcingCost, setSourcingCost] = useState("");
  const [assigning, setAssigning] = useState(false);

  function loadJob() {
    if (!id) return;
    return getJob(id)
      .then(setJob)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load job"));
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadJob()?.finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onRunMatch() {
    if (!id) return;
    setMatching(true);
    setError("");
    try {
      setMatches(await runMatch(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Match failed");
    } finally {
      setMatching(false);
    }
  }

  async function moveToPipeline(m: Match) {
    if (!id || !m.candidate?.id) return;
    try {
      await createMatch({
        jobId: id,
        candidateId: m.candidate.id,
      });
      setMatches((prev) => prev.filter((x) => x.candidate?.id !== m.candidate?.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to move candidate");
    }
  }

  async function reject(m: Match) {
    if (!id) return;
    try {
      const all = await listMatches({ jobId: id });
      const match = all.find((x) => x.candidateId === m.candidate?.id);
      if (match?.id) {
        await updateMatch(match.id, { stage: "rejected" });
      }
      setMatches((prev) => prev.filter((x) => x.candidate?.id !== m.candidate?.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    }
  }

  async function onAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !vendorId) return;
    setAssigning(true);
    setError("");
    try {
      await assignVendor(id, {
        vendorId,
        sourcingCost: sourcingCost ? Number(sourcingCost) : undefined,
      });
      setVendorId("");
      setSourcingCost("");
      await loadJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign vendor");
    } finally {
      setAssigning(false);
    }
  }

  if (loading) return <Loading />;
  if (error && !job) return <ErrorBox message={error} />;
  if (!job) return <ErrorBox message="Job not found" />;

  const summary = job.pipelineSummary ?? [];

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title">{job.title}</h1>
        <StatusPill status={job.status} />
      </div>
      <p className="muted">
        {[
          job.clientName ?? job.clientId,
          job.experienceRequired,
          job.employmentType?.toUpperCase(),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="row" style={{ marginBottom: "1rem" }}>
        <span className="muted">Tech stack:</span>
        <Tags items={job.techStack} />
        <span className="muted">TSC:</span>
        <strong>{formatInr(job.targetSellingCost)}</strong>
        <Button variant="primary" onClick={onRunMatch} disabled={matching}>
          {matching ? "Matching…" : "Run AI Match"}
        </Button>
      </div>

      {error && <ErrorBox message={error} />}

      {matches.length > 0 && (
        <div className="panel">
          <h3>Ranked Matches</h3>
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Score</th>
                <th>Source</th>
                <th>Skill Overlap</th>
                <th>Rate vs TSC</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => {
                const score = m.score ?? m.matchScore ?? 0;
                return (
                  <tr key={m.id ?? m.candidate?.id}>
                    <td>{m.candidate?.name ?? m.candidateName}</td>
                    <td>
                      {score >= 90 && <Badge tone="green">≥90%</Badge>}
                      {score}%
                    </td>
                    <td>{m.source ?? "direct"}</td>
                    <td>
                      <Tags items={m.keySkillsOverlap} />
                    </td>
                    <td>
                      {m.rateFit === "above_tsc" ? (
                        <Badge tone="red">Above TSC</Badge>
                      ) : (
                        <Badge tone="green">OK</Badge>
                      )}
                    </td>
                    <td>
                      <div className="row">
                        <Button onClick={() => moveToPipeline(m)}>Move to Pipeline</Button>
                        <Button onClick={() => reject(m)}>Reject</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="side-by-side">
        <div className="panel">
          <h3>Pipeline Snapshot</h3>
          {summary.length === 0 ? (
            <div className="muted">No candidates in pipeline.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {summary.map((s) => (
                <li key={s.stage}>
                  {s.stage}: {s.count}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <h3>Vendor Assignments</h3>
          {(job.vendorAssignments ?? []).length === 0 ? (
            <div className="muted">No vendors assigned.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {(job.vendorAssignments ?? []).map((a) => (
                <li key={a.id ?? a.vendorId}>
                  {a.vendorName ?? a.vendorId}
                  {a.sourcingCost != null && (
                    <span className="muted"> · {formatInr(a.sourcingCost)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={onAssign} className="row" style={{ marginTop: "0.75rem" }}>
            <input
              placeholder="Vendor id"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <input
              placeholder="Sourcing cost"
              value={sourcingCost}
              onChange={(e) => setSourcingCost(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <Button type="submit" disabled={assigning}>
              Assign
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

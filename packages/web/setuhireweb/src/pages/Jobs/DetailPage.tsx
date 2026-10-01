import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { assignVendor, getJob, runMatch } from "../../api/jobs";
import { createMatch, listMatches, updateMatch } from "../../api/candidates";
import { listVendors } from "../../api/vendors";
import type { Job, Match, Vendor } from "../../api/types";
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

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [sourcingCost, setSourcingCost] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    listVendors().then(setVendors).catch(() => setVendors([]));
  }, []);

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
  const assignments = job.vendorAssignments ?? [];

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title">{job.title}</h1>
        <StatusPill status={job.status} />
      </div>

      <div className="job-detail-grid">
        <div>
          {error && <ErrorBox message={error} />}

          <section className="panel mb-4">
            <h3>Job Description</h3>
            {job.description ? (
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-600">
                {job.description}
              </p>
            ) : (
              <p className="muted text-[13px]">No description captured yet.</p>
            )}
          </section>

          <section className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="m-0">Ranked Matches</h3>
              <Button variant="primary" onClick={onRunMatch} disabled={matching}>
                {matching ? "Matching…" : "Run AI Match"}
              </Button>
            </div>
            {matches.length === 0 ? (
              <div className="muted text-[13px]">
                No AI matches run yet. Click “Run AI Match” to rank candidates against this job.
              </div>
            ) : (
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
            )}
          </section>
        </div>

        <div>
          <section className="panel mb-4">
            <h3>Job Details</h3>
            <dl className="detail-list">
              <div>
                <dt>Client</dt>
                <dd>{job.clientName ?? "—"}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{job.experienceRequired ?? "—"}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd className="capitalize">{job.employmentType ?? "—"}</dd>
              </div>
              <div>
                <dt>Target Selling Cost</dt>
                <dd className="font-semibold">{formatInr(job.targetSellingCost)}</dd>
              </div>
              <div>
                <dt>Tech Stack</dt>
                <dd>
                  <Tags items={job.techStack} />
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel mb-4">
            <h3>Vendors Engaged</h3>
            {assignments.length === 0 ? (
              <div className="muted text-[13px]">No vendors sourcing for this job yet.</div>
            ) : (
              <ul className="vendor-list">
                {assignments.map((a) => {
                  const cost = a.sourcingCost != null ? Number(a.sourcingCost) : null;
                  const tsc = job.targetSellingCost != null ? Number(job.targetSellingCost) : null;
                  const margin =
                    cost != null && tsc != null && !Number.isNaN(cost) && !Number.isNaN(tsc)
                      ? tsc - cost
                      : null;
                  return (
                    <li key={a.id ?? a.vendorId} className="vendor-item">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink-900">{a.vendorName ?? a.vendorId}</span>
                        <StatusPill status={a.vendorStatus} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-400">
                        <span>Sourcing: {formatInr(a.sourcingCost)}</span>
                        {margin != null && (
                          <span className="text-accent-700">Est. margin: {formatInr(margin)}</span>
                        )}
                        {a.assignedAt && (
                          <span>Since {new Date(a.assignedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <form onSubmit={onAssign} className="row" style={{ marginTop: "0.75rem" }}>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                style={{ maxWidth: 220 }}
                required
              >
                <option value="">Select vendor…</option>
                {vendors
                  .filter((v) => !assignments.some((a) => a.vendorId === v.id))
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
              <input
                placeholder="Sourcing cost (₹)"
                value={sourcingCost}
                onChange={(e) => setSourcingCost(e.target.value)}
                type="number"
                style={{ maxWidth: 160 }}
              />
              <Button type="submit" disabled={assigning || !vendorId}>
                Assign
              </Button>
            </form>
          </section>

          <section className="panel">
            <h3>Pipeline Snapshot</h3>
            {summary.length === 0 ? (
              <div className="muted text-[13px]">No candidates in pipeline.</div>
            ) : (
              <ul className="stage-list">
                {summary.map((s) => (
                  <li key={s.stage}>
                    <span className="capitalize">{s.stage}</span>
                    <strong>{s.count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

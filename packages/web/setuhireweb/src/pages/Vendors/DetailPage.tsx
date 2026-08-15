import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getVendor, getVendorPerformance, type VendorDetail } from "../../api/vendors";
import { Card, ErrorBox, Loading, StatusPill, Tags } from "../../components/ui";

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [perf, setPerf] = useState<{
    submissions?: number;
    shortlisted?: number;
    placed?: number;
    ratio?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    Promise.all([getVendor(id), getVendorPerformance(id).catch(() => null)])
      .then(([v, p]) => {
        setVendor(v);
        setPerf(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load vendor"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!vendor) return <ErrorBox message="Vendor not found" />;

  const resources = vendor.resourcesSupplied ?? [];

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title">{vendor.name}</h1>
        <StatusPill status={vendor.status} />
      </div>
      <p className="muted">
        {[vendor.contactPerson, vendor.contactEmail, vendor.contactPhone].filter(Boolean).join(" · ")}
      </p>

      <Card title="Specialization">
        <Tags items={vendor.specialization} />
      </Card>

      <Card title="Performance">
        <div className="grid cols-4">
          <div className="stat-card">
            <div className="value">{perf?.submissions ?? 0}</div>
            <div className="label">Submissions</div>
          </div>
          <div className="stat-card">
            <div className="value">{perf?.shortlisted ?? 0}</div>
            <div className="label">Shortlisted</div>
          </div>
          <div className="stat-card">
            <div className="value">{perf?.placed ?? 0}</div>
            <div className="label">Placed</div>
          </div>
          <div className="stat-card">
            <div className="value">{perf?.ratio != null ? `${perf.ratio}%` : "—"}</div>
            <div className="label">Placement Ratio</div>
          </div>
        </div>
      </Card>

      <Card title="Rate Card / Notes">
        <p className="muted" style={{ margin: 0 }}>
          {vendor.rateNotes ?? "No rate notes on file."}
        </p>
      </Card>

      <Card title="Resources Supplied">
        {resources.length === 0 ? (
          <div className="muted">No resources supplied yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.matchId ?? r.candidateId}>
                  <td>
                    <Link to={`/candidates/${r.candidateId}`}>{r.candidateName}</Link>
                  </td>
                  <td>{r.jobTitle ?? "—"}</td>
                  <td>
                    <StatusPill status={r.stage} />
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

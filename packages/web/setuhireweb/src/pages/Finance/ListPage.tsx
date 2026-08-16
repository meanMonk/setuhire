import { useEffect, useState } from "react";
import { financeExport, financeRecords, financeSummary } from "../../api/pipeline";
import type { FinanceRecord } from "../../api/types";
import { Button, EmptyState, ErrorBox, formatInr, Loading, StatusPill, Table } from "../../components/ui";

export default function FinanceListPage() {
  const [summary, setSummary] = useState<{
    totalRevenue?: number;
    totalCommission?: number;
    pendingReceivables?: number;
    pendingVendorPayouts?: number;
  } | null>(null);
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([financeSummary(month || undefined), financeRecords({ month: month || undefined })])
      .then(([s, r]) => {
        setSummary(s);
        setRecords(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load finance"))
      .finally(() => setLoading(false));
  }, [month]);

  async function onExport() {
    setError("");
    try {
      const csv = await financeExport("csv");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "finance-records.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  const cards: [string, keyof NonNullable<typeof summary>][] = [
    ["Total Revenue", "totalRevenue"],
    ["Total Commission", "totalCommission"],
    ["Pending Receivables", "pendingReceivables"],
    ["Pending Vendor Payouts", "pendingVendorPayouts"],
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance</h1>
          <p className="page-subtitle">
            {records.length} record{records.length === 1 ? "" : "s"} in view
          </p>
        </div>
        <div className="row">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ width: "auto" }}
          />
          <Button onClick={onExport}>Export CSV</Button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {summary && (
        <div className="grid cols-4 mb-4">
          {cards.map(([label, key]) => (
            <div key={label} className="stat-card">
              <div className="value">{formatInr(summary[key])}</div>
              <div className="label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : records.length === 0 ? (
        <EmptyState
          icon="finance"
          title="No finance records yet"
          description={
            month
              ? "No records for this month. Try selecting a different period."
              : "Finance records will appear here as placements are invoiced and payments are processed."
          }
        />
      ) : (
        <Table
          headers={[
            "Candidate",
            "Client",
            "Job",
            "Type",
            "Client Billing",
            "Vendor Payout",
            "Commission",
            "Status",
            "Period",
          ]}
          footer={
            <span>
              Showing {records.length} record
              {records.length === 1 ? "" : "s"}
            </span>
          }
        >
          {records.map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{r.candidateName ?? "—"}</td>
              <td>{r.clientName ?? "—"}</td>
              <td>{r.jobTitle ?? "—"}</td>
              <td>{r.employmentType?.toUpperCase() ?? "—"}</td>
              <td className="whitespace-nowrap text-right">{formatInr(r.clientBillingAmount)}</td>
              <td className="whitespace-nowrap text-right">{formatInr(r.vendorPayoutAmount)}</td>
              <td className="whitespace-nowrap text-right">{formatInr(r.commission)}</td>
              <td>
                <StatusPill status={r.billingStatus} />
              </td>
              <td>{r.period ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { financeExport, financeRecords, financeSummary } from "../../api/pipeline";
import type { FinanceRecord } from "../../api/types";
import { Button, ErrorBox, formatInr, Loading, StatusPill, Table } from "../../components/ui";

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

  const cards: [string, keyof NonNullable<typeof summary>, string][] = [
    ["Total Revenue", "totalRevenue", "/finance"],
    ["Total Commission", "totalCommission", "/finance"],
    ["Pending Receivables", "pendingReceivables", "/finance"],
    ["Pending Vendor Payouts", "pendingVendorPayouts", "/finance"],
  ];

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title">Finance</h1>
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
        <div className="grid cols-4" style={{ marginBottom: "1rem" }}>
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
        >
          {records.map((r) => (
            <tr key={r.id}>
              <td>{r.candidateName ?? "—"}</td>
              <td>{r.clientName ?? "—"}</td>
              <td>{r.jobTitle ?? "—"}</td>
              <td>{r.employmentType?.toUpperCase() ?? "—"}</td>
              <td>{formatInr(r.clientBillingAmount)}</td>
              <td>{formatInr(r.vendorPayoutAmount)}</td>
              <td>{formatInr(r.commission)}</td>
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

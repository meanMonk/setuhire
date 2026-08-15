import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api/client";
import type { ActivityLogItem, AttentionFeedItem, DashboardSummary } from "../api/types";
import { Card, ErrorBox, formatInr, Loading } from "../components/ui";

const STATS: { key: keyof DashboardSummary; label: string; to: string; money?: boolean }[] = [
  { key: "activeClients", label: "Active Clients", to: "/clients" },
  { key: "openJobs", label: "Open Jobs", to: "/jobs" },
  { key: "candidatesAvailable", label: "Candidates Available", to: "/candidates" },
  { key: "vendorsEngaged", label: "Vendors Engaged", to: "/vendors" },
  { key: "interviewsThisWeek", label: "Interviews This Week", to: "/interviews" },
  { key: "pendingBillingAmount", label: "Pending Billing", to: "/finance", money: true },
];

const TONE: Record<string, string> = {
  match: "green",
  vendor: "yellow",
  interview: "blue",
};

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [feed, setFeed] = useState<AttentionFeedItem[]>([]);
  const [activity, setActivity] = useState<ActivityLogItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      get<DashboardSummary>("/dashboard/summary"),
      get<AttentionFeedItem[]>("/dashboard/attention-feed"),
      get<ActivityLogItem[]>("/dashboard/activity-log?limit=10"),
    ]).then(([s, f, a]) => {
      if (s.status === "fulfilled") setSummary(s.value);
      else setError(s.reason instanceof Error ? s.reason.message : "Failed to load summary");
      if (f.status === "fulfilled") setFeed(f.value);
      if (a.status === "fulfilled") setActivity(a.value);
      setLoading(false);
    });
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      {error && <ErrorBox message={error} />}

      <div className="grid cols-6">
        {STATS.map((stat) => (
          <Link key={stat.key} to={stat.to} className="stat-card">
            <div className="value">
              {stat.money
                ? formatInr(summary?.[stat.key] ?? null)
                : (summary?.[stat.key] ?? 0)}
            </div>
            <div className="label">{stat.label}</div>
          </Link>
        ))}
      </div>

      <div className="side-by-side">
        <Card title="Needs Your Attention">
          {feed.length === 0 ? (
            <p className="muted">Nothing needs your attention right now.</p>
          ) : (
            <ul className="feed">
              {feed.map((item, i) => (
                <li key={i} className="feed-item">
                  <span className={`badge ${TONE[item.type ?? ""] ?? "gray"}`}>
                    {item.type ?? "info"}
                  </span>
                  {item.link ? <Link to={item.link}>{item.message}</Link> : <span>{item.message}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Activity">
          {activity.length === 0 ? (
            <p className="muted">No recent activity.</p>
          ) : (
            <ul className="feed">
              {activity.map((item, i) => (
                <li key={i} className="feed-item">
                  <div>
                    {item.candidate && <strong>{item.candidate}</strong>}
                    {item.job && <span className="muted"> → {item.job}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {item.from && item.to ? `${item.from} → ${item.to}` : item.to}
                    {item.at ? ` · ${new Date(item.at).toLocaleString()}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

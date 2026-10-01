import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { canAccess } from "../auth/rbac";
import type { ActivityLogItem, AttentionFeedItem, DashboardSummary } from "../api/types";
import { EmptyState, ErrorBox, formatInr, Icon, Loading } from "../components/ui";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const monday = new Date();
monday.setHours(0, 0, 0, 0);
monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
const sunday = new Date(monday);
sunday.setDate(sunday.getDate() + 6);

type StatDef = {
  key: keyof DashboardSummary;
  label: string;
  to: string;
  icon: Parameters<typeof Icon>[0]["name"];
  tint: "accent" | "warning" | "secondary" | "neutral" | "danger";
  money?: boolean;
};

const STATS: StatDef[] = [
  { key: "activeClients", label: "Active Clients", to: "/clients", icon: "clients", tint: "accent" },
  { key: "openJobs", label: "Open Jobs", to: "/jobs", icon: "jobs", tint: "secondary" },
  {
    key: "candidatesAvailable",
    label: "Available Candidates",
    to: "/candidates",
    icon: "candidate",
    tint: "warning",
  },
  { key: "vendorsEngaged", label: "Active Vendors", to: "/vendors", icon: "vendors", tint: "neutral" },
  {
    key: "interviewsThisWeek",
    label: "Interviews This Week",
    to: `/interviews?from=${isoDate(monday)}&to=${isoDate(sunday)}`,
    icon: "calendar",
    tint: "accent",
  },
  {
    key: "pendingBillingAmount",
    label: "Pending Billing",
    to: "/finance?billing_status=pending",
    icon: "finance",
    tint: "danger",
    money: true,
  },
];

const FEED_TONE: Record<string, string> = {
  match: "accent",
  vendor: "warning",
  interview: "secondary",
};

function relTime(at?: string | null): string {
  if (!at) return "";
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(at).toLocaleDateString();
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [feed, setFeed] = useState<AttentionFeedItem[]>([]);
  const [activity, setActivity] = useState<ActivityLogItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const visibleStats = useMemo(
    () => STATS.filter((stat) => canAccess(user?.role, stat.to.split("?")[0] ?? stat.to)),
    [user?.role],
  );
  const visibleFeed = useMemo(
    () =>
      feed.filter(
        (item) => !item.link || canAccess(user?.role, item.link.split("?")[0] ?? item.link),
      ),
    [feed, user?.role],
  );

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
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Here's what's happening with your hiring pipeline</p>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="dash-grid mb-5">
        {visibleStats.map((stat) => (
          <Link key={stat.key} to={stat.to} className="stat-tile">
            <span className={`stat-icon tint-${stat.tint}`}>
              <Icon name={stat.icon} />
            </span>
            <span>
              <span className="value">
                {stat.money
                  ? formatInr(summary?.[stat.key] ?? null)
                  : (summary?.[stat.key] ?? 0)}
              </span>
              <span className="label">{stat.label}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="side-by-side">
        <section className="card">
          <h3 className="card-title">Needs Your Attention</h3>
          {visibleFeed.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="All clear!"
              description="Nothing needs your attention right now."
            />
          ) : (
            <ul className="feed max-h-[360px] overflow-y-auto">
              {visibleFeed.map((item, i) => (
                <li key={i} className="feed-item">
                  <span className={`feed-dot tint-${FEED_TONE[item.type ?? ""] ?? "neutral"}`} />
                  {item.link ? (
                    <Link to={item.link} className="feed-link">
                      {item.message}
                    </Link>
                  ) : (
                    <span>{item.message}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="card-title">Recent Activity</h3>
          {activity.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No recent activity"
              description="Activity will appear here as you manage jobs, candidates, and interviews."
            />
          ) : (
            <ul className="feed max-h-[360px] overflow-y-auto">
              {activity.map((item, i) => (
                <li key={i} className="feed-item">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      {item.candidate && <strong>{item.candidate}</strong>}
                      {item.job && <span className="muted"> → {item.job}</span>}
                    </div>
                    <span className="shrink-0 text-[11px] text-ink-400">{relTime(item.at)}</span>
                  </div>
                  {(item.from || item.to) && (
                    <div className="stage-move">
                      <span>{item.from ?? "—"}</span>
                      <span className="stage-arrow">→</span>
                      <span className="font-medium text-ink-900">{item.to}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

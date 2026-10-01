import type { ReactNode } from "react";

export function humanize(value?: string | null): string {
  if (!value) return "—";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => (w[0] ?? "").toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatInr(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return "₹" + n.toLocaleString("en-IN");
}

/* ------------------------------------------------------------------ */
/* Icons                                                              */
/* ------------------------------------------------------------------ */

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    filter: (
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </>
    ),
    clients: (
      <>
        <path d="M6 22V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v18" />
        <path d="M2 22h20" />
        <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
      </>
    ),
    vendors: (
      <>
        <rect x="9" y="2" width="6" height="6" rx="1" />
        <rect x="2" y="16" width="6" height="6" rx="1" />
        <rect x="16" y="16" width="6" height="6" rx="1" />
        <path d="M12 8v4M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
      </>
    ),
    jobs: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>
    ),
    candidate: (
      <>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    contract: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8M16 17H8M10 9H8" />
      </>
    ),
    finance: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 12h.01M18 12h.01" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    "panel-left": (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" />
      </>
    ),
    inbox: (
      <>
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </>
    ),
  };

  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export type IconName =
  | "search"
  | "chevron-down"
  | "users"
  | "plus"
  | "filter"
  | "calendar"
  | "dashboard"
  | "clients"
  | "vendors"
  | "jobs"
  | "candidate"
  | "contract"
  | "finance"
  | "logout"
  | "panel-left"
  | "inbox";

/* ------------------------------------------------------------------ */
/* Status / tone mapping                                              */
/* ------------------------------------------------------------------ */

export type Tone = "accent" | "warning" | "secondary" | "neutral" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  accent: "bg-accent-100 text-accent-700",
  warning: "bg-warning-100 text-warning-700",
  secondary: "bg-secondary-100 text-secondary-700",
  neutral: "bg-ink-200/60 text-ink-600",
  danger: "bg-danger-100 text-danger-700",
};

const STATUS_TONES: Record<string, Tone> = {
  open: "accent",
  active: "accent",
  available: "accent",
  placed: "accent",
  cleared: "accent",
  invoiced: "accent",
  payment_received: "accent",
  preferred: "accent",
  on_hold: "warning",
  scheduled: "warning",
  pending: "warning",
  engaged: "warning",
  screened: "warning",
  interview: "secondary",
  offer: "secondary",
  filled: "neutral",
  closed: "neutral",
  not_looking: "neutral",
  rejected: "danger",
  no_show: "danger",
  lost: "danger",
  blacklisted: "danger",
  expired: "danger",
  terminated: "danger",
};

export function statusTone(status?: string | null): Tone {
  if (!status) return "neutral";
  const key = status.toLowerCase().replace(/ /g, "_");
  return STATUS_TONES[key] ?? "neutral";
}

/* ------------------------------------------------------------------ */
/* Primitives                                                         */
/* ------------------------------------------------------------------ */

export function Card({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card">
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 font-heading text-[13px] font-semibold text-ink-900">{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const cls =
    tone === "green"
      ? TONE_CLASSES.accent
      : tone === "red"
        ? TONE_CLASSES.danger
        : tone === "yellow"
          ? TONE_CLASSES.warning
          : tone === "blue"
            ? TONE_CLASSES.secondary
            : tone === "gray"
              ? TONE_CLASSES.neutral
              : TONE_CLASSES.neutral;
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function Button({
  children,
  variant,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" }) {
  return (
    <button className={variant === "primary" ? "primary" : undefined} {...rest}>
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status?: string | null }) {
  const cls = TONE_CLASSES[statusTone(status)];
  return <span className={`status-pill ${cls}`}>{humanize(status)}</span>;
}

export function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) {
    return <span className="status-pill bg-ink-200/50 text-ink-400">Not run</span>;
  }
  const cls =
    score >= 90
      ? TONE_CLASSES.accent
      : score >= 75
        ? TONE_CLASSES.warning
        : TONE_CLASSES.neutral;
  return <span className={`score-badge ${cls}`}>{score}%</span>;
}

export function TechPills({ items, max = 3 }: { items?: string[] | null; max?: number }) {
  if (!items || items.length === 0) return <span className="text-ink-400">—</span>;
  const visible = items.slice(0, max);
  const rest = items.length - visible.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {visible.map((t) => (
        <span key={t} className="tech-pill">
          {t}
        </span>
      ))}
      {rest > 0 && <span className="tech-pill overflow">+{rest} more</span>}
    </span>
  );
}

export function Tags({ items }: { items?: string[] | null }) {
  if (!items || items.length === 0) return <span className="muted">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {items.map((t) => (
        <span key={t} className="tech-pill">
          {t}
        </span>
      ))}
    </span>
  );
}

export function Avatar({ name, dark }: { name?: string | null; dark?: boolean }) {
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return <span className={`avatar ${dark ? "avatar-dark" : ""}`}>{initials}</span>;
}

export function Table({
  headers,
  children,
  footer,
}: {
  headers: string[];
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer && <div className="table-footer">{footer}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="loading">Loading…</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">{message}</div>;
}

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon name={icon} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

import type { ReactNode } from "react";

export function formatInr(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return "₹" + n.toLocaleString("en-IN");
}

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
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone ?? ""}`.trim()}>{children}</span>;
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
  const s = (status ?? "").toLowerCase().replace(/ /g, "_");
  return <span className={`status-pill ${s}`}>{status ?? "—"}</span>;
}

export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
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
  );
}

export function Loading() {
  return <div className="loading">Loading…</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">{message}</div>;
}

export function Tags({ items }: { items?: string[] | null }) {
  if (!items || items.length === 0) return <span className="muted">—</span>;
  return (
    <span>
      {items.map((t) => (
        <Badge key={t}>{t}</Badge>
      ))}
    </span>
  );
}

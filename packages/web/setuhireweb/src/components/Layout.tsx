import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Avatar, Icon, type IconName } from "./ui";

type NavItem = [label: string, to: string, icon: IconName];

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [["Dashboard", "/", "dashboard"]],
  },
  {
    label: "Relationships",
    items: [
      ["Clients", "/clients", "clients"],
      ["Vendors", "/vendors", "vendors"],
    ],
  },
  {
    label: "Pipeline",
    items: [
      ["Jobs", "/jobs", "jobs"],
      ["Candidates", "/candidates", "candidate"],
      ["Interviews", "/interviews", "calendar"],
      ["Contracts", "/contracts", "contract"],
    ],
  },
  {
    label: "Finance",
    items: [["Finance", "/finance", "finance"]],
  },
];

function LogoMark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19c4-6 12-6 16 0" />
      <path d="M7 19V9" />
      <path d="M17 19V9" />
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div className="logo-mark">
            <LogoMark />
          </div>
          <span className="wordmark">SetuHire</span>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name="panel-left" className={collapsed ? "rotate-180" : ""} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section">{section.label}</div>
              {section.items.map(([label, to, icon]) => (
                <NavLink key={to} to={to} end={to === "/"} className="sidebar-link">
                  <Icon name={icon} className="nav-icon" />
                  <span className="sidebar-label">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <Avatar name={user?.name} dark />
          <div className="user-meta">
            <div className="name">{user?.name}</div>
            <div className="role">{user?.role}</div>
          </div>
          <button className="sidebar-logout" onClick={() => void logout()} title="Logout">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

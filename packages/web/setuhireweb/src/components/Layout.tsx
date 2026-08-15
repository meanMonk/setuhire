import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV: [string, string][] = [
  ["Dashboard", "/"],
  ["Clients", "/clients"],
  ["Vendors", "/vendors"],
  ["Jobs", "/jobs"],
  ["Candidates", "/candidates"],
  ["Interviews", "/interviews"],
  ["Contracts", "/contracts"],
  ["Finance", "/finance"],
];

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">SetuHire</div>
        <nav>
          {NAV.map(([label, to]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="user">
          <span>{user?.name}</span>
          <span className="muted">({user?.role})</span>
          <button onClick={() => void logout()}>Logout</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

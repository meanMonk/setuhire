import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { get, post } from "../api/client";
import { canAccess, type Role } from "./rbac";

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  demoRole: Role | null;
  setDemoRole: (role: Role | null) => void;
};

const DEMO_ROLES: Role[] = ["ceo", "admin", "recruiter"];
export { DEMO_ROLES };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoRole, setDemoRole] = useState<Role | null>(null);

  useEffect(() => {
    get<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const r = await post<{ user: User }>("/auth/login", { email, password });
    setDemoRole(null);
    setUser(r.user);
  }

  async function logout() {
    try {
      await post("/auth/logout");
    } finally {
      setDemoRole(null);
      setUser(null);
    }
  }

  const effectiveUser =
    user && demoRole && demoRole !== user.role ? { ...user, role: demoRole } : user;

  return (
    <AuthContext.Provider value={{ user: effectiveUser, loading, login, logout, demoRole, setDemoRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireRole({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (user && !canAccess(user.role, pathname)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { setupDocs } from "./docs.js";
import { healthRoutes } from "./routes/health.js";
import { dbRoutes } from "./routes/db.js";
import { authRoutes } from "./routes/auth.js";
import { clientsRoutes } from "./routes/clients.js";
import { vendorsRoutes } from "./routes/vendors.js";
import { jobsRoutes } from "./routes/jobs.js";
import { candidatesRoutes } from "./routes/candidates.js";
import { matchesRoutes } from "./routes/matches.js";
import { interviewsRoutes } from "./routes/interviews.js";
import { contractsRoutes } from "./routes/contracts.js";
import { financeRoutes } from "./routes/finance.js";
import { dashboardRoutes } from "./routes/dashboard.js";

export const app = new Hono();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:3001", "http://127.0.0.1:3001"],
    credentials: true,
  }),
);

app.route("/health", healthRoutes);
app.route("/db", dbRoutes);
app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/clients", clientsRoutes);
app.route("/api/v1/vendors", vendorsRoutes);
app.route("/api/v1/jobs", jobsRoutes);
app.route("/api/v1/candidates", candidatesRoutes);
app.route("/api/v1/matches", matchesRoutes);
app.route("/api/v1/interviews", interviewsRoutes);
app.route("/api/v1/contracts", contractsRoutes);
app.route("/api/v1/finance", financeRoutes);
app.route("/api/v1/dashboard", dashboardRoutes);

setupDocs(app);

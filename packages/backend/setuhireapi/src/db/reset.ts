/**
 * Full dev reset: drop all tables, push the schema, re-seed from CSVs.
 * Run: `pnpm db:reset` (tsx src/db/reset.ts)
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db, pool } from "./client.js";

const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));

async function dropAllTables() {
  await db.execute(sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  console.log("Dropped all tables (schema recreated).");
}

async function run() {
  await dropAllTables();
  await pool.end();

  const res = spawnSync("pnpm db:push", { cwd: PACKAGE_ROOT, stdio: "inherit", shell: true });
  if (res.status !== 0) {
    console.error("drizzle-kit push failed.");
    process.exit(res.status ?? 1);
  }

  await import("./seed.js");
}

run().catch((err) => {
  console.error("db:reset failed:", err);
  process.exit(1);
});

/**
 * Programmatic migration runner. Applies the generated SQL migrations in
 * `./drizzle` (produced by `pnpm drizzle-kit generate`) against the database
 * configured via PG_URI.
 *
 * Run: `pnpm db:migrate` (tsx src/db/migrate.ts)
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pool } from "./client.js";

const db = drizzle(pool);

async function run() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await pool.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

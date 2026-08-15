/**
 * Driver-agnostic db ping based on DB_TYPE in the package .env.
 * Lazy imports keep deps optional: mongo -> mongodb, postgres -> pg.
 */
export type DbInfo = {
  type: string;
  db: string;
  status: "ok" | "error" | "disabled";
  latencyMs?: number;
};

export async function ping(): Promise<DbInfo> {
  const type = process.env.DB_TYPE ?? "none";
  const db = process.env.DB_NAME ?? "";
  const mongoUri = process.env.MONGODB_URI ?? "";
  const pgUri = process.env.PG_URI ?? "";

  if (type === "mongo") {
    try {
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(mongoUri);
      const start = Date.now();
      await client.db(db).command({ ping: 1 });
      await client.close();
      return { type, db, status: "ok", latencyMs: Date.now() - start };
    } catch {
      return { type, db, status: "error" };
    }
  }

  if (type === "postgres") {
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: pgUri, connectionTimeoutMillis: 2000 });
      const start = Date.now();
      await pool.query("SELECT 1");
      await pool.end();
      return { type, db, status: "ok", latencyMs: Date.now() - start };
    } catch {
      return { type, db, status: "error" };
    }
  }

  return { type, db, status: "disabled" };
}

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString =
  process.env.PG_URI ?? "postgres://setuhire:setuhire@127.0.0.1:5432/app_setuhireapi";

export const pool = new Pool({ connectionString });
export const db = drizzle(pool);

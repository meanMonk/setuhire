import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.PG_URI ?? "postgres://setuhire:setuhire@127.0.0.1:5432/app_setuhireapi",
  },
});

import { Hono } from "hono";
import { ping } from "../lib/db.js";

export const dbRoutes = new Hono();

dbRoutes.get("/ping", async (c) => c.json(await ping()));

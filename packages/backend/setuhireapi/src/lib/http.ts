import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const json = (c: Context, data: unknown, status: ContentfulStatusCode = 200) =>
  c.json(data, status);

export const error = (c: Context, status: ContentfulStatusCode, message: string) =>
  c.json({ error: message }, status);

import type { Context as HonoContext } from 'hono';

export const readOptionalJson = async <Body extends object>(
  c: HonoContext
): Promise<Partial<Body>> => c.req.json<Partial<Body>>().catch(() => ({}));

// ABOUTME: POST /api/trade/proxy-search — proxies a raw trade query to GGG's search endpoint.
// ABOUTME: Requires authentication. Returns query ID, total count, and direct trade site URL.

import { z } from 'zod';
import { requireAuth } from '@/lib/server/auth';
import { success, error, withErrorHandler } from '@/lib/server/response';
import { searchTrade } from '@/lib/server/poe-api';

const DEFAULT_LEAGUE = process.env.POE_LEAGUE ?? 'Settlers';

const ProxySearchSchema = z.object({
  league: z.string().min(1).optional(),
  query: z.object({
    query: z.object({
      status: z.object({ option: z.string() }),
      stats: z.array(
        z.object({
          type: z.string(),
          filters: z.array(
            z.object({
              id: z.string(),
              disabled: z.boolean(),
            }),
          ),
        }),
      ),
      filters: z.record(z.string(), z.unknown()).optional(),
    }),
    sort: z.object({ price: z.string() }),
  }),
});

export const POST = withErrorHandler(async (request: Request) => {
  await requireAuth(request);

  const body = ProxySearchSchema.safeParse(await request.json());
  if (!body.success) {
    return error('Invalid request body', 400);
  }

  const { league, query } = body.data;
  const leagueName = league ?? DEFAULT_LEAGUE;
  const result = await searchTrade(query, leagueName);

  return success({
    id: result.id,
    total: result.total,
    url: `https://www.pathofexile.com/trade/search/${encodeURIComponent(leagueName)}/${result.id}`,
  });
});

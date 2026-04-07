// ABOUTME: POST /api/prices/refresh — clears the poe.watch price cache for a given league.
// ABOUTME: Public endpoint. Forces fresh data on the next price fetch request.

import { success, withErrorHandler } from '@/lib/server/response';
import { refreshCache } from '@/lib/server/price-cache';

const DEFAULT_LEAGUE = process.env.POE_LEAGUE ?? 'Settlers';

export const POST = withErrorHandler(async (request: Request) => {
  const url = new URL(request.url);
  const league = url.searchParams.get('league') ?? DEFAULT_LEAGUE;

  refreshCache(league);

  return success({ refreshed: true });
});

// ABOUTME: GET /api/trade/leagues — returns available PoE leagues filtered to PC realm.
// ABOUTME: Public endpoint, no authentication required. Cached for 24 hours server-side.

import { success, withErrorHandler } from '@/lib/server/response';
import { getLeagues } from '@/lib/server/league-cache';

export const GET = withErrorHandler(async () => {
  const leagues = await getLeagues();
  return success(leagues);
});

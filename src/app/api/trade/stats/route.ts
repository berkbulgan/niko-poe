// ABOUTME: GET /api/trade/stats — returns all PoE trade stat definitions for mod matching.
// ABOUTME: Public endpoint, no authentication required. Cached in-memory for 1 hour.

import { success, withErrorHandler } from '@/lib/server/response';
import { getAllStats } from '@/lib/server/poe-static-data';

export const GET = withErrorHandler(async () => {
  const stats = await getAllStats();
  return success(stats);
});

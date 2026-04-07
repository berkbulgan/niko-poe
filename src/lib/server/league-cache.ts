// ABOUTME: In-memory league list cache with 24h TTL — fetches from PoE Trade API.
// ABOUTME: Falls back to Standard/Settlers if API is unreachable.

import { fetchLeagues } from '@/lib/server/poe-api';
import type { League } from '@/lib/server/poe-api';

const CACHE_TTL_MS = 86400000; // 24 hours

let cachedLeagues: League[] = [];
let cacheTime = 0;

const FALLBACK_LEAGUES: League[] = [
  { id: 'Standard', text: 'Standard' },
  { id: 'Settlers', text: 'Settlers' },
];

export async function getLeagues(forceRefresh = false): Promise<League[]> {
  const now = Date.now();
  if (!forceRefresh && cachedLeagues.length > 0 && now - cacheTime < CACHE_TTL_MS) {
    return cachedLeagues;
  }

  try {
    cachedLeagues = await fetchLeagues();
    cacheTime = Date.now();
    return cachedLeagues;
  } catch (err: unknown) {
    console.error('[league-cache] Failed to fetch leagues, using fallback:', err instanceof Error ? err.message : err);
    if (cachedLeagues.length > 0) return cachedLeagues;
    return FALLBACK_LEAGUES;
  }
}

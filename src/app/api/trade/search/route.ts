// ABOUTME: POST /api/trade/search — high-level search using saved regex filter IDs.
// ABOUTME: Resolves regex patterns to PoE stat IDs, builds query, executes search, returns first 10 results.

import { z } from 'zod';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { success, error, withErrorHandler } from '@/lib/server/response';
import { searchTrade, fetchResults, buildQuery } from '@/lib/server/poe-api';
import { findStatId } from '@/lib/server/poe-static-data';

const DEFAULT_LEAGUE = process.env.POE_LEAGUE ?? 'Settlers';

const SearchSchema = z.object({
  filterIds: z.array(z.string().min(1)).min(1, 'At least one filter ID is required'),
  league: z.string().min(1).optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  currency: z.string().optional(),
});

interface FilterMatch {
  filterName: string;
  pattern: string;
  matchedStatId: string | null;
}

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth(request);

  const body = SearchSchema.safeParse(await request.json());
  if (!body.success) {
    return error(body.error.issues.map((i) => i.message), 400);
  }

  const { filterIds, league, minPrice, maxPrice, currency } = body.data;
  const leagueName = league ?? DEFAULT_LEAGUE;

  // Load regex filters belonging to this user
  const filters = await prisma.regexFilter.findMany({
    where: {
      id: { in: filterIds },
      userId: user.id,
    },
    select: { id: true, name: true, pattern: true },
  });

  if (filters.length === 0) {
    return error('No matching filters found for the given IDs', 404);
  }

  // Resolve each filter pattern to a PoE stat ID
  const filtersUsed: FilterMatch[] = [];
  const statIds: string[] = [];

  for (const filter of filters) {
    const statId = await findStatId(filter.pattern);
    filtersUsed.push({
      filterName: filter.name,
      pattern: filter.pattern,
      matchedStatId: statId ?? null,
    });
    if (statId) {
      statIds.push(statId);
    }
  }

  if (statIds.length === 0) {
    return success({
      queryId: null,
      total: 0,
      results: [],
      filtersUsed,
    });
  }

  // Build and execute the trade query
  const query = buildQuery(statIds, { minPrice, maxPrice, currency });
  const searchResult = await searchTrade(query, leagueName);

  // Fetch first batch of results (max 10)
  const resultIds = searchResult.result.slice(0, 10);

  const results = resultIds.length > 0
    ? await fetchResults(searchResult.id, resultIds)
    : [];

  return success({
    queryId: searchResult.id,
    total: searchResult.total,
    results,
    filtersUsed,
  });
});

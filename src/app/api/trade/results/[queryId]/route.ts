// ABOUTME: GET /api/trade/results/:queryId — fetches detailed item results for a previous search.
// ABOUTME: Requires authentication. Accepts comma-separated result IDs via ?ids= query param.

import { requireAuth } from '@/lib/server/auth';
import { success, error, withErrorHandler } from '@/lib/server/response';
import { fetchResults } from '@/lib/server/poe-api';

export const GET = withErrorHandler(
  async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    await requireAuth(request);

    const { queryId } = await context.params;
    if (!queryId || typeof queryId !== 'string') {
      return error('Missing queryId parameter', 400);
    }

    const url = new URL(request.url);
    const idsParam = url.searchParams.get('ids') ?? '';
    const resultIds = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (resultIds.length === 0) {
      return error('At least one result ID is required via ?ids= query param', 400);
    }

    const results = await fetchResults(queryId, resultIds);
    return success(results);
  },
);

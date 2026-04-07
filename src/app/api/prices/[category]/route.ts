// ABOUTME: GET /api/prices/:category — returns poe.watch price data for a given item category.
// ABOUTME: Public endpoint. Accepts optional ?league= query param, defaults to POE_LEAGUE env.

import { success, error, withErrorHandler } from '@/lib/server/response';
import { fetchPrices } from '@/lib/server/price-cache';

const DEFAULT_LEAGUE = process.env.POE_LEAGUE ?? 'Settlers';

export const GET = withErrorHandler(
  async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const { category } = await context.params;
    if (!category || typeof category !== 'string') {
      return error('Missing category parameter', 400);
    }

    const url = new URL(request.url);
    const league = url.searchParams.get('league') ?? DEFAULT_LEAGUE;

    const items = await fetchPrices(league, category);
    return success(items);
  },
);

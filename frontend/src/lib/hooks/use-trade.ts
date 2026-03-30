// ABOUTME: TanStack Query hooks for trade search operations.
// ABOUTME: Provides mutation for initiating searches and query for fetching results by queryId.

'use client';

import { useAuthQuery, useAuthMutation } from '@/lib/hooks/use-auth-query';
import type {
  TradeSearchRequest,
  TradeSearchResponse,
} from '@/types';

export function useTradeSearch() {
  return useAuthMutation<TradeSearchResponse, TradeSearchRequest>(
    '/trade/search',
    'POST',
  );
}

export function useTradeResults(queryId: string) {
  return useAuthQuery<TradeSearchResponse>(
    ['trade-results', queryId],
    `/trade/results/${queryId}`,
    { enabled: queryId.length > 0 },
  );
}

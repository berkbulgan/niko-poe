// ABOUTME: TanStack Query hooks for fetching poe.ninja price data by category.
// ABOUTME: Public data — uses useQuery directly without auth wrappers.

import { useQuery } from '@tanstack/react-query';
import { getPrices } from '@/lib/ipc';
import type { PriceItem } from '@/types/index';
import type { PriceCategory } from '@/types/strategies';

export type { PriceCategory };

const PRICES_KEY = ['prices'] as const;

const ONE_HOUR = 60 * 60 * 1000;

export function usePrices(category: PriceCategory, league: string) {
  return useQuery<PriceItem[]>({
    queryKey: [...PRICES_KEY, category, league],
    queryFn: () => getPrices(category, league),
    staleTime: ONE_HOUR,
    enabled: league.length > 0,
  });
}

export function useDivinePrice(league: string) {
  const { data } = usePrices('currency', league);
  const divine = data?.find((item) => item.name === 'Divine Orb');
  return divine?.chaosValue ?? 150;
}

// ABOUTME: TanStack Query hooks for fetching poe.watch price data by category.
// ABOUTME: Public data — uses useQuery directly without auth wrappers.

import { useQuery } from '@tanstack/react-query';
import { getPrices } from '@/lib/ipc';
import type { PriceItem } from '@/types/index';

export type PriceCategory =
  | 'scarab'
  | 'deliriumOrb'
  | 'currency'
  | 'chisel'
  | 'astrolabe';

const PRICES_KEY = ['prices'] as const;

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function usePrices(category: PriceCategory, league: string) {
  return useQuery<PriceItem[]>({
    queryKey: [...PRICES_KEY, category, league],
    queryFn: () => getPrices(category, league),
    staleTime: FIFTEEN_MINUTES,
    enabled: league.length > 0,
  });
}

export function useDivinePrice(league: string) {
  const { data } = usePrices('currency', league);
  const divine = data?.find((item) => item.name === 'Divine Orb');
  return divine?.mean ?? 150;
}

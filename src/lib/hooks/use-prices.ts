// ABOUTME: TanStack Query hooks for fetching poe.watch price data by category.
// ABOUTME: Public data — uses useQuery directly without auth wrappers.

'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PoeWatchItem {
  name: string;
  mean: number;
  daily: number;
  change: number;
  lowConfidence: boolean;
  icon: string;
  category: string;
  id: number;
}

export type PriceCategory =
  | 'scarab'
  | 'deliriumOrb'
  | 'currency'
  | 'chisel'
  | 'astrolabe';

const PRICES_KEY = ['prices'] as const;

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function usePrices(category: PriceCategory, league: string) {
  return useQuery<PoeWatchItem[]>({
    queryKey: [...PRICES_KEY, category, league],
    queryFn: () =>
      api.get<PoeWatchItem[]>(`/prices/${category}?league=${encodeURIComponent(league)}`),
    staleTime: FIFTEEN_MINUTES,
    enabled: league.length > 0,
  });
}

export function useDivinePrice(league: string) {
  const { data } = usePrices('currency', league);
  const divine = data?.find((item) => item.name === 'Divine Orb');
  return divine?.mean ?? 150;
}

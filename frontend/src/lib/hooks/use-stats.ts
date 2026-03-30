// ABOUTME: TanStack Query hooks for fetching PoE stat data from the backend.
// ABOUTME: Provides stat categories, stat search, and currency value lookups.

'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface StatEntry {
  id: string;
  text: string;
  type: string;
}

interface StatCategorySummary {
  id: string;
  label: string;
  count: number;
}

interface CurrencyValue {
  id: string;
  name: string;
  chaosEquivalent: number;
}

export function useStatCategories() {
  return useQuery<StatCategorySummary[]>({
    queryKey: ['stat-categories'],
    queryFn: () => api.get<StatCategorySummary[]>('/trade/stats/categories'),
    staleTime: 3600000, // 1 hour — stats don't change often
  });
}

export function useStatSearch(query: string, type?: string) {
  return useQuery<StatEntry[]>({
    queryKey: ['stat-search', query, type],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (type) params.set('type', type);
      params.set('limit', '30');
      return api.get<StatEntry[]>(`/trade/stats/search?${params.toString()}`);
    },
    enabled: query.length >= 2,
    staleTime: 300000, // 5 minutes
  });
}

export function useStatsByType(type: string) {
  return useQuery<StatEntry[]>({
    queryKey: ['stats', type],
    queryFn: () => api.get<StatEntry[]>(`/trade/stats/${type}`),
    enabled: type.length > 0,
    staleTime: 3600000,
  });
}

export function useCurrencies() {
  return useQuery<CurrencyValue[]>({
    queryKey: ['currencies'],
    queryFn: () => api.get<CurrencyValue[]>('/trade/currencies'),
    staleTime: 3600000,
  });
}

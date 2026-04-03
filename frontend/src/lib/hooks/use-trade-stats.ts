// ABOUTME: Fetches PoE trade stat data from backend and provides text-to-statId matching.
// ABOUTME: Stats are cached for 1 hour via TanStack Query. Used for trade search query building.

'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface TradeStat {
  id: string;
  text: string;
  type: string;
}

const ONE_HOUR = 60 * 60 * 1000;

export function useTradeStats() {
  return useQuery<TradeStat[]>({
    queryKey: ['trade-stats'],
    queryFn: () => api.get<TradeStat[]>('/trade/stats'),
    staleTime: ONE_HOUR,
  });
}

export function findStatByText(allStats: TradeStat[], modText: string): string | null {
  const cleaned = modText
    .replace(/\(\d+-\d+\)/g, '#')
    .replace(/\d+/g, '#')
    .trim()
    .toLowerCase();

  // Direct match
  for (const stat of allStats) {
    if (stat.text.toLowerCase() === cleaned) {
      return stat.id;
    }
  }

  // Contains match
  for (const stat of allStats) {
    const statLower = stat.text.toLowerCase();
    if (statLower.includes(cleaned) || cleaned.includes(statLower)) {
      return stat.id;
    }
  }

  // Word-based match (70% of key words must match)
  const keyWords = cleaned
    .replace(/#/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (keyWords.length >= 2) {
    for (const stat of allStats) {
      const statLower = stat.text.toLowerCase();
      const matchCount = keyWords.filter((w) => statLower.includes(w)).length;
      if (matchCount >= keyWords.length * 0.7) {
        return stat.id;
      }
    }
  }

  return null;
}

export function matchModTexts(
  allStats: TradeStat[],
  modTexts: string[],
): Array<{ text: string; statId: string | null }> {
  return modTexts.map((text) => {
    const variants = text.split('|').map((v) => v.trim());
    for (const variant of variants) {
      const statId = findStatByText(allStats, variant);
      if (statId) return { text, statId };
    }
    const statId = findStatByText(allStats, text);
    return { text, statId: statId ?? null };
  });
}

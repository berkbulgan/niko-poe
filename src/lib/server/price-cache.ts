// ABOUTME: poe.watch price cache with 15-minute TTL — fetches bulk price data by category.
// ABOUTME: Supports virtual categories (chisel, astrolabe) that filter from the currency category.

const POE_WATCH_BASE = 'https://api.poe.watch/get';
const CACHE_TTL_MS = 900000; // 15 minutes
const DEFAULT_LEAGUE = process.env.POE_LEAGUE ?? 'Settlers';

interface PoeWatchItem {
  id: number;
  name: string;
  category: string;
  mean: number;
  daily: number;
  change: number;
  lowConfidence: boolean;
  icon: string;
}

interface PoeWatchRawItem {
  id?: number;
  name?: string;
  category?: string;
  mean?: number;
  daily?: number;
  change?: number;
  lowConfidence?: boolean;
  icon?: string;
}

interface CacheEntry {
  items: PoeWatchItem[];
  fetchedAt: number;
}

const VIRTUAL_CATEGORIES: Record<string, { realCategory: string; filterName: string }> = {
  chisel: { realCategory: 'currency', filterName: "Cartographer's Chisel" },
  astrolabe: { realCategory: 'currency', filterName: 'Astrolabe' },
};

const cache = new Map<string, CacheEntry>();

function cacheKey(league: string, category: string): string {
  return `${league}:${category}`;
}

function parsePoeWatchItem(raw: PoeWatchRawItem): PoeWatchItem | null {
  if (typeof raw.id !== 'number' || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    name: raw.name,
    category: typeof raw.category === 'string' ? raw.category : '',
    mean: typeof raw.mean === 'number' ? raw.mean : 0,
    daily: typeof raw.daily === 'number' ? raw.daily : 0,
    change: typeof raw.change === 'number' ? raw.change : 0,
    lowConfidence: typeof raw.lowConfidence === 'boolean' ? raw.lowConfidence : true,
    icon: typeof raw.icon === 'string' ? raw.icon : '',
  };
}

export async function fetchPrices(
  league: string = DEFAULT_LEAGUE,
  category: string,
): Promise<PoeWatchItem[]> {
  const virtual = VIRTUAL_CATEGORIES[category];
  const actualCategory = virtual?.realCategory ?? category;
  const key = cacheKey(league, actualCategory);

  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return virtual
      ? cached.items.filter((item) => item.name === virtual.filterName)
      : cached.items;
  }

  const url = `${POE_WATCH_BASE}?league=${encodeURIComponent(league)}&category=${encodeURIComponent(actualCategory)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CADIRO-TradeHelper/0.1.0' },
  });

  if (!res.ok) {
    throw new Error(`poe.watch fetch failed (${res.status})`);
  }

  const rawItems = (await res.json()) as PoeWatchRawItem[];
  const items: PoeWatchItem[] = [];

  if (Array.isArray(rawItems)) {
    for (const raw of rawItems) {
      const parsed = parsePoeWatchItem(raw);
      if (parsed) items.push(parsed);
    }
  }

  cache.set(key, { items, fetchedAt: Date.now() });

  return virtual
    ? items.filter((item) => item.name === virtual.filterName)
    : items;
}

export async function getPrice(
  league: string = DEFAULT_LEAGUE,
  category: string,
  itemName: string,
): Promise<number | null> {
  const items = await fetchPrices(league, category);
  const match = items.find((item) => item.name.toLowerCase() === itemName.toLowerCase());
  return match?.mean ?? null;
}

export function refreshCache(league: string = DEFAULT_LEAGUE): void {
  const keysToDelete: string[] = [];
  for (const key of cache.keys()) {
    if (key.startsWith(`${league}:`)) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    cache.delete(key);
  }
}

export type { PoeWatchItem };

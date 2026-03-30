// ABOUTME: Injectable service that fetches and caches item prices from the poe.watch API.
// ABOUTME: In-memory cache with 15-minute TTL, keyed by league:category.

import { Injectable, Logger } from '@nestjs/common';
import type { PoeWatchItem } from '@/prices/poe-watch-item.interface';

interface CacheEntry {
  items: PoeWatchItem[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const BASE_URL = 'https://api.poe.watch';

@Injectable()
export class PriceCacheService {
  private readonly logger = new Logger(PriceCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();

  async fetchPrices(league: string, category: string): Promise<PoeWatchItem[]> {
    const key = `${league}:${category}`;
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.items;
    }

    try {
      const url = `${BASE_URL}/get?league=${encodeURIComponent(league)}&category=${encodeURIComponent(category)}`;
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn(`poe.watch returned ${response.status} for ${key}`);
        return cached?.items ?? [];
      }

      const items: PoeWatchItem[] = await response.json() as PoeWatchItem[];
      this.cache.set(key, { items, fetchedAt: Date.now() });
      return items;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch prices for ${key}: ${message}`);
      return cached?.items ?? [];
    }
  }

  async getPrice(
    league: string,
    category: string,
    itemName: string,
  ): Promise<number | undefined> {
    const items = await this.fetchPrices(league, category);
    const item = items.find(
      (i) => i.name.toLowerCase() === itemName.toLowerCase(),
    );
    return item?.mean;
  }

  refreshCache(league: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${league}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    this.logger.log(`Cache cleared for league: ${league}`);
  }
}

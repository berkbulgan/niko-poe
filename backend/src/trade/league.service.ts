// ABOUTME: League data service with daily cache. Fetches from PoE API max once per day.
// ABOUTME: Stores leagues in-memory with TTL. Manual refresh available via endpoint.

import { Injectable, Logger } from '@nestjs/common';
import { PoeApiService } from '@/trade/poe-api.service';

export interface League {
  id: string;
  text: string;
}

@Injectable()
export class LeagueService {
  private readonly logger = new Logger(LeagueService.name);
  private cachedLeagues: League[] = [];
  private lastFetchTime = 0;
  private readonly cacheTtl = 86400000; // 24 hours

  constructor(private readonly poeApiService: PoeApiService) {}

  async getLeagues(forceRefresh = false): Promise<League[]> {
    const now = Date.now();
    const cacheValid = this.cachedLeagues.length > 0 && (now - this.lastFetchTime) < this.cacheTtl;

    if (cacheValid && !forceRefresh) {
      return this.cachedLeagues;
    }

    try {
      this.logger.log('Fetching leagues from PoE Trade API...');
      const leagues = await this.poeApiService.fetchLeagues();

      // Filter to PC leagues only via realm field
      this.cachedLeagues = leagues
        .filter((l) => l.realm === 'pc')
        .map((l) => ({ id: l.id, text: l.text }));

      this.lastFetchTime = now;
      this.logger.log(`Cached ${this.cachedLeagues.length} PC leagues (next refresh in 24h)`);
      return this.cachedLeagues;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Failed to fetch leagues: ${message}. Using cached/fallback.`);

      if (this.cachedLeagues.length > 0) {
        return this.cachedLeagues;
      }

      return [
        { id: 'Standard', text: 'Standard' },
        { id: 'Hardcore', text: 'Hardcore' },
        { id: 'Settlers', text: 'Settlers' },
        { id: 'Hardcore Settlers', text: 'Hardcore Settlers' },
      ];
    }
  }

  getCacheInfo(): { leagueCount: number; lastFetch: string; cacheAge: string; stale: boolean } {
    const age = Date.now() - this.lastFetchTime;
    return {
      leagueCount: this.cachedLeagues.length,
      lastFetch: this.lastFetchTime > 0 ? new Date(this.lastFetchTime).toISOString() : 'never',
      cacheAge: this.lastFetchTime > 0 ? `${Math.floor(age / 60000)}m` : 'n/a',
      stale: this.lastFetchTime === 0 || age >= this.cacheTtl,
    };
  }
}

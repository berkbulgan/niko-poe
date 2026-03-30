// ABOUTME: HTTP client for the official Path of Exile trade API.
// Handles search queries, result fetching, and built-in rate limiting.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TradeQuery {
  query: {
    status: { option: string };
    stats: Array<{
      type: string;
      filters: Array<{
        id: string;
        value?: { min?: number; max?: number };
        disabled: boolean;
      }>;
    }>;
    filters?: Record<string, { filters: Record<string, unknown> }>;
  };
  sort: { price: string };
}

interface TradeSearchResponse {
  id: string;
  complexity: number;
  result: string[];
  total: number;
}

interface TradeFetchResponse {
  result: Array<{
    id: string;
    listing: {
      account: { name: string };
      price: { amount: number; currency: string };
      indexed: string;
    };
    item: {
      name: string;
      typeLine: string;
      explicitMods: string[];
      implicitMods: string[];
    };
  }>;
}

@Injectable()
export class PoeApiService {
  private readonly logger = new Logger(PoeApiService.name);
  private readonly baseUrl: string;
  private readonly defaultLeague: string;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1500; // 1.5 seconds between requests

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'POE_TRADE_API_URL',
      'https://www.pathofexile.com/api/trade',
    );
    this.defaultLeague = this.configService.get<string>(
      'POE_LEAGUE',
      'Settlers',
    );
  }

  async fetchLeagues(): Promise<Array<{ id: string; realm: string; text: string }>> {
    await this.rateLimit();

    const url = `${this.baseUrl}/data/leagues`;
    this.logger.debug(`GET ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CADIRO-TradeHelper/0.1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`League API returned ${response.status}`);
    }

    const data = (await response.json()) as { result: Array<{ id: string; realm: string; text: string }> };
    return data.result;
  }

  async search(
    query: TradeQuery,
    league?: string,
  ): Promise<TradeSearchResponse> {
    await this.rateLimit();

    const targetLeague = league ?? this.defaultLeague;
    const url = `${this.baseUrl}/search/${encodeURIComponent(targetLeague)}`;

    this.logger.debug(`POST ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CADIRO-TradeHelper/0.1.0',
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Trade API search failed: ${response.status} - ${errorText}`,
      );
      throw new Error(
        `PoE Trade API returned ${response.status}: ${errorText}`,
      );
    }

    return (await response.json()) as TradeSearchResponse;
  }

  async fetchResults(
    queryId: string,
    resultIds: string[],
  ): Promise<TradeFetchResponse> {
    await this.rateLimit();

    // PoE API allows max 10 results per fetch
    const ids = resultIds.slice(0, 10).join(',');
    const url = `${this.baseUrl}/fetch/${ids}?query=${queryId}`;

    this.logger.debug(`GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'CADIRO-TradeHelper/0.1.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Trade API fetch failed: ${response.status} - ${errorText}`,
      );
      throw new Error(
        `PoE Trade API returned ${response.status}: ${errorText}`,
      );
    }

    return (await response.json()) as TradeFetchResponse;
  }

  buildQuery(
    statIds: string[],
    options?: {
      minPrice?: number;
      maxPrice?: number;
      currency?: string;
    },
  ): TradeQuery {
    const filters = statIds.map((id) => ({
      id,
      disabled: false,
    }));

    const query: TradeQuery = {
      query: {
        status: { option: 'online' },
        stats: [
          {
            type: 'and',
            filters,
          },
        ],
      },
      sort: { price: 'asc' },
    };

    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      query.query.filters = {
        trade_filters: {
          filters: {
            price: {
              ...(options.minPrice !== undefined && { min: options.minPrice }),
              ...(options.maxPrice !== undefined && { max: options.maxPrice }),
              option: options.currency ?? 'chaos',
            },
          },
        },
      };
    }

    return query;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

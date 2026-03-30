// ABOUTME: Trade service that orchestrates regex filters into PoE trade API searches.
// Loads user filters, maps patterns to stat IDs, and executes trade queries.

import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { RegexFiltersService } from '@/regex-filters/regex-filters.service';
import { PoeApiService } from '@/trade/poe-api.service';
import { PoeStaticDataService } from '@/trade/poe-static-data.service';
import { TradeSearchDto } from '@/trade/dto/trade-search.dto';

export interface TradeSearchResult {
  queryId: string;
  total: number;
  results: Array<{
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
  filtersUsed: Array<{
    filterName: string;
    pattern: string;
    matchedStatId: string | null;
  }>;
}

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly regexFiltersService: RegexFiltersService,
    private readonly poeApiService: PoeApiService,
    private readonly poeStaticDataService: PoeStaticDataService,
  ) {}

  async search(
    userId: string,
    dto: TradeSearchDto,
  ): Promise<TradeSearchResult> {
    // Load all requested filters
    const filters = await Promise.all(
      dto.filterIds.map((id) =>
        this.regexFiltersService.findOne(id, userId),
      ),
    );

    // Map regex patterns to PoE stat IDs
    const filtersUsed = filters.map((filter) => {
      const statId = this.poeStaticDataService.findStatId(filter.pattern);
      return {
        filterName: filter.name,
        pattern: filter.pattern,
        matchedStatId: statId,
      };
    });

    const matchedStatIds = filtersUsed
      .map((f) => f.matchedStatId)
      .filter((id): id is string => id !== null);

    if (matchedStatIds.length === 0) {
      throw new BadRequestException(
        'None of the selected filters could be mapped to PoE trade stat IDs. ' +
          'Try filters that match known item modifiers.',
      );
    }

    this.logger.log(
      `Searching with ${matchedStatIds.length} stat IDs from ${filters.length} filters`,
    );

    // Build and execute the trade query
    const query = this.poeApiService.buildQuery(matchedStatIds, {
      minPrice: dto.minPrice,
      maxPrice: dto.maxPrice,
      currency: dto.currency ?? 'chaos',
    });

    const searchResponse = await this.poeApiService.search(
      query,
      dto.league,
    );

    // Fetch first batch of results
    const resultIds = searchResponse.result.slice(0, 10);
    let results: TradeSearchResult['results'] = [];

    if (resultIds.length > 0) {
      const fetchResponse = await this.poeApiService.fetchResults(
        searchResponse.id,
        resultIds,
      );
      results = fetchResponse.result;
    }

    return {
      queryId: searchResponse.id,
      total: searchResponse.total,
      results,
      filtersUsed,
    };
  }

  async fetchMoreResults(
    queryId: string,
    resultIds: string[],
  ): Promise<TradeSearchResult['results']> {
    const fetchResponse = await this.poeApiService.fetchResults(
      queryId,
      resultIds,
    );
    return fetchResponse.result;
  }
}

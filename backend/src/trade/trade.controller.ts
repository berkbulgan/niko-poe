// ABOUTME: REST controller for PoE trade search, league data, and static data operations.
// ABOUTME: Provides trade search proxy, league list, and public stats lookup endpoints.

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@/auth/auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { TradeService } from '@/trade/trade.service';
import { PoeStaticDataService } from '@/trade/poe-static-data.service';
import { PoeApiService, type TradeQuery } from '@/trade/poe-api.service';
import { LeagueService } from '@/trade/league.service';
import { TradeSearchDto } from '@/trade/dto/trade-search.dto';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

interface TradeProxyBody {
  league: string;
  query: TradeQuery;
}

@ApiTags('Trade')
@Controller('trade')
export class TradeController {
  constructor(
    private readonly tradeService: TradeService,
    private readonly poeStaticDataService: PoeStaticDataService,
    private readonly poeApiService: PoeApiService,
    private readonly leagueService: LeagueService,
  ) {}

  @Get('leagues')
  @ApiOperation({ summary: 'Get available PoE leagues (cached 24h)' })
  async getLeagues() {
    return this.leagueService.getLeagues();
  }

  @Post('leagues/refresh')
  @ApiOperation({ summary: 'Force refresh league list from PoE API' })
  async refreshLeagues() {
    const leagues = await this.leagueService.getLeagues(true);
    return { leagues, cache: this.leagueService.getCacheInfo() };
  }

  @Post('search-by-mods')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search trade by modifier texts — maps stat IDs automatically' })
  async searchByMods(
    @Body() body: {
      league: string;
      preferMods: string[];
      avoidMods: string[];
      filters?: {
        quantity?: string;
        packSize?: string;
        rarity?: string;
        mapTier?: string;
        quality?: string;
        qualityType?: string;
        moreCurrency?: string;
        moreMaps?: string;
        moreScarabs?: string;
        moreDivination?: string;
        corrupted?: 'natural' | 'prefer' | 'avoid';
      };
    },
  ) {
    const f = body.filters;

    // ── 1. Stats filters (pseudo IDs for "more X" and "quality type") ──
    type StatFilter = { id: string; value?: { min?: number }; disabled: boolean };
    const statFilters: StatFilter[] = [];

    // "More X drops" → pseudo stat IDs
    const moreDropsMap: Record<string, string> = {
      moreCurrency: 'pseudo.pseudo_map_more_currency_drops',
      moreMaps: 'pseudo.pseudo_map_more_map_drops',
      moreScarabs: 'pseudo.pseudo_map_more_scarab_drops',
      moreDivination: 'pseudo.pseudo_map_more_card_drops',
    };

    if (f) {
      for (const [key, pseudoId] of Object.entries(moreDropsMap)) {
        const val = f[key as keyof typeof f] as string | undefined;
        if (val) {
          statFilters.push({ id: pseudoId, value: { min: parseInt(val, 10) }, disabled: false });
        }
      }
    }

    // Quality type → pseudo stat ID
    const qualityTypeMap: Record<string, string> = {
      pack_size: 'pseudo.pseudo_map_quality_pack_size',
      rarity: 'pseudo.pseudo_map_quality_rarity',
      currency: 'pseudo.pseudo_map_quality_currency',
      scarabs: 'pseudo.pseudo_map_quality_scarabs',
      cards: 'pseudo.pseudo_map_quality_cards',
    };

    if (f?.quality && f?.qualityType) {
      const qualityPseudoId = qualityTypeMap[f.qualityType];
      if (qualityPseudoId) {
        statFilters.push({ id: qualityPseudoId, value: { min: parseInt(f.quality, 10) }, disabled: false });
      }
    }

    // ── 2. Mod text → stat ID matching ──
    const preferFilters = this.matchModsToStatFilters(body.preferMods ?? []);
    const avoidFilters = this.matchModsToStatFilters(body.avoidMods ?? []);

    const stats: Array<{ type: string; filters: StatFilter[] }> = [];

    // Combine pseudo stat filters + prefer mod filters into "and" group
    const andFilters = [...statFilters, ...preferFilters];
    if (andFilters.length > 0) {
      stats.push({ type: 'and', filters: andFilters });
    }

    if (avoidFilters.length > 0) {
      stats.push({ type: 'not', filters: avoidFilters });
    }

    if (stats.length === 0) {
      stats.push({ type: 'and', filters: [] });
    }

    // ── 3. Map filters (IIQ, IIR, pack size, tier) ──
    const mapFilters: Record<string, { min?: number; max?: number }> = {};
    if (f) {
      if (f.quantity) mapFilters['map_iiq'] = { min: parseInt(f.quantity, 10) };
      if (f.packSize) mapFilters['map_packsize'] = { min: parseInt(f.packSize, 10) };
      if (f.rarity) mapFilters['map_iir'] = { min: parseInt(f.rarity, 10) };
      if (f.mapTier) {
        const tier = parseInt(f.mapTier, 10);
        mapFilters['map_tier'] = { min: tier, max: tier };
      }
    }

    // ── 4. Misc filters (quality value, corrupted) ──
    const miscFilters: Record<string, unknown> = {};
    if (f?.quality) miscFilters['quality'] = { min: parseInt(f.quality, 10) };
    if (f?.corrupted === 'prefer') miscFilters['corrupted'] = { option: 'true' };
    if (f?.corrupted === 'avoid') miscFilters['corrupted'] = { option: 'false' };

    // ── 5. Build final query ──
    const queryFilters: Record<string, { filters: Record<string, unknown> }> = {};
    if (Object.keys(mapFilters).length > 0) queryFilters['map_filters'] = { filters: mapFilters };
    if (Object.keys(miscFilters).length > 0) queryFilters['misc_filters'] = { filters: miscFilters };

    const query: TradeQuery = {
      query: {
        status: { option: 'securable' },
        stats,
        ...(Object.keys(queryFilters).length > 0 ? { filters: queryFilters } : {}),
      },
      sort: { price: 'asc' },
    };

    const result = await this.poeApiService.search(query, body.league);

    return {
      id: result.id,
      total: result.total,
      url: `https://www.pathofexile.com/trade/search/${encodeURIComponent(body.league)}/${result.id}`,
    };
  }

  private matchModsToStatFilters(modTexts: string[]): Array<{ id: string; disabled: boolean }> {
    const filters: Array<{ id: string; disabled: boolean }> = [];

    for (const text of modTexts) {
      // Try each variant if text has | separators (e.g. "mod1|mod2|mod3")
      const variants = text.split('|').map((v) => v.trim());
      let matched = false;

      for (const variant of variants) {
        const statId = this.poeStaticDataService.findStatByText(variant);
        if (statId) {
          filters.push({ id: statId, disabled: false });
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Try the full text as-is
        const statId = this.poeStaticDataService.findStatByText(text);
        if (statId) {
          filters.push({ id: statId, disabled: false });
        }
      }
    }

    return filters;
  }

  @Post('proxy-search')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Proxy a trade search to PoE API, return query ID for redirect' })
  async proxySearch(@Body() body: TradeProxyBody) {
    const result = await this.poeApiService.search(
      body.query,
      body.league,
    );
    return {
      id: result.id,
      total: result.total,
      url: `https://www.pathofexile.com/trade/search/${encodeURIComponent(body.league)}/${result.id}`,
    };
  }

  @Post('search')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search PoE trade using regex filters' })
  search(
    @CurrentUser() user: UserProfile,
    @Body() dto: TradeSearchDto,
  ) {
    return this.tradeService.search(user.id, dto);
  }

  @Get('results/:queryId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch more details for a previous trade search' })
  fetchResults(@Param('queryId') queryId: string) {
    return this.tradeService.fetchMoreResults(queryId, []);
  }

  @Get('stats/categories')
  @ApiOperation({ summary: 'Get all stat categories (explicit, implicit, pseudo, etc.)' })
  getStatCategories() {
    return this.poeStaticDataService.getCategories().map((cat) => ({
      id: cat.id,
      label: cat.label,
      count: cat.entries.length,
    }));
  }

  @Get('stats/search')
  @ApiOperation({ summary: 'Search stats by text query' })
  searchStats(
    @Query('q') query: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const maxResults = limit ? Math.min(parseInt(limit, 10), 100) : 20;

    if (type) {
      const typeStats = this.poeStaticDataService.getStatsByType(type);
      const lower = (query ?? '').toLowerCase();
      return typeStats
        .filter((s) => !query || s.text.toLowerCase().includes(lower))
        .slice(0, maxResults);
    }

    return this.poeStaticDataService.searchStats(query ?? '', maxResults);
  }

  @Get('stats/:type')
  @ApiOperation({ summary: 'Get all stats for a specific type (explicit, implicit, etc.)' })
  getStatsByType(@Param('type') type: string) {
    return this.poeStaticDataService.getStatsByType(type);
  }

  @Get('currencies')
  @ApiOperation({ summary: 'Get currency values in chaos equivalent' })
  getCurrencies() {
    return this.poeStaticDataService.getCurrencyValues();
  }
}

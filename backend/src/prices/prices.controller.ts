// ABOUTME: REST controller for fetching item prices from poe.watch.
// ABOUTME: Public endpoints — no auth required. Supports category lookup and cache refresh.

import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PriceCacheService } from '@/prices/price-cache.service';

@ApiTags('Prices')
@Controller('prices')
export class PricesController {
  constructor(
    private readonly priceCacheService: PriceCacheService,
    private readonly configService: ConfigService,
  ) {}

  @Get(':category')
  @ApiOperation({ summary: 'Get prices for a category from poe.watch' })
  @ApiQuery({ name: 'league', required: false })
  async fetchPrices(
    @Param('category') category: string,
    @Query('league') league?: string,
  ) {
    const resolvedLeague =
      league ?? this.configService.get<string>('POE_LEAGUE', 'Settlers');

    // Virtual category: "chisel" → fetch currency, filter to chisels only
    if (category === 'chisel') {
      const allCurrency = await this.priceCacheService.fetchPrices(resolvedLeague, 'currency');
      return allCurrency.filter((item) =>
        item.name.toLowerCase().includes('chisel'),
      );
    }

    return this.priceCacheService.fetchPrices(resolvedLeague, category);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Force refresh price cache for a league' })
  @ApiQuery({ name: 'league', required: false })
  refreshCache(@Query('league') league?: string) {
    const resolvedLeague =
      league ?? this.configService.get<string>('POE_LEAGUE', 'Settlers');
    this.priceCacheService.refreshCache(resolvedLeague);
    return { message: `Cache cleared for league: ${resolvedLeague}` };
  }
}

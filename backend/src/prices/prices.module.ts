// ABOUTME: Feature module for item price lookups via poe.watch API.
// ABOUTME: Provides cached price data for scarabs, maps, currency, etc.

import { Module } from '@nestjs/common';
import { PriceCacheService } from '@/prices/price-cache.service';
import { PricesController } from '@/prices/prices.controller';

@Module({
  controllers: [PricesController],
  providers: [PriceCacheService],
  exports: [PriceCacheService],
})
export class PricesModule {}

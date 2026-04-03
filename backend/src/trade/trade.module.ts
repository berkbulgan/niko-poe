// ABOUTME: Feature module for PoE trade search functionality.
// ABOUTME: Integrates regex filters with the official PoE trade API.

import { Module } from '@nestjs/common';
import { TradeService } from '@/trade/trade.service';
import { TradeController } from '@/trade/trade.controller';
import { PoeApiService } from '@/trade/poe-api.service';
import { PoeStaticDataService } from '@/trade/poe-static-data.service';
import { LeagueService } from '@/trade/league.service';
import { AuthModule } from '@/auth/auth.module';
import { RegexFiltersModule } from '@/regex-filters/regex-filters.module';

@Module({
  imports: [AuthModule, RegexFiltersModule],
  controllers: [TradeController],
  providers: [TradeService, PoeApiService, PoeStaticDataService, LeagueService],
  // PoeStaticDataService kept for TradeService.search() stat ID matching
})
export class TradeModule {}

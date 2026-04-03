// ABOUTME: REST controller for PoE trade search proxy and league data.
// ABOUTME: Provides trade proxy, regex-based search, and league list endpoints.

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@/auth/auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { TradeService } from '@/trade/trade.service';
import { PoeApiService, type TradeQuery } from '@/trade/poe-api.service';
import { PoeStaticDataService } from '@/trade/poe-static-data.service';
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
    private readonly poeApiService: PoeApiService,
    private readonly poeStaticDataService: PoeStaticDataService,
    private readonly leagueService: LeagueService,
  ) {}

  @Get('leagues')
  @ApiOperation({ summary: 'Get available PoE leagues (cached 24h)' })
  async getLeagues() {
    return this.leagueService.getLeagues();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get all PoE trade stats (cached 1h, for frontend stat matching)' })
  getStats() {
    return this.poeStaticDataService.getAllStats();
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
}

// ABOUTME: REST controller for strategy CRUD operations.
// ABOUTME: Auth-protected routes for managing mapping strategies, plus public share code lookup.

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@/auth/auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { StrategiesService } from '@/strategies/strategies.service';
import { CreateStrategyDto } from '@/strategies/dto/create-strategy.dto';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

@ApiTags('Strategies')
@Controller('strategies')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class StrategiesController {
  constructor(private readonly service: StrategiesService) {}

  @Get()
  @ApiOperation({ summary: 'List all strategies for current user' })
  findAll(@CurrentUser() user: UserProfile) {
    return this.service.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single strategy' })
  findOne(@CurrentUser() user: UserProfile, @Param('id') id: string) {
    return this.service.findOne(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new strategy' })
  create(@CurrentUser() user: UserProfile, @Body() dto: CreateStrategyDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a strategy' })
  update(
    @CurrentUser() user: UserProfile,
    @Param('id') id: string,
    @Body() dto: Partial<CreateStrategyDto>,
  ) {
    return this.service.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a strategy' })
  remove(@CurrentUser() user: UserProfile, @Param('id') id: string) {
    return this.service.remove(id, user.id);
  }

  @Get('share/:code')
  @ApiOperation({ summary: 'Get a strategy by its 8-digit share code (public)' })
  findByShareCode(@Param('code') code: string) {
    return this.service.findByShareCode(code);
  }

  @Post('import/:code')
  @ApiOperation({ summary: 'Import a shared strategy into your account' })
  importStrategy(
    @CurrentUser() user: UserProfile,
    @Param('code') code: string,
  ) {
    return this.service.importByShareCode(code, user.id);
  }
}

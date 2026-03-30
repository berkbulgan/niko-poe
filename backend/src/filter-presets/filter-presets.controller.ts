// ABOUTME: REST controller for filter preset CRUD operations.
// ABOUTME: All routes require auth. Users can save, load, update, and delete presets.

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
import { FilterPresetsService } from '@/filter-presets/filter-presets.service';
import { CreateFilterPresetDto } from '@/filter-presets/dto/create-filter-preset.dto';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

@ApiTags('Filter Presets')
@Controller('filter-presets')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class FilterPresetsController {
  constructor(private readonly service: FilterPresetsService) {}

  @Get()
  @ApiOperation({ summary: 'List all filter presets for current user' })
  findAll(@CurrentUser() user: UserProfile) {
    return this.service.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single filter preset' })
  findOne(@CurrentUser() user: UserProfile, @Param('id') id: string) {
    return this.service.findOne(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Save a new filter preset' })
  create(@CurrentUser() user: UserProfile, @Body() dto: CreateFilterPresetDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a filter preset' })
  update(
    @CurrentUser() user: UserProfile,
    @Param('id') id: string,
    @Body() dto: Partial<CreateFilterPresetDto>,
  ) {
    return this.service.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a filter preset' })
  remove(@CurrentUser() user: UserProfile, @Param('id') id: string) {
    return this.service.remove(id, user.id);
  }

  @Get('share/:code')
  @ApiOperation({ summary: 'Get a preset by its 8-digit share code (public)' })
  findByShareCode(@Param('code') code: string) {
    return this.service.findByShareCode(code);
  }

  @Post('import/:code')
  @ApiOperation({ summary: 'Import a shared preset into your account' })
  importPreset(@CurrentUser() user: UserProfile, @Param('code') code: string) {
    return this.service.importByShareCode(code, user.id);
  }
}

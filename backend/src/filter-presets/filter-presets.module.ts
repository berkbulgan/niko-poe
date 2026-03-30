// ABOUTME: Feature module for filter presets (saved configurations).
// ABOUTME: Provides CRUD endpoints for saving/loading full picker state.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilterPreset } from '@/filter-presets/entities/filter-preset.entity';
import { FilterPresetsService } from '@/filter-presets/filter-presets.service';
import { FilterPresetsController } from '@/filter-presets/filter-presets.controller';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([FilterPreset]), AuthModule],
  controllers: [FilterPresetsController],
  providers: [FilterPresetsService],
})
export class FilterPresetsModule {}

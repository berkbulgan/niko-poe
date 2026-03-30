// ABOUTME: DTO for creating a new filter preset.
// ABOUTME: Validates name and config JSON structure.

import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import type { FilterPresetConfig } from '@/filter-presets/entities/filter-preset.entity';

export class CreateFilterPresetDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsObject()
  @IsNotEmpty()
  config!: FilterPresetConfig;
}

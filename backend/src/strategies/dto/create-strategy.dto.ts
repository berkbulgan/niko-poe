// ABOUTME: DTO for creating a new mapping strategy.
// ABOUTME: Validates name and config JSON structure with class-validator.

import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import type { StrategyConfig } from '@/strategies/entities/strategy.entity';

export class CreateStrategyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsObject()
  @IsNotEmpty()
  config!: StrategyConfig;
}

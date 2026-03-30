// ABOUTME: DTO for creating a new regex filter.
// Validates name, category (must be one of the allowed values), and pattern.

import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

type FilterCategory = 'stat' | 'modifier' | 'attribute' | 'custom';

const VALID_CATEGORIES: FilterCategory[] = ['stat', 'modifier', 'attribute', 'custom'];

export class CreateRegexFilterDto {
  @ApiProperty({ example: 'High Life' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Matches items with 80+ max life' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: VALID_CATEGORIES, example: 'stat' })
  @IsString()
  @IsIn(VALID_CATEGORIES)
  category!: string;

  @ApiProperty({ example: '\\+[89]\\d to maximum Life' })
  @IsString()
  @IsNotEmpty()
  pattern!: string;
}

// ABOUTME: DTO for initiating a trade search using regex filter IDs.
// Maps user-selected filters to a PoE trade API query.

import {
  IsArray,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TradeSearchDto {
  @ApiProperty({
    type: [String],
    description: 'Array of regex filter UUIDs to use in the search',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  filterIds!: string[];

  @ApiPropertyOptional({ example: 'Settlers' })
  @IsOptional()
  @IsString()
  league?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 'chaos', default: 'chaos' })
  @IsOptional()
  @IsString()
  currency?: string;
}

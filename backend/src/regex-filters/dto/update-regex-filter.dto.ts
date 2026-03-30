// ABOUTME: DTO for updating an existing regex filter.
// All fields are optional; extends CreateRegexFilterDto via PartialType.

import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateRegexFilterDto } from '@/regex-filters/dto/create-regex-filter.dto';

export class UpdateRegexFilterDto extends PartialType(CreateRegexFilterDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

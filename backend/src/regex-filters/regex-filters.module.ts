// ABOUTME: Feature module for regex filter management.
// Provides CRUD operations and regex validation/testing capabilities.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegexFilter } from '@/regex-filters/entities/regex-filter.entity';
import { RegexFiltersService } from '@/regex-filters/regex-filters.service';
import { RegexValidatorService } from '@/regex-filters/regex-validator.service';
import { RegexFiltersController } from '@/regex-filters/regex-filters.controller';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([RegexFilter]), AuthModule],
  controllers: [RegexFiltersController],
  providers: [RegexFiltersService, RegexValidatorService],
  exports: [RegexFiltersService, RegexValidatorService],
})
export class RegexFiltersModule {}

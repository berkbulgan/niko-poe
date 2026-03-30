// ABOUTME: REST controller for regex filter CRUD and regex testing.
// All routes except POST /test require authentication via AuthGuard.

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@/auth/auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { RegexFiltersService } from '@/regex-filters/regex-filters.service';
import { RegexValidatorService } from '@/regex-filters/regex-validator.service';
import { CreateRegexFilterDto } from '@/regex-filters/dto/create-regex-filter.dto';
import { UpdateRegexFilterDto } from '@/regex-filters/dto/update-regex-filter.dto';
import { TestRegexDto } from '@/regex-filters/dto/test-regex.dto';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';
import { RegexFilter } from '@/regex-filters/entities/regex-filter.entity';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

interface RegexMatchResult {
  line: number;
  text: string;
  matches: string[];
}

interface TestRegexResponse {
  valid: boolean;
  error: string | null;
  matches: RegexMatchResult[];
}

interface PaginatedResult<TItem> {
  data: TItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

@ApiTags('Regex Filters')
@Controller('regex-filters')
export class RegexFiltersController {
  constructor(
    private readonly filtersService: RegexFiltersService,
    private readonly regexValidator: RegexValidatorService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List regex filters for the current user' })
  findAll(
    @CurrentUser() user: UserProfile,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<RegexFilter>> {
    return this.filtersService.findAll(user.id, query.page, query.limit);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single regex filter by ID' })
  findOne(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RegexFilter> {
    return this.filtersService.findOne(id, user.id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new regex filter' })
  create(
    @CurrentUser() user: UserProfile,
    @Body() dto: CreateRegexFilterDto,
  ): Promise<RegexFilter> {
    return this.filtersService.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing regex filter' })
  update(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRegexFilterDto,
  ): Promise<RegexFilter> {
    return this.filtersService.update(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a regex filter' })
  remove(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.filtersService.remove(id, user.id);
  }

  @Post('test')
  @ApiOperation({ summary: 'Test a regex pattern against sample text (no auth required)' })
  testRegex(@Body() dto: TestRegexDto): TestRegexResponse {
    const validation = this.regexValidator.validatePattern(dto.pattern);
    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error,
        matches: [],
      };
    }

    const matches = this.regexValidator.testAgainstText(dto.pattern, dto.text);
    return {
      valid: true,
      error: null,
      matches,
    };
  }
}

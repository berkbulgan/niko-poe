// ABOUTME: CRUD service for regex filters, scoped to the authenticated user.
// Handles creation, retrieval, update, and deletion with ownership validation.

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegexFilter } from '@/regex-filters/entities/regex-filter.entity';
import { CreateRegexFilterDto } from '@/regex-filters/dto/create-regex-filter.dto';
import { UpdateRegexFilterDto } from '@/regex-filters/dto/update-regex-filter.dto';
import { RegexValidatorService } from '@/regex-filters/regex-validator.service';

interface PaginatedResult<TItem> {
  data: TItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

@Injectable()
export class RegexFiltersService {
  constructor(
    @InjectRepository(RegexFilter)
    private readonly filterRepository: Repository<RegexFilter>,
    private readonly regexValidator: RegexValidatorService,
  ) {}

  async findAll(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<RegexFilter>> {
    const [data, total] = await this.filterRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { total, page, limit },
    };
  }

  async findOne(id: string, userId: string): Promise<RegexFilter> {
    const filter = await this.filterRepository.findOne({
      where: { id, userId },
    });

    if (!filter) {
      throw new NotFoundException(`Regex filter with id "${id}" not found`);
    }

    return filter;
  }

  async create(
    userId: string,
    dto: CreateRegexFilterDto,
  ): Promise<RegexFilter> {
    const validation = this.regexValidator.validatePattern(dto.pattern);
    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid regex pattern: ${validation.error}`,
      );
    }

    const filter = this.filterRepository.create({
      userId,
      name: dto.name,
      description: dto.description ?? null,
      category: dto.category,
      pattern: dto.pattern,
    });

    return this.filterRepository.save(filter);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateRegexFilterDto,
  ): Promise<RegexFilter> {
    const filter = await this.findOne(id, userId);

    if (dto.pattern !== undefined) {
      const validation = this.regexValidator.validatePattern(dto.pattern);
      if (!validation.valid) {
        throw new BadRequestException(
          `Invalid regex pattern: ${validation.error}`,
        );
      }
    }

    Object.assign(filter, dto);
    return this.filterRepository.save(filter);
  }

  async remove(id: string, userId: string): Promise<void> {
    const filter = await this.findOne(id, userId);
    await this.filterRepository.remove(filter);
  }
}

// ABOUTME: Service for CRUD operations on filter presets.
// ABOUTME: Each preset belongs to a user, stores full picker configuration.

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilterPreset } from '@/filter-presets/entities/filter-preset.entity';
import { CreateFilterPresetDto } from '@/filter-presets/dto/create-filter-preset.dto';

@Injectable()
export class FilterPresetsService {
  constructor(
    @InjectRepository(FilterPreset)
    private readonly repo: Repository<FilterPreset>,
  ) {}

  async findAll(userId: string): Promise<FilterPreset[]> {
    return this.repo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<FilterPreset> {
    const preset = await this.repo.findOne({ where: { id, userId } });
    if (!preset) throw new NotFoundException('Preset not found');
    return preset;
  }

  async create(userId: string, dto: CreateFilterPresetDto): Promise<FilterPreset> {
    const preset = this.repo.create({ userId, ...dto });
    return this.repo.save(preset);
  }

  async update(id: string, userId: string, dto: Partial<CreateFilterPresetDto>): Promise<FilterPreset> {
    const preset = await this.findOne(id, userId);
    Object.assign(preset, dto);
    return this.repo.save(preset);
  }

  async remove(id: string, userId: string): Promise<void> {
    const preset = await this.findOne(id, userId);
    await this.repo.remove(preset);
  }

  async findByShareCode(code: string): Promise<FilterPreset> {
    const preset = await this.repo.findOne({ where: { shareCode: code } });
    if (!preset) throw new NotFoundException('Preset not found for this share code');
    return preset;
  }

  async importByShareCode(code: string, userId: string): Promise<FilterPreset> {
    const source = await this.findByShareCode(code);
    const imported = this.repo.create({
      userId,
      name: `${source.name} (imported)`,
      config: source.config,
    });
    return this.repo.save(imported);
  }
}

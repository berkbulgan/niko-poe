// ABOUTME: Service for CRUD operations on mapping strategies.
// ABOUTME: Each strategy belongs to a user, stores item/cost breakdown as JSONB.

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy } from '@/strategies/entities/strategy.entity';
import { CreateStrategyDto } from '@/strategies/dto/create-strategy.dto';

@Injectable()
export class StrategiesService {
  constructor(
    @InjectRepository(Strategy)
    private readonly repo: Repository<Strategy>,
  ) {}

  async findAll(userId: string): Promise<Strategy[]> {
    return this.repo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Strategy> {
    const strategy = await this.repo.findOne({ where: { id, userId } });
    if (!strategy) throw new NotFoundException('Strategy not found');
    return strategy;
  }

  async create(userId: string, dto: CreateStrategyDto): Promise<Strategy> {
    const strategy = this.repo.create({ userId, ...dto });
    return this.repo.save(strategy);
  }

  async update(
    id: string,
    userId: string,
    dto: Partial<CreateStrategyDto>,
  ): Promise<Strategy> {
    const strategy = await this.findOne(id, userId);
    Object.assign(strategy, dto);
    return this.repo.save(strategy);
  }

  async remove(id: string, userId: string): Promise<void> {
    const strategy = await this.findOne(id, userId);
    await this.repo.remove(strategy);
  }

  async findByShareCode(code: string): Promise<Strategy> {
    const strategy = await this.repo.findOne({
      where: { shareCode: code },
    });
    if (!strategy)
      throw new NotFoundException('Strategy not found for this share code');
    return strategy;
  }

  async importByShareCode(code: string, userId: string): Promise<Strategy> {
    const source = await this.findByShareCode(code);
    const imported = this.repo.create({
      userId,
      name: `${source.name} (imported)`,
      config: source.config,
    });
    return this.repo.save(imported);
  }
}

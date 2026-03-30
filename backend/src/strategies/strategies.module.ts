// ABOUTME: Feature module for mapping strategies (scarab/deli/currency combos).
// ABOUTME: Provides CRUD endpoints for saving/loading strategy configurations.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Strategy } from '@/strategies/entities/strategy.entity';
import { StrategiesService } from '@/strategies/strategies.service';
import { StrategiesController } from '@/strategies/strategies.controller';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Strategy]), AuthModule],
  controllers: [StrategiesController],
  providers: [StrategiesService],
})
export class StrategiesModule {}

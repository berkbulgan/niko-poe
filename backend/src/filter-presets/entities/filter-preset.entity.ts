// ABOUTME: TypeORM entity for saved filter presets (full map stat + mod configurations).
// ABOUTME: Stores the entire picker state as JSON. Has unique 8-digit share code for importing.

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { User } from '@/auth/entities/user.entity';

function generateShareCode(): string {
  // 8-digit numeric code: 10000000 - 99999999
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

@Entity('filter_presets')
export class FilterPreset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 8, unique: true, name: 'share_code' })
  shareCode!: string;

  @Column({ type: 'jsonb' })
  config!: FilterPresetConfig;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @BeforeInsert()
  setShareCode() {
    if (!this.shareCode) {
      this.shareCode = generateShareCode();
    }
  }
}

export interface FilterPresetConfig {
  quantity: string;
  packSize: string;
  rarity: string;
  mapTier: string;
  quality: string;
  qualityType: string;
  moreCurrency: string;
  moreMaps: string;
  moreScarabs: string;
  moreDivination: string;
  corrupted: 'natural' | 'prefer' | 'avoid';
  avoidModIds: number[];
  preferModIds: number[];
}

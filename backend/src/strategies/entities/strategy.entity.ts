// ABOUTME: TypeORM entity for mapping strategies (scarab/deli/currency combos per map run).
// ABOUTME: Stores cost breakdown as JSONB. Has unique 8-digit share code for importing.

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

type StrategyItemCategory =
  | 'scarab'
  | 'deliriumOrb'
  | 'currency'
  | 'map'
  | 'fragment';

export interface StrategyItem {
  category: StrategyItemCategory;
  name: string;
  quantity: number;
  priceSnapshot: number;
}

export interface StrategyConfig {
  mapCount: number;
  items: StrategyItem[];
  averageMapCost: number;
  totalCostPerMap: number;
  totalCost: number;
  filterPresetId: string | null;
}

function generateShareCode(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

@Entity('strategies')
export class Strategy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 8, unique: true, name: 'share_code' })
  shareCode!: string;

  @Column({ type: 'jsonb' })
  config!: StrategyConfig;

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

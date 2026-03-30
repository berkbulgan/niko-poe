// ABOUTME: TypeORM DataSource configuration for CLI migrations.
// Reads connection settings from environment variables with sensible defaults.

import { DataSource } from 'typeorm';
import { User } from '@/auth/entities/user.entity';
import { RegexFilter } from '@/regex-filters/entities/regex-filter.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  database: process.env['DB_NAME'] ?? 'cadiro',
  username: process.env['DB_USER'] ?? 'postgres',
  password: process.env['DB_PASS'] ?? 'postgres',
  entities: [User, RegexFilter],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: true,
});

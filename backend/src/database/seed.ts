// ABOUTME: Database seed script that creates test users and sample regex filters.
// Run with: npm run seed

import 'reflect-metadata';
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { User } from '@/auth/entities/user.entity';
import { RegexFilter } from '@/regex-filters/entities/regex-filter.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  database: process.env['DB_NAME'] ?? 'cadiro',
  username: process.env['DB_USER'] ?? 'postgres',
  password: process.env['DB_PASS'] ?? 'postgres',
  entities: [User, RegexFilter],
  synchronize: true,
});

async function seed(): Promise<void> {
  await dataSource.initialize();
  console.log('Database connected.');

  const userRepo = dataSource.getRepository(User);
  const filterRepo = dataSource.getRepository(RegexFilter);

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('123456', saltRounds);

  // Create test users
  let user1 = await userRepo.findOne({ where: { username: 'test1' } });
  if (!user1) {
    user1 = userRepo.create({
      username: 'test1',
      passwordHash,
      displayName: 'Test User 1',
    });
    user1 = await userRepo.save(user1);
    console.log(`Created user: ${user1.username} (${user1.id})`);
  } else {
    console.log(`User already exists: ${user1.username} (${user1.id})`);
  }

  let user2 = await userRepo.findOne({ where: { username: 'test2' } });
  if (!user2) {
    user2 = userRepo.create({
      username: 'test2',
      passwordHash,
      displayName: 'Test User 2',
    });
    user2 = await userRepo.save(user2);
    console.log(`Created user: ${user2.username} (${user2.id})`);
  } else {
    console.log(`User already exists: ${user2.username} (${user2.id})`);
  }

  // Create sample regex filters for test1
  const sampleFilters = [
    {
      name: 'High Life',
      description: 'Matches items with 80+ maximum Life',
      category: 'stat',
      pattern: '\\+[89]\\d to maximum Life',
    },
    {
      name: 'Triple Res',
      description: 'Matches 30%+ elemental resistance mods',
      category: 'modifier',
      pattern: '\\+[3-4]\\d% to (Fire|Cold|Lightning) Resistance',
    },
    {
      name: 'Movement Speed',
      description: 'Matches any movement speed modifier',
      category: 'attribute',
      pattern: '\\d+% increased Movement Speed',
    },
  ];

  for (const filterData of sampleFilters) {
    const existing = await filterRepo.findOne({
      where: { userId: user1.id, name: filterData.name },
    });

    if (!existing) {
      const filter = filterRepo.create({
        userId: user1.id,
        ...filterData,
      });
      const saved = await filterRepo.save(filter);
      console.log(`Created filter: ${saved.name} (${saved.id})`);
    } else {
      console.log(`Filter already exists: ${existing.name} (${existing.id})`);
    }
  }

  console.log('Seed completed.');
  await dataSource.destroy();
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

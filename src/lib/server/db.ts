// ABOUTME: Prisma client singleton for Next.js — prevents multiple instances in dev hot reload.
// ABOUTME: Import this everywhere server-side DB access is needed.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

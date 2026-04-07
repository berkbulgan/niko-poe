// ABOUTME: GET/PATCH/DELETE /api/strategies/:id — single strategy CRUD operations.
// ABOUTME: All operations verify the strategy belongs to the authenticated user.

import { z } from 'zod';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { success, error, withErrorHandler } from '@/lib/server/response';

const UpdateStrategySchema = z.object({
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
}).partial();

export const GET = withErrorHandler(async (request: Request, context: { params: Promise<Record<string, string>> }) => {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const strategy = await prisma.strategy.findUnique({ where: { id } });

  if (!strategy || strategy.userId !== user.id) {
    return error('Strategy not found', 404);
  }

  return success(strategy);
});

export const PATCH = withErrorHandler(async (request: Request, context: { params: Promise<Record<string, string>> }) => {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const body = UpdateStrategySchema.safeParse(await request.json());
  if (!body.success) {
    return error('Invalid request body', 400);
  }

  const existing = await prisma.strategy.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return error('Strategy not found', 404);
  }

  const updated = await prisma.strategy.update({
    where: { id },
    data: body.data,
  });

  return success(updated);
});

export const DELETE = withErrorHandler(async (request: Request, context: { params: Promise<Record<string, string>> }) => {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const existing = await prisma.strategy.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return error('Strategy not found', 404);
  }

  await prisma.strategy.delete({ where: { id } });

  return success({ deleted: true });
});

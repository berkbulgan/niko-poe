// ABOUTME: GET/PATCH/DELETE /api/atlas-trees/:id — single atlas tree CRUD operations.
// ABOUTME: All operations verify the atlas tree belongs to the authenticated user.

import { z } from 'zod';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { success, error, withErrorHandler } from '@/lib/server/response';

const UpdateAtlasTreeSchema = z.object({
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
}).partial();

export const GET = withErrorHandler(async (request: Request, context: { params: Promise<Record<string, string>> }) => {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const tree = await prisma.atlasTree.findUnique({ where: { id } });

  if (!tree || tree.userId !== user.id) {
    return error('Atlas tree not found', 404);
  }

  return success(tree);
});

export const PATCH = withErrorHandler(async (request: Request, context: { params: Promise<Record<string, string>> }) => {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const body = UpdateAtlasTreeSchema.safeParse(await request.json());
  if (!body.success) {
    return error('Invalid request body', 400);
  }

  const existing = await prisma.atlasTree.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return error('Atlas tree not found', 404);
  }

  const updated = await prisma.atlasTree.update({
    where: { id },
    data: body.data,
  });

  return success(updated);
});

export const DELETE = withErrorHandler(async (request: Request, context: { params: Promise<Record<string, string>> }) => {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const existing = await prisma.atlasTree.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return error('Atlas tree not found', 404);
  }

  await prisma.atlasTree.delete({ where: { id } });

  return success({ deleted: true });
});

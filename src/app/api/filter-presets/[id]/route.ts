// ABOUTME: GET/PATCH/DELETE /api/filter-presets/:id — single filter preset CRUD operations.
// ABOUTME: All operations verify the preset belongs to the authenticated user.

import { z } from 'zod';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { success, error, withErrorHandler } from '@/lib/server/response';

const UpdateFilterPresetSchema = z.object({
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
}).partial();

export const GET = withErrorHandler(async (request: Request, context: { params: Promise<Record<string, string>> }) => {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const preset = await prisma.filterPreset.findUnique({ where: { id } });

  if (!preset || preset.userId !== user.id) {
    return error('Filter preset not found', 404);
  }

  return success(preset);
});

export const PATCH = withErrorHandler(async (request: Request, context: { params: Promise<Record<string, string>> }) => {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const body = UpdateFilterPresetSchema.safeParse(await request.json());
  if (!body.success) {
    return error('Invalid request body', 400);
  }

  const existing = await prisma.filterPreset.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return error('Filter preset not found', 404);
  }

  const updated = await prisma.filterPreset.update({
    where: { id },
    data: body.data,
  });

  return success(updated);
});

export const DELETE = withErrorHandler(async (request: Request, context: { params: Promise<Record<string, string>> }) => {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const existing = await prisma.filterPreset.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return error('Filter preset not found', 404);
  }

  await prisma.filterPreset.delete({ where: { id } });

  return success({ deleted: true });
});

// ABOUTME: GET, PATCH, and DELETE route handlers for a single regex filter by ID.
// ABOUTME: All endpoints require authentication and verify filter ownership.

import { z } from 'zod';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { success, error, withErrorHandler } from '@/lib/server/response';
import { validatePattern } from '@/lib/server/regex-validator';

const CATEGORY_VALUES = ['stat', 'modifier', 'attribute', 'custom'] as const;

const updateFilterSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  pattern: z.string().min(1).max(2000).optional(),
  isActive: z.boolean().optional(),
});

async function findOwnedFilter(userId: string, filterId: string) {
  return prisma.regexFilter.findFirst({
    where: { id: filterId, userId },
  });
}

export const GET = withErrorHandler(
  async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const user = await requireAuth(request);
    const { id } = await context.params;

    const filter = await findOwnedFilter(user.id, id);
    if (!filter) {
      return error('Regex filter not found', 404);
    }

    return success(filter);
  },
);

export const PATCH = withErrorHandler(
  async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const user = await requireAuth(request);
    const { id } = await context.params;

    const existing = await findOwnedFilter(user.id, id);
    if (!existing) {
      return error('Regex filter not found', 404);
    }

    const body: unknown = await request.json();
    const parsed = updateFilterSchema.safeParse(body);

    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      return error(messages, 400);
    }

    const updates = parsed.data;

    if (updates.pattern !== undefined) {
      const validation = validatePattern(updates.pattern);
      if (!validation.valid) {
        return error(`Invalid regex pattern: ${validation.error}`, 400);
      }
    }

    const updated = await prisma.regexFilter.update({
      where: { id },
      data: updates,
    });

    return success(updated);
  },
);

export const DELETE = withErrorHandler(
  async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const user = await requireAuth(request);
    const { id } = await context.params;

    const existing = await findOwnedFilter(user.id, id);
    if (!existing) {
      return error('Regex filter not found', 404);
    }

    await prisma.regexFilter.delete({ where: { id } });

    return success({ deleted: true });
  },
);

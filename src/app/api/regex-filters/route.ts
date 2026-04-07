// ABOUTME: GET (paginated list) and POST (create) route handlers for regex filters.
// ABOUTME: Both endpoints require authentication; POST validates the regex pattern before saving.

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { success, error, paginated, withErrorHandler } from '@/lib/server/response';
import { validatePattern } from '@/lib/server/regex-validator';

const CATEGORY_VALUES = ['stat', 'modifier', 'attribute', 'custom'] as const;

const createFilterSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.enum(CATEGORY_VALUES),
  pattern: z.string().min(1).max(2000),
});

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth(request);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const skip = (page - 1) * limit;

  const [filters, total] = await Promise.all([
    prisma.regexFilter.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.regexFilter.count({ where: { userId: user.id } }),
  ]);

  return paginated(filters, total, page, limit);
});

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth(request);

  const body: unknown = await request.json();
  const parsed = createFilterSchema.safeParse(body);

  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
    return error(messages, 400);
  }

  const { name, description, category, pattern } = parsed.data;

  const validation = validatePattern(pattern);
  if (!validation.valid) {
    return error(`Invalid regex pattern: ${validation.error}`, 400);
  }

  const filter = await prisma.regexFilter.create({
    data: {
      name,
      description: description ?? null,
      category,
      pattern,
      userId: user.id,
    },
  });

  return success(filter, 201);
});

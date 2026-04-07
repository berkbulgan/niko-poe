// ABOUTME: GET/POST /api/strategies — list all strategies for the user, or create a new one.
// ABOUTME: Requires authentication. Auto-generates a share code on creation.

import { z } from 'zod';
import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { success, error, generateShareCode, withErrorHandler } from '@/lib/server/response';

const CreateStrategySchema = z.object({
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
});

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth(request);

  const strategies = await prisma.strategy.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return success(strategies);
});

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth(request);

  const body = CreateStrategySchema.safeParse(await request.json());
  if (!body.success) {
    return error('Invalid request body', 400);
  }

  const strategy = await prisma.strategy.create({
    data: {
      userId: user.id,
      name: body.data.name,
      config: body.data.config,
      shareCode: generateShareCode(),
    },
  });

  return success(strategy, 201);
});

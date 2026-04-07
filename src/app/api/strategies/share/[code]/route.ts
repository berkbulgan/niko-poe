// ABOUTME: GET /api/strategies/share/:code — public lookup of a strategy by share code.
// ABOUTME: No authentication required. Returns the strategy without sensitive user data.

import { prisma } from '@/lib/server/db';
import { success, error, withErrorHandler } from '@/lib/server/response';

export const GET = withErrorHandler(async (_request: Request, context: { params: Promise<Record<string, string>> }) => {
  const { code } = await context.params;

  const strategy = await prisma.strategy.findUnique({
    where: { shareCode: code },
    include: { user: { select: { id: true, username: true, displayName: true } } },
  });

  if (!strategy) {
    return error('Strategy not found', 404);
  }

  return success(strategy);
});

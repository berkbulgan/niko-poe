// ABOUTME: GET /api/atlas-trees/share/:code — public lookup of an atlas tree by share code.
// ABOUTME: No authentication required. Returns the atlas tree without sensitive user data.

import { prisma } from '@/lib/server/db';
import { success, error, withErrorHandler } from '@/lib/server/response';

export const GET = withErrorHandler(async (_request: Request, context: { params: Promise<Record<string, string>> }) => {
  const { code } = await context.params;

  const tree = await prisma.atlasTree.findUnique({
    where: { shareCode: code },
    include: { user: { select: { id: true, username: true, displayName: true } } },
  });

  if (!tree) {
    return error('Atlas tree not found', 404);
  }

  return success(tree);
});

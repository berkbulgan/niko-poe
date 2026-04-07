// ABOUTME: GET /api/filter-presets/share/:code — public lookup of a filter preset by share code.
// ABOUTME: No authentication required. Returns the preset without sensitive user data.

import { prisma } from '@/lib/server/db';
import { success, error, withErrorHandler } from '@/lib/server/response';

export const GET = withErrorHandler(async (_request: Request, context: { params: Promise<Record<string, string>> }) => {
  const { code } = await context.params;

  const preset = await prisma.filterPreset.findUnique({
    where: { shareCode: code },
    include: { user: { select: { id: true, username: true, displayName: true } } },
  });

  if (!preset) {
    return error('Filter preset not found', 404);
  }

  return success(preset);
});

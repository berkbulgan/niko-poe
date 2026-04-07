// ABOUTME: POST /api/filter-presets/import/:code — import a shared filter preset by its share code.
// ABOUTME: Creates a copy under the authenticated user with "(imported)" suffix in name.

import { prisma } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { success, error, generateShareCode, withErrorHandler } from '@/lib/server/response';

export const POST = withErrorHandler(async (request: Request, context: { params: Promise<Record<string, string>> }) => {
  const user = await requireAuth(request);
  const { code } = await context.params;

  const source = await prisma.filterPreset.findUnique({
    where: { shareCode: code },
  });

  if (!source) {
    return error('Filter preset not found', 404);
  }

  const imported = await prisma.filterPreset.create({
    data: {
      userId: user.id,
      name: `${source.name} (imported)`,
      config: source.config ?? {},
      shareCode: generateShareCode(),
    },
  });

  return success(imported, 201);
});

// ABOUTME: GET /api/auth/me — returns the authenticated user's profile.
// ABOUTME: Requires a valid JWT Bearer token in the Authorization header.

import { requireAuth } from '@/lib/server/auth';
import { success, withErrorHandler } from '@/lib/server/response';

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth(request);
  return success(user);
});

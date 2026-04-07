// ABOUTME: GET route handler returning the catalog of known PoE modifier regex patterns.
// ABOUTME: Public endpoint (no auth required) — used for quick filter creation UI.

import { success, withErrorHandler } from '@/lib/server/response';
import { getKnownMods } from '@/lib/server/regex-validator';

export const GET = withErrorHandler(async () => {
  const mods = getKnownMods();
  return success(mods);
});

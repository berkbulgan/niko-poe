// ABOUTME: POST route handler for testing a regex pattern against sample text.
// ABOUTME: Public endpoint (no auth required) — returns match results per line.

import { z } from 'zod';
import { success, error, withErrorHandler } from '@/lib/server/response';
import { testAgainstText } from '@/lib/server/regex-validator';

const testSchema = z.object({
  pattern: z.string().min(1).max(2000),
  text: z.string().min(1).max(10000),
});

export const POST = withErrorHandler(async (request: Request) => {
  const body: unknown = await request.json();
  const parsed = testSchema.safeParse(body);

  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
    return error(messages, 400);
  }

  const { pattern, text } = parsed.data;
  const result = testAgainstText(pattern, text);

  return success(result);
});

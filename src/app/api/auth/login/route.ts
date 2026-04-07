// ABOUTME: POST /api/auth/login — authenticates user with username/password, returns JWT token.
// ABOUTME: Validates credentials against bcrypt hash and signs a new JWT on success.

import { z } from 'zod';
import { prisma } from '@/lib/server/db';
import { signToken, comparePassword } from '@/lib/server/auth';
import { success, error, withErrorHandler } from '@/lib/server/response';

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const POST = withErrorHandler(async (request: Request) => {
  const body = LoginSchema.safeParse(await request.json());
  if (!body.success) {
    return error('Invalid request body', 400);
  }

  const { username, password } = body.data;

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, displayName: true, passwordHash: true },
  });

  if (!user) {
    return error('Invalid credentials', 401);
  }

  const passwordValid = await comparePassword(password, user.passwordHash);
  if (!passwordValid) {
    return error('Invalid credentials', 401);
  }

  const token = signToken(user.id, user.username);

  return success({
    token,
    user: { id: user.id, username: user.username, displayName: user.displayName },
  });
});

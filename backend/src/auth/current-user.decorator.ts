// ABOUTME: Parameter decorator that extracts the authenticated user from the request.
// Must be used with AuthGuard to ensure the user object is present on the request.

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserProfile => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as unknown as Record<string, unknown>)['user'] as UserProfile;
  },
);

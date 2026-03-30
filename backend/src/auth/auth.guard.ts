// ABOUTME: Custom CanActivate guard for JWT-based authentication.
// Extracts Bearer token from Authorization header and validates it via AuthService.

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '@/auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const user = await this.authService.validateToken(token);
    (request as unknown as Record<string, unknown>)['user'] = user;

    return true;
  }
}

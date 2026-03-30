// ABOUTME: Authentication controller handling login and user profile retrieval.
// Exposes POST /auth/login and GET /auth/me endpoints.

import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '@/auth/auth.service';
import { AuthGuard } from '@/auth/auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';
import { LoginDto } from '@/auth/dto/login.dto';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

interface LoginResult {
  token: string;
  user: UserProfile;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with username and password' })
  async login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  me(@CurrentUser() user: UserProfile): UserProfile {
    return user;
  }
}

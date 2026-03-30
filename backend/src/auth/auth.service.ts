// ABOUTME: Authentication service handling login, token generation, and validation.
// Uses Node.js crypto (HMAC-SHA256) for JWT signing instead of external JWT libraries.

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '@/auth/entities/user.entity';
import { LoginDto } from '@/auth/dto/login.dto';

interface JwtHeader {
  alg: string;
  typ: string;
}

interface JwtPayload {
  sub: string;
  username: string;
  exp: number;
  iat: number;
}

interface LoginResult {
  token: string;
  user: UserProfile;
}

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

function base64UrlEncode(input: string | Buffer): string {
  const base64 = Buffer.from(input).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = base64.length % 4;
  if (remainder === 2) {
    base64 += '==';
  } else if (remainder === 3) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'cadiro-dev-secret-change-in-production',
    );
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.userRepository.findOne({
      where: { username: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.signToken(user);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    };
  }

  async validateToken(token: string): Promise<UserProfile> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Malformed token');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const signatureInput = `${headerB64}.${payloadB64}`;
    const expectedSignature = this.createSignature(signatureInput);

    if (expectedSignature !== signatureB64) {
      throw new UnauthorizedException('Invalid token signature');
    }

    let payload: JwtPayload;
    try {
      payload = JSON.parse(base64UrlDecode(payloadB64)) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new UnauthorizedException('Token expired');
    }

    const user = await this.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    };
  }

  async findUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  private signToken(user: User): string {
    const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      exp: now + 86400, // 24 hours
      iat: now,
    };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${headerB64}.${payloadB64}`;
    const signature = this.createSignature(signatureInput);

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  private createSignature(input: string): string {
    const hmac = crypto.createHmac('sha256', this.jwtSecret);
    hmac.update(input);
    return base64UrlEncode(hmac.digest());
  }
}

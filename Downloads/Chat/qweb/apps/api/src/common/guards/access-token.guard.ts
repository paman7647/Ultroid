import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import Redis from 'ioredis';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 2,
  });

  constructor(private readonly jwt: JwtService) {}

  private extractToken(request: Request): string | null {
    const cookieToken = request.cookies?.access_token as string | undefined;
    if (cookieToken) return cookieToken;

    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length);

    return null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException('Missing access token');

    const payload = await this.jwt.verifyAsync(token, {
      secret: process.env.JWT_ACCESS_SECRET,
    });

    if (!payload?.jti) throw new UnauthorizedException('Invalid token');

    const revoked = await this.redis.get(`revoked:jti:${payload.jti}`);
    if (revoked) throw new UnauthorizedException('Token revoked');

    request.user = { id: payload.sub, role: payload.role, jti: payload.jti };
    return true;
  }
}

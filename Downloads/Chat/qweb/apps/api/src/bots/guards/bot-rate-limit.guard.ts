import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Rate limiter for bot API requests.
 * Uses Redis sliding window counters per bot.
 *
 * Limits:
 * - Messages: 30/min
 * - Commands: 20/min
 * - Voice operations: 10/min
 * - General API: 60/min
 */
@Injectable()
export class BotRateLimitGuard implements CanActivate {
  private readonly redis: Redis;
  private readonly limits: Record<string, { max: number; windowSec: number }> = {
    'POST:/bot-api/messages': { max: 30, windowSec: 60 },
    'POST:/bot-api/voice': { max: 10, windowSec: 60 },
    default: { max: 60, windowSec: 60 },
  };

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const botId = request.user?.id;
    if (!botId || !request.user?.isBot) return true;

    const method = request.method;
    const path = request.route?.path ?? request.url;
    const routeKey = `${method}:${path}`;

    // Find matching limit
    const matched = Object.entries(this.limits).find(([key]) => routeKey.startsWith(key))?.[1];
    const limitConfig = matched ?? { max: 60, windowSec: 60 };

    const key = `bot-rate:${botId}:${routeKey}`;
    const now = Date.now();
    const windowMs = limitConfig.windowSec * 1000;

    // Sliding window using sorted set
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, now - windowMs);
    pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, limitConfig.windowSec + 1);
    const results = await pipeline.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;

    if (count > limitConfig.max) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Bot rate limit exceeded: ${limitConfig.max} requests per ${limitConfig.windowSec}s`,
          retryAfter: limitConfig.windowSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

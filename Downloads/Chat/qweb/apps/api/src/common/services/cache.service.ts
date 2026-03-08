import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-backed cache for frequently accessed data — room memberships,
 * user profiles, room metadata. Reduces Prisma round-trips under load.
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis!: Redis;
  private readonly DEFAULT_TTL = 300; // 5 min

  onModuleInit() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      keyPrefix: 'cache:',
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set(key: string, value: unknown, ttl = this.DEFAULT_TTL): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const key of keys) {
        // Strip the keyPrefix since del uses it automatically
        pipeline.del(key.replace(/^cache:/, ''));
      }
      await pipeline.exec();
    }
  }

  // ---- Domain-specific helpers ----

  async getRoomMembers(roomId: string): Promise<string[] | null> {
    return this.get<string[]>(`room:${roomId}:members`);
  }

  async setRoomMembers(roomId: string, memberIds: string[]): Promise<void> {
    await this.set(`room:${roomId}:members`, memberIds, 120);
  }

  async invalidateRoomMembers(roomId: string): Promise<void> {
    await this.del(`room:${roomId}:members`);
  }

  async getUserProfile(userId: string): Promise<Record<string, unknown> | null> {
    return this.get<Record<string, unknown>>(`user:${userId}:profile`);
  }

  async setUserProfile(userId: string, profile: Record<string, unknown>): Promise<void> {
    await this.set(`user:${userId}:profile`, profile, 600);
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    await this.del(`user:${userId}:profile`);
  }
}

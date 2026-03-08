import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';

/**
 * Consistent-hash–based sharding service.
 *
 * Assigns users (and rooms) to logical shards so each API/worker instance
 * only handles a subset of traffic. Shard mapping is stored in Redis so all
 * nodes agree on placement.
 *
 * Shard count is configurable via SHARD_COUNT env (default 16).
 * Each shard can be mapped to a physical node via the shard registry.
 */
@Injectable()
export class ShardingService implements OnModuleInit {
  private readonly logger = new Logger(ShardingService.name);
  private readonly redis: Redis;
  private readonly shardCount: number;
  private readonly instanceId: string;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    this.shardCount = Number(process.env.SHARD_COUNT ?? 16);
    this.instanceId = process.env.INSTANCE_ID ?? `api-${process.pid}`;
  }

  async onModuleInit() {
    // Register this instance in the shard registry
    await this.redis.hset('shard:instances', this.instanceId, JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      shardCount: this.shardCount,
    }));
    await this.redis.expire('shard:instances', 300);
    this.logger.log(`Shard service initialized: instance=${this.instanceId} shards=${this.shardCount}`);
  }

  /**
   * Deterministic shard assignment using consistent hashing.
   * Same input always maps to same shard across all nodes.
   */
  getShardId(key: string): number {
    const hash = createHash('md5').update(key).digest();
    const num = hash.readUInt32BE(0);
    return num % this.shardCount;
  }

  /**
   * Get the shard for a user ID.
   */
  getUserShard(userId: string): number {
    return this.getShardId(`user:${userId}`);
  }

  /**
   * Get the shard for a room ID.
   */
  getRoomShard(roomId: string): number {
    return this.getShardId(`room:${roomId}`);
  }

  /**
   * Check if this instance should handle a given shard.
   * In single-instance mode, always returns true.
   * In multi-instance mode, uses modular assignment.
   */
  async isOwnedShard(shardId: number): Promise<boolean> {
    const instances = await this.redis.hkeys('shard:instances');
    if (instances.length <= 1) return true;

    const sorted = instances.sort();
    const myIndex = sorted.indexOf(this.instanceId);
    return shardId % sorted.length === myIndex;
  }

  /**
   * Get the Redis stream key for a shard's message processing.
   */
  getShardStreamKey(shardId: number): string {
    return `shard:${shardId}:messages`;
  }

  /**
   * Get shard distribution stats.
   */
  async getShardStats(): Promise<{ shardCount: number; instances: string[]; instanceId: string }> {
    const instances = await this.redis.hkeys('shard:instances');
    return {
      shardCount: this.shardCount,
      instances,
      instanceId: this.instanceId,
    };
  }
}

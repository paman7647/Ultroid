import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Tracks WebSocket connection counts across all API instances.
 * Uses Redis sorted sets for distributed connection tracking and
 * provides load balancing hints for sticky session routing.
 *
 * Each instance periodically reports its connection count,
 * enabling:
 * - Global connection count for monitoring
 * - Load-aware routing for new connections
 * - Graceful drain before shutdown
 */
@Injectable()
export class ConnectionManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private readonly redis: Redis;
  private readonly instanceId: string;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private localCount = 0;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    this.instanceId = process.env.INSTANCE_ID ?? `api-${process.pid}`;
  }

  async onModuleInit() {
    // Report connection count every 10 seconds
    this.heartbeatTimer = setInterval(() => this.reportCount(), 10_000);
    await this.reportCount();
    this.logger.log(`Connection manager started for instance=${this.instanceId}`);
  }

  async onModuleDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    // Remove self from registry
    await this.redis.zrem('ws:connections', this.instanceId);
    this.redis.disconnect();
  }

  /**
   * Increment local connection count (called on WebSocket connect).
   */
  increment(): void {
    this.localCount++;
  }

  /**
   * Decrement local connection count (called on WebSocket disconnect).
   */
  decrement(): void {
    this.localCount = Math.max(0, this.localCount - 1);
  }

  /**
   * Report current connection count to Redis.
   */
  private async reportCount(): Promise<void> {
    try {
      await this.redis.zadd('ws:connections', this.localCount.toString(), this.instanceId);
      await this.redis.hset('ws:instance:meta', this.instanceId, JSON.stringify({
        connections: this.localCount,
        updatedAt: Date.now(),
        pid: process.pid,
      }));
    } catch {
      // Non-critical — will retry on next heartbeat
    }
  }

  /**
   * Get total connections across all instances.
   */
  async getTotalConnections(): Promise<number> {
    const scores = await this.redis.zrangebyscore('ws:connections', '-inf', '+inf', 'WITHSCORES');
    let total = 0;
    for (let i = 1; i < scores.length; i += 2) {
      total += Number(scores[i]);
    }
    return total;
  }

  /**
   * Get connections per instance.
   */
  async getConnectionDistribution(): Promise<Array<{ instance: string; connections: number }>> {
    const scores = await this.redis.zrangebyscore('ws:connections', '-inf', '+inf', 'WITHSCORES');
    const result: Array<{ instance: string; connections: number }> = [];
    for (let i = 0; i < scores.length; i += 2) {
      const instance = scores[i];
      const connections = Number(scores[i + 1]);
      if (instance) {
        result.push({ instance, connections });
      }
    }
    return result;
  }

  /**
   * Get the instance with fewest connections (for load-aware routing).
   */
  async getLeastLoadedInstance(): Promise<string | null> {
    const result = await this.redis.zrangebyscore('ws:connections', '-inf', '+inf', 'LIMIT', '0', '1');
    return result[0] ?? null;
  }
}

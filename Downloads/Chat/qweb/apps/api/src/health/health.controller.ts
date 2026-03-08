import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConnectionManagerService } from '@/common/services/connection-manager.service';
import { ShardingService } from '@/common/services/sharding.service';
import { MessageQueueService } from '@/queue/message-queue.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionManager: ConnectionManagerService,
    private readonly shardingService: ShardingService,
    private readonly messageQueue: MessageQueueService,
  ) {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
  }

  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'api',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  @Get('ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }

  @Get('deps')
  async deps() {
    const [dbOk, redisOk, pythonOk] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis.ping().then(() => true).catch(() => false),
      fetch(`${process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000'}/health`, {
        signal: AbortSignal.timeout(3000),
      }).then((r) => r.ok).catch(() => false),
    ]);

    return {
      db: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
      python: pythonOk ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  async metrics() {
    const [totalConnections, connectionDist, shardStats, queueStats] = await Promise.all([
      this.connectionManager.getTotalConnections(),
      this.connectionManager.getConnectionDistribution(),
      this.shardingService.getShardStats(),
      this.messageQueue.getAllQueueStats(),
    ]);

    return {
      connections: {
        total: totalConnections,
        distribution: connectionDist,
      },
      sharding: shardStats,
      queues: queueStats,
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

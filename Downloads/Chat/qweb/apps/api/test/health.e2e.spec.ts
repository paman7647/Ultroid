import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from '../src/health/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConnectionManagerService } from '../src/common/services/connection-manager.service';
import { ShardingService } from '../src/common/services/sharding.service';
import { MessageQueueService } from '../src/queue/message-queue.service';

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn(),
  on: jest.fn(),
})));

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue(1) } },
        { provide: ConnectionManagerService, useValue: { getConnectionCount: jest.fn().mockReturnValue(0), getDistribution: jest.fn().mockResolvedValue({}) } },
        { provide: ShardingService, useValue: { getStats: jest.fn().mockReturnValue({}) } },
        { provide: MessageQueueService, useValue: { getQueueStats: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/v1/health/live (GET)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health/live').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api');
  });
});

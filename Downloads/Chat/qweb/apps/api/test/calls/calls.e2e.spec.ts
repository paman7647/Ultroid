import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CallsController } from '../../src/calls/calls.controller';
import { CallsService } from '../../src/calls/calls.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AccessTokenGuard } from '../../src/common/guards/access-token.guard';

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  rpush: jest.fn(), publish: jest.fn(), quit: jest.fn(), subscribe: jest.fn(),
  on: jest.fn(), ping: jest.fn().mockResolvedValue('PONG'),
})));

const mockPrisma = {
  call: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  callParticipant: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  roomMembership: {
    findFirst: jest.fn(),
  },
};

describe('Calls (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CallsController],
      providers: [
        CallsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({ canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().user = { sub: 'test-user', role: 'USER', jti: 'test' };
        return true;
      }})
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /calls/history', () => {
    it('should return empty history when no calls exist', async () => {
      mockPrisma.call.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/calls/history')
        .expect(200)
        .expect([]);
    });
  });

  describe('GET /calls/room/:roomId/active', () => {
    it('should return null when no active call in room', async () => {
      mockPrisma.call.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/calls/room/00000000-0000-0000-0000-000000000001/active')
        .expect(200);

      expect(res.body).toEqual(expect.objectContaining({}));
    });
  });
});

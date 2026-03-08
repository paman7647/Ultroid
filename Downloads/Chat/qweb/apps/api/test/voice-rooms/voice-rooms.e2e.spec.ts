import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { VoiceRoomsController } from '../../src/voice-rooms/voice-rooms.controller';
import { VoiceRoomsService } from '../../src/voice-rooms/voice-rooms.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AccessTokenGuard } from '../../src/common/guards/access-token.guard';

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  rpush: jest.fn(), publish: jest.fn(), quit: jest.fn(), subscribe: jest.fn(),
  on: jest.fn(), ping: jest.fn().mockResolvedValue('PONG'),
  hset: jest.fn(), hdel: jest.fn(), hgetall: jest.fn().mockResolvedValue({}),
  xadd: jest.fn(), xlen: jest.fn().mockResolvedValue(0),
})));

const mockPrisma = {
  voiceRoom: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  voiceRoomMember: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  roomMembership: {
    findFirst: jest.fn(),
  },
};

describe('Voice Rooms (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VoiceRoomsController],
      providers: [
        VoiceRoomsService,
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

  describe('GET /voice-rooms', () => {
    it('should return voice rooms for a room', async () => {
      const rooms = [
        { id: 'vr-1', name: 'General', type: 'OPEN', maxParticipants: 25, _count: { members: 2 } },
      ];
      mockPrisma.voiceRoom.findMany.mockResolvedValue(rooms);

      const res = await request(app.getHttpServer())
        .get('/voice-rooms?roomId=room-1')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('General');
    });
  });

  describe('GET /voice-rooms/:id', () => {
    it('should return 404 for non-existent voice room', async () => {
      mockPrisma.voiceRoom.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/voice-rooms/00000000-0000-0000-0000-000000000099')
        .expect(404);
    });
  });
});

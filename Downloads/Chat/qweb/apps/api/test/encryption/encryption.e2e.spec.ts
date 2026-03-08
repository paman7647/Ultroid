import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EncryptionController } from '../../src/encryption/encryption.controller';
import { EncryptionService } from '../../src/encryption/encryption.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AccessTokenGuard } from '../../src/common/guards/access-token.guard';

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  rpush: jest.fn(), publish: jest.fn(), quit: jest.fn(), subscribe: jest.fn(),
  on: jest.fn(), ping: jest.fn().mockResolvedValue('PONG'),
})));

const mockPrisma = {
  encryptionKey: {
    upsert: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  encryptionSession: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
  },
};

describe('Encryption (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EncryptionController],
      providers: [
        EncryptionService,
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

  describe('GET /encryption/keys/prekey-count', () => {
    it('should return count of available pre-keys', async () => {
      mockPrisma.encryptionKey.count.mockResolvedValue(42);

      const res = await request(app.getHttpServer())
        .get('/encryption/keys/prekey-count')
        .expect(200);

      expect(res.body).toEqual({ count: 42 });
    });
  });

  describe('GET /encryption/keys/:userId/devices', () => {
    it('should return device keys for a user', async () => {
      const keys = [
        {
          id: 'k1',
          algorithm: 'X25519',
          publicKey: 'abc123',
          isIdentity: true,
          createdAt: new Date(),
          device: { id: 'dev-1', name: 'Phone', platform: 'iOS', lastSeenAt: new Date() },
        },
      ];
      mockPrisma.encryptionKey.findMany.mockResolvedValue(keys);

      const res = await request(app.getHttpServer())
        .get('/encryption/keys/00000000-0000-0000-0000-000000000001/devices')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].keyId).toBe('k1');
    });
  });
});

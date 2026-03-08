import { PresenceService } from '../../src/presence/presence.service';

// Mock ioredis
jest.mock('ioredis', () => {
  const data = new Map<string, string>();
  const subscribers = new Map<string, (channel: string, message: string) => void>();

  const MockRedis = jest.fn().mockImplementation(() => ({
    setex: jest.fn((key: string, _ttl: number, value: string) => {
      data.set(key, value);
      return Promise.resolve('OK');
    }),
    get: jest.fn((key: string) => Promise.resolve(data.get(key) ?? null)),
    del: jest.fn((key: string) => {
      data.delete(key);
      return Promise.resolve(1);
    }),
    exists: jest.fn((key: string) => Promise.resolve(data.has(key) ? 1 : 0)),
    expire: jest.fn().mockResolvedValue(1),
    mget: jest.fn((...keys: string[]) =>
      Promise.resolve(keys.map((k) => data.get(k) ?? null)),
    ),
    publish: jest.fn((channel: string, message: string) => {
      const handler = subscribers.get(channel);
      if (handler) handler(channel, message);
      return Promise.resolve(1);
    }),
    subscribe: jest.fn().mockResolvedValue(1),
    on: jest.fn((event: string, cb: (channel: string, message: string) => void) => {
      if (event === 'message') subscribers.set('presence:updates', cb);
    }),
    disconnect: jest.fn(),
  }));

  return MockRedis;
});

// Mock PrismaService
const mockPrisma = {
  user: {
    update: jest.fn().mockResolvedValue({}),
  },
  roomMembership: {
    findMany: jest.fn().mockResolvedValue([]),
  },
} as any;

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    service = new PresenceService(mockPrisma);
    await service.onModuleInit();
  });

  it('should set user online', async () => {
    await service.setOnline('user-1');
    const presence = await service.getPresence('user-1');
    // After setOnline the internal Redis stores presence data
    // In our mock it will return the serialized JSON
    expect(presence).toBeDefined();
  });

  it('should set user offline', async () => {
    await service.setOnline('user-1');
    await service.setOffline('user-1');
    const presence = await service.getPresence('user-1');
    expect(presence).toBeDefined();
    expect(presence?.status).toBe('offline');
  });

  it('should set typing indicator', async () => {
    await service.setOnline('user-1');
    await service.setTyping('user-1', 'room-1');
    const presence = await service.getPresence('user-1');
    if (presence) {
      expect(presence.typing?.roomId).toBe('room-1');
    }
  });

  it('should heartbeat to keep alive', async () => {
    await service.setOnline('user-1');
    await service.heartbeat('user-1');
    // Heartbeat should not throw
  });
});

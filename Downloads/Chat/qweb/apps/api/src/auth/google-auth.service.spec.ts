import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthService } from './google-auth.service';

// Mock ioredis
const redisMock = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
};
jest.mock('ioredis', () => jest.fn(() => redisMock));

// Mock google-auth-library
const mockGetToken = jest.fn();
const mockVerifyIdToken = jest.fn();
const mockGenerateAuthUrl = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    getToken: mockGetToken,
    verifyIdToken: mockVerifyIdToken,
    generateAuthUrl: mockGenerateAuthUrl,
  })),
}));

function buildConfigService(
  overrides: Record<string, string | undefined> = {},
): ConfigService {
  const defaults: Record<string, string | undefined> = {
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:4000/v1/auth/google/callback',
    REDIS_URL: 'redis://localhost:6379',
  };
  return {
    get: jest.fn((key: string) =>
      key in overrides ? overrides[key] : defaults[key],
    ),
  } as unknown as ConfigService;
}

function buildPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    device: { create: jest.fn().mockResolvedValue({ id: 'device-1' }) },
    session: { create: jest.fn().mockResolvedValue({ id: 'session-1' }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
}

function buildAuthService() {
  return {
    createTokens: jest.fn().mockResolvedValue({
      accessToken: 'at-123',
      refreshToken: 'rt-456',
    }),
    tokenHash: jest.fn((input: string) => `hash_${input.slice(0, 10)}`),
  } as any;
}

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let prisma: ReturnType<typeof buildPrisma>;
  let authService: ReturnType<typeof buildAuthService>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrisma();
    authService = buildAuthService();
    const config = buildConfigService();
    service = new GoogleAuthService(prisma, authService, config);
  });

  describe('constructor', () => {
    it('throws when Google OAuth is not configured', () => {
      const config = buildConfigService({
        GOOGLE_CLIENT_ID: undefined,
        GOOGLE_CLIENT_SECRET: undefined,
      });
      const svc = new GoogleAuthService(prisma, authService, config);

      expect(() => (svc as any).assertConfigured()).toThrow(BadRequestException);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('returns a URL and stores state in Redis', async () => {
      mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?...');

      const result = await service.getAuthorizationUrl();

      expect(result.url).toContain('https://accounts.google.com');
      expect(result.state).toBeDefined();
      expect(result.state.length).toBe(64); // 32 bytes hex
      expect(redisMock.setex).toHaveBeenCalledWith(
        expect.stringContaining('google_oauth_state:'),
        600,
        '1',
      );
    });
  });

  describe('handleCallback', () => {
    const metadata = { ip: '127.0.0.1', userAgent: 'TestBrowser/1.0' };

    beforeEach(() => {
      redisMock.get.mockResolvedValue('1');
      mockGetToken.mockResolvedValue({
        tokens: { id_token: 'mock-id-token' },
      });
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-123',
          email: 'user@example.com',
          email_verified: true,
          name: 'Test User',
          picture: 'https://lh3.googleusercontent.com/photo.jpg',
        }),
      });
    });

    it('rejects invalid state parameter', async () => {
      redisMock.get.mockResolvedValue(null);

      await expect(
        service.handleCallback('code', 'bad-state', metadata),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('creates a new user on first Google login', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no googleId match, no email match
      prisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        role: 'MEMBER',
        email: 'user@example.com',
        username: 'user',
        displayName: 'Test User',
      });

      const result = await service.handleCallback('auth-code', 'valid-state', metadata);

      expect(result.isNewUser).toBe(true);
      expect(result.user.email).toBe('user@example.com');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            googleId: 'google-sub-123',
            authProvider: 'google',
            email: 'user@example.com',
          }),
        }),
      );
      expect(redisMock.del).toHaveBeenCalled();
    });

    it('links Google to existing email-based account', async () => {
      // First findUnique (googleId) → null
      // Second findUnique (email) → existing user
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // no googleId match
        .mockResolvedValueOnce({
          id: 'existing-id',
          role: 'MEMBER',
          email: 'user@example.com',
          username: 'existinguser',
          displayName: 'Existing User',
          googleId: null,
        });

      prisma.user.update.mockResolvedValue({
        id: 'existing-id',
        role: 'MEMBER',
        email: 'user@example.com',
        username: 'existinguser',
        displayName: 'Existing User',
      });

      const result = await service.handleCallback('auth-code', 'valid-state', metadata);

      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe('existing-id');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            googleId: 'google-sub-123',
          }),
        }),
      );
      // Should have GOOGLE_ACCOUNT_LINKED audit log
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'GOOGLE_ACCOUNT_LINKED',
          }),
        }),
      );
    });

    it('logs in existing Google user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'google-user-id',
        role: 'MEMBER',
        email: 'user@example.com',
        username: 'googleuser',
        displayName: 'Google User',
      });

      const result = await service.handleCallback('auth-code', 'valid-state', metadata);

      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe('google-user-id');
      // Should NOT create a new user
      expect(prisma.user.create).not.toHaveBeenCalled();
      // Should update lastSeenAt
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'google-user-id' },
          data: { lastSeenAt: expect.any(Date) },
        }),
      );
    });

    it('rejects unverified Google emails', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-123',
          email: 'user@example.com',
          email_verified: false,
          name: 'Test User',
        }),
      });

      await expect(
        service.handleCallback('auth-code', 'valid-state', metadata),
      ).rejects.toThrow('Google email not verified');
    });

    it('rejects failed code exchange', async () => {
      mockGetToken.mockRejectedValue(new Error('Invalid code'));

      await expect(
        service.handleCallback('bad-code', 'valid-state', metadata),
      ).rejects.toThrow('Failed to exchange authorization code');
    });

    it('rejects missing ID token', async () => {
      mockGetToken.mockResolvedValue({ tokens: {} });

      await expect(
        service.handleCallback('auth-code', 'valid-state', metadata),
      ).rejects.toThrow('No ID token received from Google');
    });
  });
});

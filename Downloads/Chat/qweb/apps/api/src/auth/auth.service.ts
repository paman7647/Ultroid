import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GlobalRole, Prisma } from '@prisma/client';
import { randomUUID, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { PrismaService } from '@/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface TokenPayload {
  sub: string;
  role: GlobalRole;
  jti: string;
}

@Injectable()
export class AuthService {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 2,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async signAccessToken(payload: TokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<number>('ACCESS_TOKEN_TTL') ?? 900,
    });
  }

  private async signRefreshToken(payload: TokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<number>('REFRESH_TOKEN_TTL') ?? 1209600,
    });
  }

  private async createTokens(user: { id: string; role: GlobalRole }, deviceId?: string | null) {
    const jti = randomUUID();
    const payload: TokenPayload = { sub: user.id, role: user.role, jti };

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(payload),
      this.signRefreshToken(payload),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        deviceId: deviceId ?? null,
        tokenHash: this.tokenHash(refreshToken),
        expiresAt: new Date(Date.now() + (this.config.get<number>('REFRESH_TOKEN_TTL') ?? 1209600) * 1000),
      },
    });

    return { accessToken, refreshToken, jti };
  }

  async register(dto: RegisterDto, metadata: { ip?: string; userAgent?: string }) {
    const email = dto.email.toLowerCase().trim();
    const username = dto.username.toLowerCase().trim();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    });

    if (existing) {
      throw new ForbiddenException('Account already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        displayName: dto.displayName.trim(),
        passwordHash,
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        role: true,
        email: true,
        username: true,
        displayName: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'AUTH_REGISTER',
        entityType: 'USER',
        entityId: user.id,
        severity: 'SECURITY',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    const device = await this.prisma.device.create({
      data: {
        userId: user.id,
        name: 'unknown-device',
        platform: metadata.userAgent?.slice(0, 120) ?? 'unknown',
        fingerprintHash: this.tokenHash(`${metadata.ip ?? ''}:${metadata.userAgent ?? ''}`),
      },
      select: { id: true },
    });

    const tokens = await this.createTokens({ id: user.id, role: user.role }, device.id);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto, metadata: { ip?: string; userAgent?: string }) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    const device = await this.prisma.device.create({
      data: {
        userId: user.id,
        name: 'browser-session',
        platform: metadata.userAgent?.slice(0, 120) ?? 'unknown',
        fingerprintHash: this.tokenHash(`${metadata.ip ?? ''}:${metadata.userAgent ?? ''}:${Date.now()}`),
      },
      select: { id: true },
    });

    const tokens = await this.createTokens({ id: user.id, role: user.role }, device.id);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'AUTH_LOGIN',
        entityType: 'SESSION',
        entityId: device.id,
        severity: 'SECURITY',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: TokenPayload;

    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.tokenHash(refreshToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, role: true, email: true, username: true, displayName: true },
        },
      },
    });

    if (!token || token.revokedAt || token.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.createTokens({ id: token.userId, role: token.user.role }, token.deviceId);

    return {
      user: token.user,
      ...tokens,
    };
  }

  async revokeRefreshToken(refreshToken: string) {
    const tokenHash = this.tokenHash(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async listDevices(userId: string) {
    const now = new Date();
    const devices = await this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      include: {
        _count: {
          select: {
            refreshTokens: {
              where: {
                revokedAt: null,
                expiresAt: {
                  gt: now,
                },
              },
            },
          },
        },
      },
    });

    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      platform: device.platform,
      createdAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
      activeTokenCount: device._count.refreshTokens,
    }));
  }

  async revokeDevice(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        userId,
      },
      select: { id: true },
    });

    if (!device) throw new NotFoundException('Device not found');

    const revokedAt = new Date();
    const revoked = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        deviceId,
        revokedAt: null,
      },
      data: { revokedAt },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'AUTH_REVOKE_DEVICE',
        entityType: 'DEVICE',
        entityId: deviceId,
        severity: 'SECURITY',
      },
    });

    return { deviceId, revokedTokens: revoked.count };
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        revokedAt: true,
      },
      take: 100,
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      select: { id: true, status: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    if (session.status === 'REVOKED') {
      return { sessionId, status: 'REVOKED' as const };
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'AUTH_REVOKE_SESSION',
        entityType: 'SESSION',
        entityId: sessionId,
        severity: 'SECURITY',
      },
    });

    return { sessionId, status: 'REVOKED' as const };
  }

  async logoutAll(userId: string, currentJti?: string) {
    const revokedAt = new Date();
    const [sessionResult, tokenResult] = await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          revokedAt,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      }),
    ]);

    if (currentJti) {
      const ttl = Math.max(1, this.config.get<number>('ACCESS_TOKEN_TTL') ?? 900);
      await this.redis.setex(`revoked:jti:${currentJti}`, ttl, '1');
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'AUTH_LOGOUT_ALL',
        entityType: 'USER',
        entityId: userId,
        severity: 'SECURITY',
      },
    });

    return {
      sessionsRevoked: sessionResult.count,
      refreshTokensRevoked: tokenResult.count,
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        createdAt: true,
      },
    });
  }

  cookieOptions(maxAgeSeconds: number) {
    const isProd = (this.config.get<string>('NODE_ENV') ?? 'development') === 'production';
    const secureOverride = this.config.get<string>('COOKIE_SECURE');
    const secure = secureOverride !== undefined ? secureOverride === 'true' : isProd;

    return {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      maxAge: maxAgeSeconds * 1000,
      path: '/',
      domain: this.config.get<string>('COOKIE_DOMAIN'),
    };
  }

  // ─── Passkey (WebAuthn) Registration & Authentication ──────────────

  /**
   * Generate a passkey registration challenge.
   * The client uses this with navigator.credentials.create().
   */
  async generatePasskeyChallenge(userId: string) {
    const challenge = randomUUID() + ':' + Date.now();
    const challengeKey = `passkey:challenge:${userId}`;
    await this.redis.setex(challengeKey, 300, challenge); // 5 min TTL

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      challenge,
      rp: {
        name: 'QWeb Chat',
        id: this.config.get<string>('WEBAUTHN_RP_ID') ?? 'localhost',
      },
      user: {
        id: user.id,
        name: user.username,
        displayName: user.displayName,
      },
      pubKeyCredParams: [
        { type: 'public-key' as const, alg: -7 },   // ES256
        { type: 'public-key' as const, alg: -257 },  // RS256
      ],
      timeout: 60000,
      attestation: 'none' as const,
    };
  }

  /**
   * Store a passkey credential after client-side registration.
   */
  async registerPasskey(
    userId: string,
    credential: {
      credentialId: string;
      publicKey: string;
      algorithm: number;
      attestation?: string;
      deviceName?: string;
    },
  ) {
    // Verify challenge was issued
    const challengeKey = `passkey:challenge:${userId}`;
    const challenge = await this.redis.get(challengeKey);
    if (!challenge) throw new UnauthorizedException('No active challenge');
    await this.redis.del(challengeKey);

    // Store credential in device table with passkey metadata
    const device = await this.prisma.device.create({
      data: {
        userId,
        name: credential.deviceName ?? 'Passkey Device',
        platform: 'webauthn',
        fingerprintHash: createHash('sha256').update(credential.credentialId).digest('hex'),
      },
    });

    // Store passkey data in Redis (for production, use a dedicated table)
    await this.redis.hset(`passkey:credentials:${userId}`, credential.credentialId, JSON.stringify({
      publicKey: credential.publicKey,
      algorithm: credential.algorithm,
      deviceId: device.id,
      createdAt: new Date().toISOString(),
    }));

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'AUTH_PASSKEY_REGISTER',
        entityType: 'DEVICE',
        entityId: device.id,
        severity: 'SECURITY',
      },
    });

    return { deviceId: device.id, credentialId: credential.credentialId };
  }

  /**
   * Generate a passkey authentication challenge for login.
   */
  async generatePasskeyLoginChallenge(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const challenge = randomUUID() + ':' + Date.now();
    await this.redis.setex(`passkey:login:${challenge}`, 300, user.id);

    // Get registered credential IDs
    const credentials = await this.redis.hkeys(`passkey:credentials:${user.id}`);

    return {
      challenge,
      allowCredentials: credentials.map((id) => ({
        type: 'public-key' as const,
        id,
      })),
      timeout: 60000,
      rpId: this.config.get<string>('WEBAUTHN_RP_ID') ?? 'localhost',
    };
  }

  /**
   * Verify a passkey authentication response.
   */
  async verifyPasskeyLogin(
    challenge: string,
    credentialId: string,
    metadata: { ip?: string; userAgent?: string },
  ) {
    const userId = await this.redis.get(`passkey:login:${challenge}`);
    if (!userId) throw new UnauthorizedException('Invalid or expired challenge');
    await this.redis.del(`passkey:login:${challenge}`);

    // Verify the credential exists for this user
    const credData = await this.redis.hget(`passkey:credentials:${userId}`, credentialId);
    if (!credData) throw new UnauthorizedException('Unknown credential');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true, username: true, displayName: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const cred = JSON.parse(credData);
    const tokens = await this.createTokens({ id: user.id, role: user.role }, cred.deviceId);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'AUTH_PASSKEY_LOGIN',
        entityType: 'SESSION',
        entityId: cred.deviceId,
        severity: 'SECURITY',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    return { user, ...tokens };
  }

  // ─── QR Code Login ────────────────────────────────────────────────

  /**
   * Generate a QR login token. The desktop/web client displays this as a QR code.
   * The mobile app scans it and confirms the login.
   */
  async generateQrLoginToken() {
    const token = randomUUID();
    await this.redis.setex(`qr:login:${token}`, 300, JSON.stringify({ status: 'pending' }));
    return { token, expiresIn: 300 };
  }

  /**
   * Check the status of a QR login token (polled by web client).
   */
  async checkQrLoginStatus(token: string) {
    const data = await this.redis.get(`qr:login:${token}`);
    if (!data) return { status: 'expired' };

    const parsed = JSON.parse(data);
    if (parsed.status === 'confirmed' && parsed.userId) {
      // Delete the token after use
      await this.redis.del(`qr:login:${token}`);

      const user = await this.prisma.user.findUnique({
        where: { id: parsed.userId },
        select: { id: true, role: true, email: true, username: true, displayName: true },
      });

      if (!user) return { status: 'expired' };

      const tokens = await this.createTokens({ id: user.id, role: user.role });
      await this.prisma.session.create({
        data: { userId: user.id, ip: parsed.ip, userAgent: parsed.userAgent },
      });

      return { status: 'confirmed', user, ...tokens };
    }

    return { status: parsed.status };
  }

  /**
   * Confirm a QR login from the mobile app (authenticated endpoint).
   */
  async confirmQrLogin(userId: string, token: string, metadata: { ip?: string; userAgent?: string }) {
    const data = await this.redis.get(`qr:login:${token}`);
    if (!data) throw new NotFoundException('QR token expired');

    const parsed = JSON.parse(data);
    if (parsed.status !== 'pending') throw new ForbiddenException('QR token already used');

    await this.redis.setex(`qr:login:${token}`, 60, JSON.stringify({
      status: 'confirmed',
      userId,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
    }));

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'AUTH_QR_LOGIN_CONFIRM',
        entityType: 'SESSION',
        entityId: token,
        severity: 'SECURITY',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    return { status: 'confirmed' };
  }

  // ─── Enhanced Device Management ───────────────────────────────────

  /**
   * Rename a device.
   */
  async renameDevice(userId: string, deviceId: string, name: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) throw new NotFoundException('Device not found');

    return this.prisma.device.update({
      where: { id: deviceId },
      data: { name },
      select: { id: true, name: true, platform: true, createdAt: true, lastSeenAt: true },
    });
  }

  /**
   * Verify a device by confirming from another active session.
   */
  async verifyDevice(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) throw new NotFoundException('Device not found');

    // Mark device as verified using the lastSeenAt timestamp
    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
      select: { id: true, name: true, platform: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'AUTH_DEVICE_VERIFY',
        entityType: 'DEVICE',
        entityId: deviceId,
        severity: 'SECURITY',
      },
    });

    return { ...updated, verified: true };
  }

  /**
   * Revoke all sessions except the current one.
   */
  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const revokedAt = new Date();
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        id: { not: currentSessionId },
      },
      data: {
        status: 'REVOKED',
        revokedAt,
      },
    });

    return { sessionsRevoked: result.count };
  }
}

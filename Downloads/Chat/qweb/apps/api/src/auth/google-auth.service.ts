import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthService } from './auth.service';

interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly oauthClient: OAuth2Client | null;
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI');

    this.oauthClient = clientId && clientSecret
      ? new OAuth2Client(clientId, clientSecret, redirectUri)
      : null;

    this.redis = new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      { maxRetriesPerRequest: 2 },
    );
  }

  private assertConfigured(): void {
    if (!this.oauthClient) {
      throw new BadRequestException('Google OAuth is not configured');
    }
  }

  /**
   * Generate the Google authorization URL with a CSRF state parameter.
   */
  async getAuthorizationUrl(): Promise<{ url: string; state: string }> {
    this.assertConfigured();

    const state = randomBytes(32).toString('hex');
    await this.redis.setex(`google_oauth_state:${state}`, 600, '1');

    const url = this.oauthClient!.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });

    return { url, state };
  }

  /**
   * Exchange authorization code for tokens, verify the ID token,
   * and return user info.
   */
  async handleCallback(
    code: string,
    state: string,
    metadata: { ip?: string; userAgent?: string },
  ) {
    this.assertConfigured();

    // Verify state parameter (CSRF protection)
    const stateValid = await this.redis.get(`google_oauth_state:${state}`);
    if (!stateValid) {
      throw new UnauthorizedException('Invalid or expired OAuth state parameter');
    }
    await this.redis.del(`google_oauth_state:${state}`);

    // Exchange code for tokens
    let tokens;
    try {
      const result = await this.oauthClient!.getToken(code);
      tokens = result.tokens;
    } catch {
      throw new UnauthorizedException('Failed to exchange authorization code');
    }

    if (!tokens.id_token) {
      throw new UnauthorizedException('No ID token received from Google');
    }

    // Verify the ID token
    const userInfo = await this.verifyIdToken(tokens.id_token);

    // Find or create user, generate session tokens
    const result = await this.findOrCreateUser(userInfo, metadata);

    this.logger.log(
      `Google auth ${result.isNewUser ? 'signup' : 'login'} for ${userInfo.email}`,
    );

    return result;
  }

  /**
   * Verify a Google ID token and extract user information.
   */
  private async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    this.assertConfigured();

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')!;

    let ticket;
    try {
      ticket = await this.oauthClient!.verifyIdToken({
        idToken,
        audience: clientId,
      });
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException('Google email not verified');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase().trim(),
      name: payload.name ?? payload.email?.split('@')[0] ?? 'User',
      picture: payload.picture,
    };
  }

  /**
   * Find existing user by googleId or email, or create a new one.
   * Handles account linking (existing email user signs in with Google).
   */
  private async findOrCreateUser(
    info: GoogleUserInfo,
    metadata: { ip?: string; userAgent?: string },
  ) {
    // 1. Try to find by Google ID first (returning user)
    let user = await this.prisma.user.findUnique({
      where: { googleId: info.googleId },
      select: { id: true, role: true, email: true, username: true, displayName: true },
    });

    let isNewUser = false;

    if (!user) {
      // 2. Try to find by email (account linking)
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: info.email },
        select: { id: true, role: true, email: true, username: true, displayName: true, googleId: true },
      });

      if (existingByEmail) {
        // Link Google account to existing email-based account
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: info.googleId,
            authProvider: existingByEmail.googleId ? undefined : 'google',
            avatarUrl: info.picture ?? undefined,
            lastSeenAt: new Date(),
          },
          select: { id: true, role: true, email: true, username: true, displayName: true },
        });

        await this.prisma.auditLog.create({
          data: {
            actorUserId: user.id,
            action: 'GOOGLE_ACCOUNT_LINKED',
            entityType: 'USER',
            entityId: user.id,
            severity: 'SECURITY',
            ip: metadata.ip,
            userAgent: metadata.userAgent,
          },
        });
      } else {
        // 3. Create new user
        const username = await this.generateUniqueUsername(info.email);

        user = await this.prisma.user.create({
          data: {
            email: info.email,
            username,
            displayName: info.name,
            passwordHash: '', // No password for Google-only users
            avatarUrl: info.picture,
            googleId: info.googleId,
            authProvider: 'google',
            lastSeenAt: new Date(),
          },
          select: { id: true, role: true, email: true, username: true, displayName: true },
        });

        isNewUser = true;

        await this.prisma.auditLog.create({
          data: {
            actorUserId: user.id,
            action: 'GOOGLE_SIGNUP',
            entityType: 'USER',
            entityId: user.id,
            severity: 'SECURITY',
            ip: metadata.ip,
            userAgent: metadata.userAgent,
          },
        });
      }
    } else {
      // Update last seen for returning Google user
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      });
    }

    // Create device + tokens + session (reuse AuthService internals)
    const device = await this.prisma.device.create({
      data: {
        userId: user.id,
        name: 'google-login',
        platform: metadata.userAgent?.slice(0, 120) ?? 'unknown',
        fingerprintHash: this.authService['tokenHash'](
          `${metadata.ip ?? ''}:${metadata.userAgent ?? ''}:${Date.now()}`,
        ),
      },
      select: { id: true },
    });

    const tokens = await this.authService['createTokens'](
      { id: user.id, role: user.role },
      device.id,
    );

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
        action: isNewUser ? 'GOOGLE_SIGNUP_SUCCESS' : 'GOOGLE_LOGIN_SUCCESS',
        entityType: 'SESSION',
        entityId: device.id,
        severity: 'SECURITY',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });

    return { user, ...tokens, isNewUser };
  }

  /**
   * Generate a unique username from the email address.
   */
  private async generateUniqueUsername(email: string): Promise<string> {
    const base = (email.split('@')[0] ?? 'user')
      .replace(/[^a-zA-Z0-9_.-]/g, '')
      .slice(0, 28)
      .toLowerCase();

    const candidate = base.length >= 3 ? base : `user_${base}`;

    const existing = await this.prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!existing) return candidate;

    // Append random suffix
    const suffix = randomBytes(3).toString('hex');
    return `${candidate.slice(0, 25)}_${suffix}`;
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie('access_token', result.accessToken, this.authService.cookieOptions(900));
    res.cookie('refresh_token', result.refreshToken, this.authService.cookieOptions(1209600));

    return { user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie('access_token', result.accessToken, this.authService.cookieOptions(900));
    res.cookie('refresh_token', result.refreshToken, this.authService.cookieOptions(1209600));

    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto.refreshToken ?? (req.cookies?.refresh_token as string | undefined);
    if (!refreshToken) {
      return { error: 'Missing refresh token' };
    }

    const result = await this.authService.refresh(refreshToken);

    res.cookie('access_token', result.accessToken, this.authService.cookieOptions(900));
    res.cookie('refresh_token', result.refreshToken, this.authService.cookieOptions(1209600));

    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    res.clearCookie('access_token', this.authService.cookieOptions(0));
    res.clearCookie('refresh_token', this.authService.cookieOptions(0));

    return { ok: true };
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@CurrentUser() user: RequestUser) {
    return this.authService.getProfile(user.id);
  }

  // ─── Device Management ──────────────────────────────────────────

  @Get('devices')
  @UseGuards(AccessTokenGuard)
  async listDevices(@CurrentUser() user: RequestUser) {
    return this.authService.listDevices(user.id);
  }

  @Delete('devices/:deviceId')
  @UseGuards(AccessTokenGuard)
  @HttpCode(200)
  async revokeDevice(@CurrentUser() user: RequestUser, @Param('deviceId') deviceId: string) {
    return this.authService.revokeDevice(user.id, deviceId);
  }

  @Put('devices/:deviceId/name')
  @UseGuards(AccessTokenGuard)
  async renameDevice(
    @CurrentUser() user: RequestUser,
    @Param('deviceId') deviceId: string,
    @Body() body: { name: string },
  ) {
    return this.authService.renameDevice(user.id, deviceId, body.name);
  }

  @Post('devices/:deviceId/verify')
  @UseGuards(AccessTokenGuard)
  @HttpCode(200)
  async verifyDevice(@CurrentUser() user: RequestUser, @Param('deviceId') deviceId: string) {
    return this.authService.verifyDevice(user.id, deviceId);
  }

  // ─── Session Management ──────────────────────────────────────────

  @Get('sessions')
  @UseGuards(AccessTokenGuard)
  async listSessions(@CurrentUser() user: RequestUser) {
    return this.authService.listSessions(user.id);
  }

  @Post('sessions/:sessionId/revoke')
  @UseGuards(AccessTokenGuard)
  @HttpCode(200)
  async revokeSession(@CurrentUser() user: RequestUser, @Param('sessionId') sessionId: string) {
    return this.authService.revokeSession(user.id, sessionId);
  }

  @Post('logout-all')
  @UseGuards(AccessTokenGuard)
  @HttpCode(200)
  async logoutAll(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logoutAll(user.id);
    res.clearCookie('access_token', this.authService.cookieOptions(0));
    res.clearCookie('refresh_token', this.authService.cookieOptions(0));
    return result;
  }

  // ─── Passkey (WebAuthn) ──────────────────────────────────────────

  @Post('passkey/challenge')
  @UseGuards(AccessTokenGuard)
  @HttpCode(200)
  async passkeyChallenge(@CurrentUser() user: RequestUser) {
    return this.authService.generatePasskeyChallenge(user.id);
  }

  @Post('passkey/register')
  @UseGuards(AccessTokenGuard)
  @HttpCode(201)
  async passkeyRegister(
    @CurrentUser() user: RequestUser,
    @Body() body: {
      credentialId: string;
      publicKey: string;
      algorithm: number;
      attestation?: string;
      deviceName?: string;
    },
  ) {
    return this.authService.registerPasskey(user.id, body);
  }

  @Post('passkey/login/challenge')
  @HttpCode(200)
  async passkeyLoginChallenge(@Body() body: { email: string }) {
    return this.authService.generatePasskeyLoginChallenge(body.email);
  }

  @Post('passkey/login/verify')
  @HttpCode(200)
  async passkeyLoginVerify(
    @Body() body: { challenge: string; credentialId: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyPasskeyLogin(body.challenge, body.credentialId, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.cookie('access_token', result.accessToken, this.authService.cookieOptions(900));
    res.cookie('refresh_token', result.refreshToken, this.authService.cookieOptions(1209600));
    return { user: result.user };
  }

  // ─── QR Code Login ──────────────────────────────────────────────

  @Post('qr/generate')
  @HttpCode(200)
  async qrGenerate() {
    return this.authService.generateQrLoginToken();
  }

  @Get('qr/status/:token')
  async qrStatus(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.checkQrLoginStatus(token);
    if (result.status === 'confirmed' && 'accessToken' in result) {
      res.cookie('access_token', (result as any).accessToken, this.authService.cookieOptions(900));
      res.cookie('refresh_token', (result as any).refreshToken, this.authService.cookieOptions(1209600));
    }
    return result;
  }

  @Post('qr/confirm')
  @UseGuards(AccessTokenGuard)
  @HttpCode(200)
  async qrConfirm(
    @CurrentUser() user: RequestUser,
    @Body() body: { token: string },
    @Req() req: Request,
  ) {
    return this.authService.confirmQrLogin(user.id, body.token, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ─── Google OAuth ──────────────────────────────────────────────

  @Get('google')
  async googleAuth(@Res() res: Response) {
    const { url, state } = await this.googleAuthService.getAuthorizationUrl();
    res.cookie('google_oauth_state', state, {
      httpOnly: true,
      secure: (this.authService as any).config?.get?.('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/',
    });
    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/login?error=missing_params`);
    }

    try {
      const result = await this.googleAuthService.handleCallback(code, state, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.cookie('access_token', result.accessToken, this.authService.cookieOptions(900));
      res.cookie('refresh_token', result.refreshToken, this.authService.cookieOptions(1209600));
      res.clearCookie('google_oauth_state');

      return res.redirect(`${frontendUrl}/chat`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'google_auth_failed';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(message)}`);
    }
  }
}

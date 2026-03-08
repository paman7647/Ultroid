import { randomBytes, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = new Set([
  '/v1/health/live', '/v1/health/ready', '/v1/health/deps', '/v1/health/metrics',
  '/v1/auth/register', '/v1/auth/login', '/v1/auth/refresh', '/v1/auth/logout',
  '/v1/auth/passkey/login/challenge', '/v1/auth/passkey/login/verify',
  '/v1/auth/qr/generate', '/v1/auth/qr/check',
]);

function newToken(): string {
  return randomBytes(32).toString('hex');
}

function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export function csrfDoubleSubmitMiddleware(req: Request, res: Response, next: NextFunction) {
  const isProd = process.env.NODE_ENV === 'production';
  const existingToken = req.cookies?.csrf_token as string | undefined;

  // httpOnly: false is intentional — double-submit pattern requires JS to read the cookie
  if (!existingToken) {
    res.cookie('csrf_token', newToken(), {
      httpOnly: false,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const cookieToken = (req.cookies?.csrf_token as string | undefined) ?? '';
  const headerToken = (req.headers['x-csrf-token'] as string | undefined) ?? '';

  if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      code: 'CSRF_TOKEN_INVALID',
    });
  }

  return next();
}

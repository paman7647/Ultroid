import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('produces cookie options with secure=false in development', () => {
    const prisma = {} as any;
    const jwt = {} as JwtService;
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'COOKIE_DOMAIN') return 'localhost';
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new AuthService(prisma, jwt, config);
    const options = service.cookieOptions(900);

    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(false);
    expect(options.domain).toBe('localhost');
  });
});

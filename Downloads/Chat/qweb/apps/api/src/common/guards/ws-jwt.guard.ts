import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

export type AuthenticatedSocket = Socket & { user?: { sub: string; role: string; jti: string } };

function parseCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((p) => p.trim());
  const match = parts.find((p) => p.startsWith('access_token='));
  return match ? decodeURIComponent(match.slice('access_token='.length)) : null;
}

/** Extract JWT from socket handshake (auth field, cookie, or Authorization header). */
function extractToken(client: Socket): string | null {
  const authHeader = client.handshake.headers.authorization;
  const authToken = client.handshake.auth?.token as string | undefined;
  const cookieToken = parseCookieToken(client.handshake.headers.cookie);
  return authToken ?? cookieToken ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null);
}

/**
 * Authenticate a socket during handleConnection.
 * Sets client.user and returns the userId, or disconnects and returns null.
 */
export async function authenticateSocket(
  client: AuthenticatedSocket,
  jwt: JwtService,
): Promise<string | null> {
  const token = extractToken(client);
  if (!token) {
    client.emit('error', { message: 'UNAUTHENTICATED' });
    client.disconnect(true);
    return null;
  }
  try {
    const payload = await jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET });
    client.user = { sub: payload.sub, role: payload.role, jti: payload.jti };
    return payload.sub as string;
  } catch {
    client.emit('error', { message: 'UNAUTHENTICATED' });
    client.disconnect(true);
    return null;
  }
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();

    // If already authenticated in handleConnection, skip
    if (client.user?.sub) return true;

    const token = extractToken(client);
    if (!token) throw new WsException('UNAUTHENTICATED');

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      client.user = { sub: payload.sub, role: payload.role, jti: payload.jti };
      return true;
    } catch {
      throw new WsException('UNAUTHENTICATED');
    }
  }
}

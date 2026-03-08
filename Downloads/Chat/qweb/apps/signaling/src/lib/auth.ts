import { jwtVerify } from 'jose';

export interface UserClaims {
  sub: string;
  username?: string;
  role?: string;
}

export async function verifyToken(token: string, secret: string): Promise<UserClaims> {
  const key = new TextEncoder().encode(secret);
  const result = await jwtVerify(token, key);

  if (!result.payload?.sub || typeof result.payload.sub !== 'string') {
    throw new Error('Invalid token subject');
  }

  return {
    sub: result.payload.sub,
    username: typeof result.payload.username === 'string' ? result.payload.username : undefined,
    role: typeof result.payload.role === 'string' ? result.payload.role : undefined,
  };
}

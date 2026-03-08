import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { loadConfig } from './lib/config';
import { logger } from './lib/logger';
import { verifyToken } from './lib/auth';
import { TokenBucketLimiter } from './lib/rate-limiter';
import { PythonClient } from './lib/python-client';
import {
  answerSchema,
  encryptedMessageSchema,
  iceSchema,
  keyFetchSchema,
  keyPublishSchema,
  messageHistorySchema,
  offerSchema,
  roomCreateSchema,
  roomJoinSchema,
  typingSchema,
  callInitiateSchema,
  callResponseSchema,
  screenShareSchema,
} from './schemas/events';

const config = loadConfig(process.env);
const python = new PythonClient(config);

interface SocketData {
  userId: string;
  username?: string;
  limiter: TokenBucketLimiter;
  rooms: Set<string>;
}

type AuthedSocket = Socket<any, any, any, SocketData>;

function parseToken(socket: Socket): string | null {
  const authToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : null;
  if (authToken) return authToken;

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  return null;
}

function emitError(socket: AuthedSocket, code: string, message: string) {
  socket.emit('error:event', { code, message, at: new Date().toISOString() });
}

function withRateLimit(socket: AuthedSocket): boolean {
  if (!socket.data.limiter.allow()) {
    emitError(socket, 'RATE_LIMITED', 'Too many requests. Slow down.');
    return false;
  }
  return true;
}

function parsePayload<T>(schema: z.ZodType<T>, payload: unknown, socket: AuthedSocket): T | null {
  const result = schema.safeParse(payload);
  if (!result.success) {
    emitError(socket, 'INVALID_PAYLOAD', result.error.issues.map((issue) => issue.message).join(', '));
    return null;
  }

  return result.data;
}

function bindEvent(socket: AuthedSocket, event: string, handler: (payload: unknown) => Promise<void>) {
  socket.on(event, (payload: unknown) => {
    void handler(payload).catch((error: unknown) => {
      logger.warn({ error, event, userId: socket.data.userId }, 'Socket event failed');
      emitError(socket, 'EVENT_FAILED', 'Unable to process event.');
    });
  });
}

async function requireMembership(socket: AuthedSocket, roomId: string): Promise<boolean> {
  try {
    if (socket.data.rooms.has(roomId)) return true;

    const authorized = await python.authorizeRoom(roomId, socket.data.userId);
    if (!authorized) {
      emitError(socket, 'FORBIDDEN_ROOM', 'You are not a member of this room.');
      return false;
    }

    await socket.join(`room:${roomId}`);
    socket.data.rooms.add(roomId);
    return true;
  } catch (error) {
    logger.error({ error, roomId, userId: socket.data.userId }, 'Membership check failed');
    emitError(socket, 'AUTHZ_FAILED', 'Failed to verify room membership.');
    return false;
  }
}

export function createServer() {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '2mb' }));
  app.use(cors({ origin: config.SIGNALING_CORS_ORIGIN, credentials: true }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'signaling', ts: new Date().toISOString() });
  });

  app.get('/v1/ice-config', async (_req, res) => {
    try {
      const cfg = await python.getIceConfig();
      res.json(cfg);
    } catch (error) {
      logger.warn({ error }, 'Failed to fetch dynamic ICE config, returning env fallback');
      const urls = config.TURN_URLS ? config.TURN_URLS.split(',').map((v) => v.trim()) : [];
      res.json({
        ice_servers: urls.length
          ? [{ urls, username: config.TURN_USERNAME, credential: config.TURN_CREDENTIAL }]
          : [{ urls: ['stun:stun.l.google.com:19302'] }],
      });
    }
  });

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: config.SIGNALING_CORS_ORIGIN,
      credentials: true,
    },
    maxHttpBufferSize: 2 * 1024 * 1024,
  });

  io.use(async (socket, next) => {
    try {
      const token = parseToken(socket);
      if (!token) {
        return next(new Error('Unauthorized: missing token'));
      }

      const claims = await verifyToken(token, config.SIGNALING_JWT_SECRET);
      const authed = socket as AuthedSocket;
      authed.data.userId = claims.sub;
      authed.data.username = claims.username;
      authed.data.limiter = new TokenBucketLimiter(
        config.SOCKET_EVENT_RATE_LIMIT,
        config.SOCKET_EVENT_RATE_WINDOW_MS,
      );
      authed.data.rooms = new Set<string>();
      next();
    } catch (error) {
      logger.warn({ error }, 'Socket auth failed');
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const s = socket as AuthedSocket;
    const userChannel = `user:${s.data.userId}`;
    await s.join(userChannel);
    await python.setPresence(s.data.userId, 'online').catch(() => undefined);

    io.emit('presence:update', {
      userId: s.data.userId,
      status: 'online',
      at: new Date().toISOString(),
    });

    bindEvent(s, 'room:create', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(roomCreateSchema, payload, s);
      if (!parsed) return;

      if (!parsed.memberIds.includes(s.data.userId)) {
        parsed.memberIds.push(s.data.userId);
      }

      await python.createRoom(parsed.roomId, parsed.memberIds);
      await s.join(`room:${parsed.roomId}`);
      s.data.rooms.add(parsed.roomId);
      s.emit('room:created', { roomId: parsed.roomId, memberIds: parsed.memberIds });
    });

    bindEvent(s, 'room:join', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(roomJoinSchema, payload, s);
      if (!parsed) return;

      const ok = await requireMembership(s, parsed.roomId);
      if (!ok) return;

      s.emit('room:joined', { roomId: parsed.roomId });
    });

    bindEvent(s, 'room:members', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(roomJoinSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      const members = await python.listRoomMembers(parsed.roomId);
      s.emit('room:members', {
        roomId: members.room_id,
        memberIds: members.member_ids,
      });
    });

    bindEvent(s, 'webrtc:offer', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(offerSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      io.to(`user:${parsed.toUserId}`).emit('webrtc:offer', {
        ...parsed,
        fromUserId: s.data.userId,
      });
    });

    bindEvent(s, 'webrtc:answer', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(answerSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      io.to(`user:${parsed.toUserId}`).emit('webrtc:answer', {
        ...parsed,
        fromUserId: s.data.userId,
      });
    });

    bindEvent(s, 'webrtc:ice-candidate', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(iceSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      io.to(`user:${parsed.toUserId}`).emit('webrtc:ice-candidate', {
        ...parsed,
        fromUserId: s.data.userId,
      });
    });

    bindEvent(s, 'call:end', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(roomJoinSchema.extend({ callId: z.string().uuid() }), payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      io.to(`room:${parsed.roomId}`).emit('call:ended', {
        roomId: parsed.roomId,
        callId: parsed.callId,
        by: s.data.userId,
        at: new Date().toISOString(),
      });
    });

    bindEvent(s, 'call:initiate', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(callInitiateSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      io.to(`room:${parsed.roomId}`).emit('call:incoming', {
        callId: parsed.callId,
        roomId: parsed.roomId,
        callerId: s.data.userId,
        type: parsed.type,
        at: new Date().toISOString(),
      });
    });

    bindEvent(s, 'call:answer', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(callResponseSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      io.to(`room:${parsed.roomId}`).emit('call:participant-joined', {
        callId: parsed.callId,
        userId: s.data.userId,
        at: new Date().toISOString(),
      });
    });

    bindEvent(s, 'call:reject', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(callResponseSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      io.to(`room:${parsed.roomId}`).emit('call:participant-rejected', {
        callId: parsed.callId,
        userId: s.data.userId,
        at: new Date().toISOString(),
      });
    });

    bindEvent(s, 'screen:share', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(screenShareSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      io.to(`room:${parsed.roomId}`).emit('screen:share:update', {
        callId: parsed.callId,
        userId: s.data.userId,
        active: parsed.active,
        at: new Date().toISOString(),
      });
    });

    bindEvent(s, 'message:send', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(encryptedMessageSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      const stored = await python.storeEncryptedMessage({
        roomId: parsed.roomId,
        senderId: s.data.userId,
        clientMsgId: parsed.clientMsgId,
        ciphertext: parsed.ciphertext,
        iv: parsed.iv,
        authTag: parsed.authTag,
        keyEnvelope: parsed.keyEnvelope,
        media: parsed.media,
      });

      const event = {
        roomId: parsed.roomId,
        messageId: stored.message_id,
        createdAt: stored.created_at,
        senderId: s.data.userId,
        clientMsgId: parsed.clientMsgId,
        ciphertext: parsed.ciphertext,
        iv: parsed.iv,
        authTag: parsed.authTag,
        keyEnvelope: parsed.keyEnvelope,
        media: parsed.media,
      };

      io.to(`room:${parsed.roomId}`).emit('message:new', event);
      s.emit('message:ack', { clientMsgId: parsed.clientMsgId, messageId: stored.message_id });
    });

    bindEvent(s, 'message:history', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(messageHistorySchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      const result = await python.listEncryptedMessages(parsed.roomId, s.data.userId, parsed.cursor, parsed.limit);
      s.emit('message:history', {
        roomId: parsed.roomId,
        nextCursor: result.next_cursor ?? null,
        items: result.items.map((item) => ({
          messageId: item.message_id,
          roomId: item.room_id,
          senderId: item.sender_id,
          clientMsgId: item.client_msg_id,
          ciphertext: item.ciphertext,
          iv: item.iv,
          authTag: item.auth_tag,
          keyEnvelope: item.key_envelope,
          media: item.media.map((m) => ({
            blobKey: m.blob_key,
            mimeType: m.mime_type,
            size: m.size,
            thumbKey: m.thumb_key,
          })),
          createdAt: item.created_at,
        })),
      });
    });

    bindEvent(s, 'typing:start', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(typingSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      s.to(`room:${parsed.roomId}`).emit('typing:update', {
        roomId: parsed.roomId,
        userId: s.data.userId,
        typing: true,
      });
    });

    bindEvent(s, 'typing:stop', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(typingSchema, payload, s);
      if (!parsed) return;
      if (!(await requireMembership(s, parsed.roomId))) return;

      s.to(`room:${parsed.roomId}`).emit('typing:update', {
        roomId: parsed.roomId,
        userId: s.data.userId,
        typing: false,
      });
    });

    bindEvent(s, 'key:publish', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(keyPublishSchema, payload, s);
      if (!parsed) return;

      await python.publishPublicKey(s.data.userId, parsed.algorithm, parsed.publicKey);
      s.emit('key:published', { algorithm: parsed.algorithm, at: new Date().toISOString() });
    });

    bindEvent(s, 'key:fetch', async (payload: unknown) => {
      if (!withRateLimit(s)) return;
      const parsed = parsePayload(keyFetchSchema, payload, s);
      if (!parsed) return;

      const record = await python.getPublicKey(parsed.userId);
      s.emit('key:fetched', {
        userId: record.user_id,
        algorithm: record.algorithm,
        publicKey: record.public_key,
        updatedAt: record.updated_at,
      });
    });

    s.on('disconnect', async () => {
      await python.setPresence(s.data.userId, 'offline').catch(() => undefined);
      io.emit('presence:update', {
        userId: s.data.userId,
        status: 'offline',
        at: new Date().toISOString(),
      });
    });
  });

  return { server, io };
}

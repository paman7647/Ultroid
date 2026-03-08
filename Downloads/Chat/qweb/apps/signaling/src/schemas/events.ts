import { z } from 'zod';

const b64 = z.string().min(8).max(1024 * 1024);

export const roomJoinSchema = z.object({
  roomId: z.string().uuid(),
});

export const roomCreateSchema = z.object({
  roomId: z.string().uuid(),
  memberIds: z.array(z.string().uuid()).min(2).max(128),
});

export const offerSchema = z.object({
  callId: z.string().uuid(),
  roomId: z.string().uuid(),
  toUserId: z.string().uuid(),
  sdp: z.string().min(20).max(128000),
});

export const answerSchema = z.object({
  callId: z.string().uuid(),
  roomId: z.string().uuid(),
  toUserId: z.string().uuid(),
  sdp: z.string().min(20).max(128000),
});

export const iceSchema = z.object({
  callId: z.string().uuid(),
  roomId: z.string().uuid(),
  toUserId: z.string().uuid(),
  candidate: z.string().min(1).max(4096),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().nullable().optional(),
});

export const encryptedMessageSchema = z.object({
  roomId: z.string().uuid(),
  clientMsgId: z.string().max(128).optional(),
  ciphertext: b64,
  iv: b64,
  authTag: b64,
  keyEnvelope: b64,
  media: z
    .array(
      z.object({
        blobKey: z.string().max(1024),
        mimeType: z.string().max(120),
        size: z.number().int().nonnegative().max(1024 * 1024 * 1024),
        thumbKey: z.string().max(1024).optional(),
      }),
    )
    .max(10)
    .default([]),
});

export const typingSchema = z.object({ roomId: z.string().uuid() });

export const keyPublishSchema = z.object({
  algorithm: z.enum(['X25519', 'RSA-OAEP-4096', 'P-256-ECDH']),
  publicKey: z.string().min(32).max(10000),
});

export const keyFetchSchema = z.object({
  userId: z.string().uuid(),
});

export const callInitiateSchema = z.object({
  callId: z.string().uuid(),
  roomId: z.string().uuid(),
  type: z.enum(['voice', 'video']),
});

export const callResponseSchema = z.object({
  callId: z.string().uuid(),
  roomId: z.string().uuid(),
});

export const screenShareSchema = z.object({
  callId: z.string().uuid(),
  roomId: z.string().uuid(),
  active: z.boolean(),
});

export const messageHistorySchema = z.object({
  roomId: z.string().uuid(),
  cursor: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

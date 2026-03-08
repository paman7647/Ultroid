import { z } from 'zod';

export const wsJoinRoomSchema = z.object({ roomId: z.string().uuid() });
export const wsSendMessageSchema = z.object({
  roomId: z.string().uuid(),
  text: z.string().min(1).max(5000),
  clientMsgId: z.string().optional(),
  replyToId: z.string().uuid().optional(),
});

export const wsTypingSchema = z.object({
  roomId: z.string().uuid(),
});

export const createRoomSchema = z.object({
  type: z.enum(['DM', 'GROUP']),
  name: z.string().max(80).optional(),
  memberIds: z.array(z.string().uuid()).min(1),
});

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  clientMsgId: z.string().optional(),
  replyToId: z.string().uuid().optional(),
});

export type WsJoinRoom = z.infer<typeof wsJoinRoomSchema>;
export type WsSendMessage = z.infer<typeof wsSendMessageSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

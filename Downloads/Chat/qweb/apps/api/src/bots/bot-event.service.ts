import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';

export interface BotEvent {
  type: string;
  botId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Service for dispatching events to bots via webhooks and WebSocket.
 */
@Injectable()
export class BotEventService {
  private readonly logger = new Logger(BotEventService.name);
  // Reference to the chat gateway server instance (set by BotGateway)
  private chatServer: any = null;

  constructor(private readonly prisma: PrismaService) {}

  setChatServer(server: any) {
    this.chatServer = server;
  }

  /**
   * Emit a Socket.IO event to a room via the chat namespace.
   */
  emitToRoom(roomId: string, event: string, data: unknown) {
    if (this.chatServer) {
      this.chatServer.to(`room:${roomId}`).emit(event, data);
    }
  }

  /**
   * Dispatch an event to all bots in a given room.
   * Sends via webhook if configured, also emits via WebSocket.
   */
  async dispatchEventToRoom(roomId: string, eventType: string, data: Record<string, unknown>) {
    const botMembers = await this.prisma.roomMembership.findMany({
      where: {
        roomId,
        user: { isBot: true, deletedAt: null },
      },
      include: {
        user: {
          select: {
            id: true,
            botWebhookUrl: true,
            botPlugins: {
              where: { isEnabled: true, events: { has: eventType } },
            },
          },
        },
      },
    });

    for (const member of botMembers) {
      const bot = member.user;
      // Only dispatch if bot has plugins subscribed to this event
      if (bot.botPlugins.length === 0) continue;

      const event: BotEvent = {
        type: eventType,
        botId: bot.id,
        data: { ...data, roomId },
        timestamp: new Date().toISOString(),
      };

      // Emit via WebSocket to bot-specific channel
      if (this.chatServer) {
        this.chatServer.to(`bot:${bot.id}`).emit('bot:event', event);
      }

      // Dispatch webhook
      if (bot.botWebhookUrl) {
        this.dispatchWebhook(bot.id, event).catch((err) => {
          this.logger.warn(`Webhook dispatch failed for bot ${bot.id}: ${err.message}`);
        });
      }
    }
  }

  /**
   * Send a webhook to a bot's configured URL.
   * Signs the payload with HMAC-SHA256 using the bot's first active token hash.
   */
  async dispatchWebhook(botId: string, event: BotEvent) {
    const bot = await this.prisma.user.findFirst({
      where: { id: botId, isBot: true },
      select: {
        botWebhookUrl: true,
        botTokens: {
          where: { revokedAt: null },
          select: { tokenHash: true },
          take: 1,
        },
      },
    });

    if (!bot?.botWebhookUrl) return;

    const payload = JSON.stringify(event);
    const secret = bot.botTokens[0]?.tokenHash ?? '';
    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    try {
      const response = await fetch(bot.botWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Signature': signature,
          'X-Bot-Event': event.type,
        },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.warn(`Webhook returned ${response.status} for bot ${botId}`);
      }
    } catch (err: any) {
      this.logger.warn(`Webhook failed for bot ${botId}: ${err.message}`);
    }
  }

  /**
   * All supported event types.
   */
  static readonly EVENT_TYPES = [
    'MESSAGE_CREATE',
    'MESSAGE_EDIT',
    'MESSAGE_DELETE',
    'USER_JOIN_ROOM',
    'USER_LEAVE_ROOM',
    'REACTION_ADD',
    'REACTION_REMOVE',
    'VOICE_JOIN',
    'VOICE_LEAVE',
    'COMMAND_RECEIVED',
  ] as const;
}

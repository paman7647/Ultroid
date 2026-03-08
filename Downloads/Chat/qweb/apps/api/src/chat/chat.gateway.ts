import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import type { Server } from 'socket.io';
import { WsJwtGuard, authenticateSocket, type AuthenticatedSocket } from '@/common/guards/ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { PrismaService } from '@/prisma/prisma.service';
import { PresenceService } from '@/presence/presence.service';
import { BotEventService } from '@/bots/bot-event.service';
import { BotCommandsService } from '@/bots/bot-commands.service';
import { EventBusService } from '@/queue/event-bus.service';
import { NotificationService } from '@/queue/notification.service';
import { ConnectionManagerService } from '@/common/services/connection-manager.service';
import { MessageKindDto } from './dto/send-message.dto';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: [process.env.CORS_ORIGIN ?? 'http://localhost:3000'],
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly userSocketCount = new Map<string, number>();

  constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
    private readonly botEventService: BotEventService,
    private readonly botCommandsService: BotCommandsService,
    private readonly eventBus: EventBusService,
    private readonly notificationService: NotificationService,
    private readonly connectionManager: ConnectionManagerService,
    private readonly jwt: JwtService,
  ) {}

  afterInit() {
    // intentionally empty: hook reserved for instrumentation and adapters.
  }

  async handleConnection(client: AuthenticatedSocket) {
    const userId = await authenticateSocket(client, this.jwt);
    if (!userId) return;

    this.userSocketCount.set(userId, (this.userSocketCount.get(userId) ?? 0) + 1);
    this.connectionManager.increment();
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });

    // Delegate to Redis-backed presence
    await this.presenceService.setOnline(userId);

    this.server.emit('presence:update', {
      userId,
      status: 'online',
      lastSeenAt: new Date().toISOString(),
    });
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.user?.sub;
    if (!userId) return;

    const remaining = (this.userSocketCount.get(userId) ?? 1) - 1;
    if (remaining > 0) {
      this.userSocketCount.set(userId, remaining);
      return;
    }

    this.userSocketCount.delete(userId);
    this.connectionManager.decrement();
    const lastSeenAt = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt },
    });

    // Delegate to Redis-backed presence
    await this.presenceService.setOffline(userId);

    this.server.emit('presence:update', {
      userId,
      status: 'offline',
      lastSeenAt: lastSeenAt.toISOString(),
    });
  }

  @SubscribeMessage('room:join')
  async joinRoom(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: { roomId: string }) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const allowed = await this.chatService.isMember(body.roomId, userId);
    if (!allowed) throw new WsException('FORBIDDEN_ROOM');

    await client.join(`room:${body.roomId}`);
    return { event: 'room:joined', data: { roomId: body.roomId } };
  }

  @SubscribeMessage('room:leave')
  async leaveRoom(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: { roomId: string }) {
    await client.leave(`room:${body.roomId}`);
    return { event: 'room:left', data: { roomId: body.roomId } };
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: {
      roomId: string;
      text?: string;
      kind?: MessageKindDto;
      attachmentIds?: string[];
      replyToId?: string;
      forwardFromMessageId?: string;
      clientMsgId?: string;
    },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.chatService.assertCanSend(body.roomId, userId);

    const msg = await this.chatService.createMessage(body.roomId, userId, {
      kind: body.kind,
      body: body.text,
      replyToId: body.replyToId,
      forwardFromMessageId: body.forwardFromMessageId,
      attachmentIds: body.attachmentIds,
      clientMsgId: body.clientMsgId,
    });

    this.server.to(`room:${body.roomId}`).emit('message:new', msg);

    // Publish to message processing stream (search indexing, analytics, etc.)
    this.eventBus.publishMessageEvent('created', msg.id, body.roomId, userId, body.text).catch(() => {});
    this.eventBus.publishAnalyticsEvent('message_send', userId, body.roomId).catch(() => {});

    // Parse @mentions and send notifications
    if (body.text) {
      const mentionedIds = this.notificationService.parseMentions(body.text);
      if (mentionedIds.length > 0) {
        this.notificationService.notifyMentions(
          body.roomId, msg.id, userId, 'User', body.text, mentionedIds,
        ).catch(() => {});
      }
    }

    // Dispatch MESSAGE_CREATE event to bots in this room
    this.botEventService.dispatchEventToRoom(body.roomId, 'MESSAGE_CREATE', {
      messageId: msg.id,
      senderId: userId,
      body: body.text,
      kind: body.kind,
    });

    // Parse bot commands from the message
    if (body.text && (body.text.startsWith('/') || body.text.startsWith('!'))) {
      const parsed = await this.botCommandsService.parseCommand(body.roomId, body.text);
      if (parsed) {
        this.botEventService.dispatchEventToRoom(body.roomId, 'COMMAND_RECEIVED', {
          command: parsed.command.name,
          args: parsed.args,
          rawArgs: parsed.rawArgs,
          senderId: userId,
          botId: parsed.botId,
          messageId: msg.id,
        });
      }
    }

    return {
      event: 'message:ack',
      data: {
        roomId: body.roomId,
        clientMsgId: body.clientMsgId,
        messageId: msg.id,
      },
    };
  }

  @SubscribeMessage('message:edit')
  async editMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; messageId: string; text: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const message = await this.chatService.editMessage(body.roomId, userId, body.messageId, body.text);
    this.server.to(`room:${body.roomId}`).emit('message:edited', {
      roomId: body.roomId,
      message,
    });

    this.botEventService.dispatchEventToRoom(body.roomId, 'MESSAGE_EDIT', {
      messageId: body.messageId,
      senderId: userId,
      newText: body.text,
    });

    return {
      event: 'message:edit:ack',
      data: {
        roomId: body.roomId,
        messageId: body.messageId,
      },
    };
  }

  @SubscribeMessage('message:delete')
  async deleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; messageId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const result = await this.chatService.deleteMessage(body.roomId, userId, body.messageId);
    this.server.to(`room:${body.roomId}`).emit('message:deleted', result);

    this.botEventService.dispatchEventToRoom(body.roomId, 'MESSAGE_DELETE', {
      messageId: body.messageId,
      deletedBy: userId,
    });

    return {
      event: 'message:delete:ack',
      data: {
        roomId: body.roomId,
        messageId: body.messageId,
      },
    };
  }

  @SubscribeMessage('message:delete-for-me')
  async deleteMessageForMe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; messageId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const result = await this.chatService.deleteMessageForMe(body.roomId, userId, body.messageId);
    return {
      event: 'message:delete-for-me:ack',
      data: result,
    };
  }

  @SubscribeMessage('message:forward')
  async forwardMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; messageId: string; targetRoomId: string; bodyOverride?: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const message = await this.chatService.forwardMessage(body.roomId, userId, body.messageId, {
      targetRoomId: body.targetRoomId,
      bodyOverride: body.bodyOverride,
    });
    this.server.to(`room:${body.targetRoomId}`).emit('message:new', message);

    return {
      event: 'message:forward:ack',
      data: {
        sourceRoomId: body.roomId,
        targetRoomId: body.targetRoomId,
        messageId: message.id,
      },
    };
  }

  @SubscribeMessage('reaction:add')
  async addReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; messageId: string; emoji: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const reactionState = await this.chatService.addReaction(body.roomId, userId, body.messageId, body.emoji);
    this.server.to(`room:${body.roomId}`).emit('reaction:updated', reactionState);

    this.botEventService.dispatchEventToRoom(body.roomId, 'REACTION_ADD', {
      messageId: body.messageId,
      userId,
      emoji: body.emoji,
    });

    return {
      event: 'reaction:add:ack',
      data: {
        roomId: body.roomId,
        messageId: body.messageId,
      },
    };
  }

  @SubscribeMessage('message:star')
  async starMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; messageId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const result = await this.chatService.starMessage(body.roomId, userId, body.messageId);
    return {
      event: 'message:star:ack',
      data: result,
    };
  }

  @SubscribeMessage('message:unstar')
  async unstarMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; messageId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const result = await this.chatService.unstarMessage(body.roomId, userId, body.messageId);
    return {
      event: 'message:unstar:ack',
      data: result,
    };
  }

  @SubscribeMessage('reaction:remove')
  async removeReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; messageId: string; emoji: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const reactionState = await this.chatService.removeReaction(body.roomId, userId, body.messageId, body.emoji);
    this.server.to(`room:${body.roomId}`).emit('reaction:updated', reactionState);

    this.botEventService.dispatchEventToRoom(body.roomId, 'REACTION_REMOVE', {
      messageId: body.messageId,
      userId,
      emoji: body.emoji,
    });

    return {
      event: 'reaction:remove:ack',
      data: {
        roomId: body.roomId,
        messageId: body.messageId,
      },
    };
  }

  @SubscribeMessage('message:read')
  async markRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; messageId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const receipt = await this.chatService.markRead(body.roomId, userId, body.messageId);
    this.server.to(`room:${body.roomId}`).emit('message:read', {
      roomId: body.roomId,
      messageId: body.messageId,
      userId,
      readAt: receipt.readAt,
    });

    return {
      event: 'message:read:ack',
      data: { roomId: body.roomId, messageId: body.messageId },
    };
  }

  @SubscribeMessage('room:read-all')
  async markAllRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const result = await this.chatService.markAllRead(body.roomId, userId);
    this.server.to(`room:${body.roomId}`).emit('room:read-all', {
      roomId: body.roomId,
      userId,
      marked: result.marked,
    });

    return {
      event: 'room:read-all:ack',
      data: result,
    };
  }

  @SubscribeMessage('typing:start')
  async typingStart(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: { roomId: string }) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.chatService.assertCanSend(body.roomId, userId);
    await this.presenceService.setTyping(userId, body.roomId);

    client.to(`room:${body.roomId}`).emit('typing:update', { roomId: body.roomId, userId, typing: true });
  }

  @SubscribeMessage('typing:stop')
  async typingStop(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: { roomId: string }) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.chatService.assertCanSend(body.roomId, userId);
    await this.presenceService.clearTyping(userId);

    client.to(`room:${body.roomId}`).emit('typing:update', { roomId: body.roomId, userId, typing: false });
  }
}

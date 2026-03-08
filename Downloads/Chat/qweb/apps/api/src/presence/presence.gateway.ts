import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import type { Server } from 'socket.io';
import { WsJwtGuard, authenticateSocket, type AuthenticatedSocket } from '@/common/guards/ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';
import { PresenceService } from './presence.service';
import { PrismaService } from '@/prisma/prisma.service';

@WebSocketGateway({
  namespace: '/presence',
  cors: {
    origin: [process.env.CORS_ORIGIN ?? 'http://localhost:3000'],
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly userSocketCount = new Map<string, number>();

  constructor(
    private readonly presenceService: PresenceService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    const userId = await authenticateSocket(client, this.jwt);
    if (!userId) return;

    await client.join(`user:${userId}`);
    const count = (this.userSocketCount.get(userId) ?? 0) + 1;
    this.userSocketCount.set(userId, count);

    if (count === 1) {
      await this.presenceService.setOnline(userId);
      this.server.emit('presence:update', {
        userId,
        status: 'online',
        at: new Date().toISOString(),
      });
    }

    // Join all room channels for presence updates
    const memberships = await this.prisma.roomMembership.findMany({
      where: { userId },
      select: { roomId: true },
    });
    for (const m of memberships) {
      await client.join(`room:${m.roomId}`);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.user?.sub;
    if (!userId) return;

    const count = (this.userSocketCount.get(userId) ?? 1) - 1;
    if (count > 0) {
      this.userSocketCount.set(userId, count);
      return;
    }

    this.userSocketCount.delete(userId);
    await this.presenceService.setOffline(userId);
    this.server.emit('presence:update', {
      userId,
      status: 'offline',
      lastSeenAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('presence:heartbeat')
  async heartbeat(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.presenceService.heartbeat(userId);
  }

  @SubscribeMessage('presence:set-status')
  async setStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { status: 'online' | 'away' | 'dnd' },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const current = await this.presenceService.getPresence(userId);
    if (current) {
      current.status = body.status;
    }

    this.server.emit('presence:update', {
      userId,
      status: body.status,
      at: new Date().toISOString(),
    });

    return { event: 'presence:status:ack', data: { status: body.status } };
  }

  @SubscribeMessage('presence:get')
  async getPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { userIds: string[] },
  ) {
    const presences = await this.presenceService.getMultiplePresence(body.userIds);
    const result: Record<string, unknown> = {};
    for (const [userId, presence] of presences) {
      result[userId] = presence;
    }
    return { event: 'presence:state', data: result };
  }

  @SubscribeMessage('presence:room')
  async getRoomPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    const presences = await this.presenceService.getRoomPresence(body.roomId);
    const result: Record<string, unknown> = {};
    for (const [userId, presence] of presences) {
      result[userId] = presence;
    }
    return { event: 'presence:room:state', data: { roomId: body.roomId, presences: result } };
  }
}

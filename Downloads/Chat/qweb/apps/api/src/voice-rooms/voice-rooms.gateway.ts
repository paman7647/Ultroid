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
import { VoiceRoomsService } from './voice-rooms.service';
import { BotEventService } from '@/bots/bot-event.service';

@WebSocketGateway({
  namespace: '/voice',
  cors: {
    origin: [process.env.CORS_ORIGIN ?? 'http://localhost:3000'],
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
export class VoiceRoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  // Track user → voiceRoomId for cleanup on disconnect
  private readonly userVoiceRoom = new Map<string, string>();

  constructor(
    private readonly voiceRoomsService: VoiceRoomsService,
    private readonly botEventService: BotEventService,
    private readonly jwt: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    const userId = await authenticateSocket(client, this.jwt);
    if (!userId) return;
    await client.join(`user:${userId}`);
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.user?.sub;
    if (!userId) return;

    const voiceRoomId = this.userVoiceRoom.get(userId);
    if (voiceRoomId) {
      try {
        const room = await this.voiceRoomsService.leaveVoiceRoom(userId, voiceRoomId);
        this.userVoiceRoom.delete(userId);
        this.server.to(`voice:${voiceRoomId}`).emit('voice:member-left', {
          voiceRoomId,
          userId,
          members: room.members,
        });
      } catch {
        // Room may have been deleted
      }
    }
  }

  @SubscribeMessage('voice:join')
  async joinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { voiceRoomId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    // Leave previous voice room if any
    const prevRoomId = this.userVoiceRoom.get(userId);
    if (prevRoomId && prevRoomId !== body.voiceRoomId) {
      await client.leave(`voice:${prevRoomId}`);
      const prevRoom = await this.voiceRoomsService.leaveVoiceRoom(userId, prevRoomId);
      this.server.to(`voice:${prevRoomId}`).emit('voice:member-left', {
        voiceRoomId: prevRoomId,
        userId,
        members: prevRoom.members,
      });
    }

    const room = await this.voiceRoomsService.joinVoiceRoom(userId, body.voiceRoomId);
    await client.join(`voice:${body.voiceRoomId}`);
    this.userVoiceRoom.set(userId, body.voiceRoomId);

    this.server.to(`voice:${body.voiceRoomId}`).emit('voice:member-joined', {
      voiceRoomId: body.voiceRoomId,
      userId,
      members: room.members,
    });

    // Dispatch VOICE_JOIN to bots in linked chat room
    if (room.roomId) {
      this.botEventService.dispatchEventToRoom(room.roomId, 'VOICE_JOIN', {
        voiceRoomId: body.voiceRoomId,
        userId,
      });
    }

    return { event: 'voice:joined', data: room };
  }

  @SubscribeMessage('voice:leave')
  async leaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { voiceRoomId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const room = await this.voiceRoomsService.leaveVoiceRoom(userId, body.voiceRoomId);
    await client.leave(`voice:${body.voiceRoomId}`);
    this.userVoiceRoom.delete(userId);

    this.server.to(`voice:${body.voiceRoomId}`).emit('voice:member-left', {
      voiceRoomId: body.voiceRoomId,
      userId,
      members: room.members,
    });

    // Dispatch VOICE_LEAVE to bots in linked chat room
    if (room.roomId) {
      this.botEventService.dispatchEventToRoom(room.roomId, 'VOICE_LEAVE', {
        voiceRoomId: body.voiceRoomId,
        userId,
      });
    }

    return { event: 'voice:left', data: { voiceRoomId: body.voiceRoomId } };
  }

  @SubscribeMessage('voice:mute')
  async toggleMute(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { voiceRoomId: string; isMuted: boolean },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.voiceRoomsService.toggleMute(userId, body.voiceRoomId, body.isMuted);

    this.server.to(`voice:${body.voiceRoomId}`).emit('voice:member-updated', {
      voiceRoomId: body.voiceRoomId,
      userId,
      isMuted: body.isMuted,
    });

    return { event: 'voice:mute:ack', data: { isMuted: body.isMuted } };
  }

  @SubscribeMessage('voice:deafen')
  async toggleDeafen(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { voiceRoomId: string; isDeafened: boolean },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.voiceRoomsService.toggleDeafen(userId, body.voiceRoomId, body.isDeafened);

    this.server.to(`voice:${body.voiceRoomId}`).emit('voice:member-updated', {
      voiceRoomId: body.voiceRoomId,
      userId,
      isDeafened: body.isDeafened,
    });

    return { event: 'voice:deafen:ack', data: { isDeafened: body.isDeafened } };
  }

  @SubscribeMessage('voice:speaking')
  async setSpeaking(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { voiceRoomId: string; isSpeaking: boolean },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.voiceRoomsService.setSpeaking(userId, body.voiceRoomId, body.isSpeaking);

    client.to(`voice:${body.voiceRoomId}`).emit('voice:speaking-update', {
      voiceRoomId: body.voiceRoomId,
      userId,
      isSpeaking: body.isSpeaking,
    });
  }

  // ── WebRTC signaling for voice rooms ──

  @SubscribeMessage('voice:webrtc:offer')
  async handleOffer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { voiceRoomId: string; toUserId: string; sdp: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    this.server.to(`user:${body.toUserId}`).emit('voice:webrtc:offer', {
      voiceRoomId: body.voiceRoomId,
      fromUserId: userId,
      sdp: body.sdp,
    });
  }

  @SubscribeMessage('voice:webrtc:answer')
  async handleAnswer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { voiceRoomId: string; toUserId: string; sdp: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    this.server.to(`user:${body.toUserId}`).emit('voice:webrtc:answer', {
      voiceRoomId: body.voiceRoomId,
      fromUserId: userId,
      sdp: body.sdp,
    });
  }

  @SubscribeMessage('voice:webrtc:ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: {
      voiceRoomId: string;
      toUserId: string;
      candidate: string;
      sdpMid?: string;
      sdpMLineIndex?: number;
    },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    this.server.to(`user:${body.toUserId}`).emit('voice:webrtc:ice-candidate', {
      voiceRoomId: body.voiceRoomId,
      fromUserId: userId,
      candidate: body.candidate,
      sdpMid: body.sdpMid,
      sdpMLineIndex: body.sdpMLineIndex,
    });
  }
}

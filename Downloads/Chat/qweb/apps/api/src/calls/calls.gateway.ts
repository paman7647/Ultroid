import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import type { Server } from 'socket.io';
import { WsJwtGuard, type AuthenticatedSocket } from '@/common/guards/ws-jwt.guard';
import { CallsService } from './calls.service';
import { CallType } from '@prisma/client';

@WebSocketGateway({
  namespace: '/calls',
  cors: {
    origin: [process.env.CORS_ORIGIN ?? 'http://localhost:3000'],
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
export class CallsGateway {
  @WebSocketServer() server!: Server;

  constructor(private readonly callsService: CallsService) {}

  // ── Call lifecycle events ──

  @SubscribeMessage('call:initiate')
  async initiateCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; type: string; isGroup?: boolean },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const call = await this.callsService.initiateCall(
      userId,
      body.roomId,
      body.type as CallType,
      body.isGroup ?? false,
    );

    // Notify all participants about incoming call
    for (const participant of call.participants) {
      if (participant.userId !== userId) {
        this.server.to(`user:${participant.userId}`).emit('call:incoming', {
          callId: call.id,
          roomId: call.roomId,
          type: call.type,
          isGroup: call.isGroup,
          initiator: call.initiator,
          participants: call.participants,
        });
      }
    }

    // Join caller to call room
    await client.join(`call:${call.id}`);

    return {
      event: 'call:initiated',
      data: call,
    };
  }

  @SubscribeMessage('call:answer')
  async answerCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const call = await this.callsService.answerCall(userId, body.callId);
    await client.join(`call:${call.id}`);

    this.server.to(`call:${call.id}`).emit('call:participant-joined', {
      callId: call.id,
      userId,
      participants: call.participants,
    });

    return { event: 'call:answered', data: call };
  }

  @SubscribeMessage('call:reject')
  async rejectCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const call = await this.callsService.rejectCall(userId, body.callId);

    this.server.to(`call:${call.id}`).emit('call:participant-rejected', {
      callId: call.id,
      userId,
    });

    return { event: 'call:rejected', data: { callId: call.id } };
  }

  @SubscribeMessage('call:end')
  async endCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const call = await this.callsService.endCall(userId, body.callId);

    this.server.to(`call:${call.id}`).emit('call:ended', {
      callId: call.id,
      endedBy: userId,
      duration: call.duration,
      status: call.status,
    });

    return { event: 'call:end:ack', data: { callId: call.id } };
  }

  @SubscribeMessage('call:leave')
  async leaveCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const call = await this.callsService.leaveCall(userId, body.callId);
    await client.leave(`call:${call.id}`);

    this.server.to(`call:${call.id}`).emit('call:participant-left', {
      callId: call.id,
      userId,
    });

    return { event: 'call:leave:ack', data: { callId: call.id } };
  }

  // ── WebRTC Signaling ──

  @SubscribeMessage('webrtc:offer')
  async handleOffer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string; toUserId: string; sdp: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    this.server.to(`user:${body.toUserId}`).emit('webrtc:offer', {
      callId: body.callId,
      fromUserId: userId,
      sdp: body.sdp,
    });
  }

  @SubscribeMessage('webrtc:answer')
  async handleAnswer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string; toUserId: string; sdp: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    this.server.to(`user:${body.toUserId}`).emit('webrtc:answer', {
      callId: body.callId,
      fromUserId: userId,
      sdp: body.sdp,
    });
  }

  @SubscribeMessage('webrtc:ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: {
      callId: string;
      toUserId: string;
      candidate: string;
      sdpMid?: string;
      sdpMLineIndex?: number;
    },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    this.server.to(`user:${body.toUserId}`).emit('webrtc:ice-candidate', {
      callId: body.callId,
      fromUserId: userId,
      candidate: body.candidate,
      sdpMid: body.sdpMid,
      sdpMLineIndex: body.sdpMLineIndex,
    });
  }

  // ── Participant state changes ──

  @SubscribeMessage('call:toggle-mute')
  async toggleMute(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string; isMuted: boolean },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.callsService.toggleMute(userId, body.callId, body.isMuted);

    this.server.to(`call:${body.callId}`).emit('call:participant-updated', {
      callId: body.callId,
      userId,
      isMuted: body.isMuted,
    });

    return { event: 'call:toggle-mute:ack', data: { isMuted: body.isMuted } };
  }

  @SubscribeMessage('call:toggle-video')
  async toggleVideo(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string; isVideoOff: boolean },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.callsService.toggleVideo(userId, body.callId, body.isVideoOff);

    this.server.to(`call:${body.callId}`).emit('call:participant-updated', {
      callId: body.callId,
      userId,
      isVideoOff: body.isVideoOff,
    });

    return { event: 'call:toggle-video:ack', data: { isVideoOff: body.isVideoOff } };
  }

  @SubscribeMessage('call:toggle-screen-share')
  async toggleScreenShare(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string; isScreenSharing: boolean },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.callsService.toggleScreenShare(userId, body.callId, body.isScreenSharing);

    this.server.to(`call:${body.callId}`).emit('call:participant-updated', {
      callId: body.callId,
      userId,
      isScreenSharing: body.isScreenSharing,
    });

    return {
      event: 'call:toggle-screen-share:ack',
      data: { isScreenSharing: body.isScreenSharing },
    };
  }

  @SubscribeMessage('call:toggle-hand-raise')
  async toggleHandRaise(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string; isHandRaised: boolean },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    await this.callsService.toggleHandRaise(userId, body.callId, body.isHandRaised);

    this.server.to(`call:${body.callId}`).emit('call:participant-updated', {
      callId: body.callId,
      userId,
      isHandRaised: body.isHandRaised,
    });

    return {
      event: 'call:toggle-hand-raise:ack',
      data: { isHandRaised: body.isHandRaised },
    };
  }

  @SubscribeMessage('call:reaction')
  async sendReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { callId: string; emoji: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    this.server.to(`call:${body.callId}`).emit('call:reaction', {
      callId: body.callId,
      userId,
      emoji: body.emoji,
    });
  }
}

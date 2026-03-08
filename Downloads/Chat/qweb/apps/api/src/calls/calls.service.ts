import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CallStatus, CallType, ParticipantStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

  async initiateCall(
    userId: string,
    roomId: string,
    type: CallType,
    isGroup: boolean,
  ) {
    // Verify membership
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: {
        room: {
          include: { memberships: { select: { userId: true } } },
        },
      },
    });
    if (!membership) throw new ForbiddenException('Not a room member');

    // Check no active call in room
    const activeCall = await this.prisma.call.findFirst({
      where: {
        roomId,
        status: { in: [CallStatus.RINGING, CallStatus.ACTIVE] },
      },
    });
    if (activeCall) {
      throw new BadRequestException('An active call already exists in this room');
    }

    const participantUserIds = membership.room.memberships
      .map((m) => m.userId)
      .filter((id) => id !== userId);

    const call = await this.prisma.call.create({
      data: {
        roomId,
        initiatorId: userId,
        type,
        status: CallStatus.RINGING,
        isGroup,
        participants: {
          create: [
            { userId, status: ParticipantStatus.JOINED, joinedAt: new Date() },
            ...participantUserIds.map((id) => ({
              userId: id,
              status: ParticipantStatus.RINGING,
            })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        initiator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    return call;
  }

  async answerCall(userId: string, callId: string) {
    const participant = await this.prisma.callParticipant.findFirst({
      where: { callId, userId },
      include: { call: true },
    });
    if (!participant) throw new NotFoundException('Call not found');
    if (participant.call.status === CallStatus.ENDED) {
      throw new BadRequestException('Call has ended');
    }

    const now = new Date();
    await this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.JOINED, joinedAt: now },
    });

    // If call was RINGING, set to ACTIVE
    if (participant.call.status === CallStatus.RINGING) {
      await this.prisma.call.update({
        where: { id: callId },
        data: { status: CallStatus.ACTIVE, startedAt: now },
      });
    }

    return this.getCall(callId);
  }

  async rejectCall(userId: string, callId: string) {
    const participant = await this.prisma.callParticipant.findFirst({
      where: { callId, userId },
      include: { call: true },
    });
    if (!participant) throw new NotFoundException('Call not found');

    await this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.REJECTED, leftAt: new Date() },
    });

    // If all participants rejected/left, end the call
    const remaining = await this.prisma.callParticipant.count({
      where: {
        callId,
        status: { in: [ParticipantStatus.JOINED, ParticipantStatus.RINGING] },
      },
    });

    if (remaining <= 1) {
      await this.endCall(participant.call.initiatorId, callId);
    }

    return this.getCall(callId);
  }

  async endCall(userId: string, callId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: { participants: true },
    });
    if (!call) throw new NotFoundException('Call not found');

    const isParticipant = call.participants.some((p) => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('Not a call participant');

    const now = new Date();
    const duration = call.startedAt
      ? Math.round((now.getTime() - call.startedAt.getTime()) / 1000)
      : 0;

    // Mark unanswered participants as MISSED
    await this.prisma.callParticipant.updateMany({
      where: {
        callId,
        status: ParticipantStatus.RINGING,
      },
      data: { status: ParticipantStatus.MISSED, leftAt: now },
    });

    // Mark joined participants as LEFT
    await this.prisma.callParticipant.updateMany({
      where: {
        callId,
        status: ParticipantStatus.JOINED,
      },
      data: { status: ParticipantStatus.LEFT, leftAt: now },
    });

    const finalStatus =
      call.status === CallStatus.RINGING ? CallStatus.MISSED : CallStatus.ENDED;

    return this.prisma.call.update({
      where: { id: callId },
      data: {
        status: finalStatus,
        endedAt: now,
        duration,
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
      },
    });
  }

  async leaveCall(userId: string, callId: string) {
    const participant = await this.prisma.callParticipant.findFirst({
      where: { callId, userId, status: ParticipantStatus.JOINED },
    });
    if (!participant) throw new NotFoundException('Not in this call');

    await this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.LEFT, leftAt: new Date() },
    });

    // Check if anyone left in call
    const remaining = await this.prisma.callParticipant.count({
      where: { callId, status: ParticipantStatus.JOINED },
    });

    if (remaining === 0) {
      return this.endCall(userId, callId);
    }

    return this.getCall(callId);
  }

  async toggleMute(userId: string, callId: string, isMuted: boolean) {
    const participant = await this.prisma.callParticipant.findFirst({
      where: { callId, userId, status: ParticipantStatus.JOINED },
    });
    if (!participant) throw new NotFoundException('Not in this call');

    return this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: { isMuted },
    });
  }

  async toggleVideo(userId: string, callId: string, isVideoOff: boolean) {
    const participant = await this.prisma.callParticipant.findFirst({
      where: { callId, userId, status: ParticipantStatus.JOINED },
    });
    if (!participant) throw new NotFoundException('Not in this call');

    return this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: { isVideoOff },
    });
  }

  async toggleScreenShare(userId: string, callId: string, isScreenSharing: boolean) {
    const participant = await this.prisma.callParticipant.findFirst({
      where: { callId, userId, status: ParticipantStatus.JOINED },
    });
    if (!participant) throw new NotFoundException('Not in this call');

    return this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: { isScreenSharing },
    });
  }

  async toggleHandRaise(userId: string, callId: string, isHandRaised: boolean) {
    const participant = await this.prisma.callParticipant.findFirst({
      where: { callId, userId, status: ParticipantStatus.JOINED },
    });
    if (!participant) throw new NotFoundException('Not in this call');

    return this.prisma.callParticipant.update({
      where: { id: participant.id },
      data: { isHandRaised },
    });
  }

  async getCall(callId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        initiator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  async getCallHistory(userId: string, cursor?: string, limit = 50) {
    return this.prisma.call.findMany({
      where: {
        participants: { some: { userId } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        initiator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        room: {
          select: { id: true, type: true, name: true },
        },
      },
    });
  }

  async getActiveCallInRoom(roomId: string) {
    return this.prisma.call.findFirst({
      where: {
        roomId,
        status: { in: [CallStatus.RINGING, CallStatus.ACTIVE] },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });
  }
}

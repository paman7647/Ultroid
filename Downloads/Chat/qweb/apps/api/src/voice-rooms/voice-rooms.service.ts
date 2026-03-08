import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VoiceRoomType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateVoiceRoomDto, UpdateVoiceRoomDto } from './dto/voice-room.dto';

@Injectable()
export class VoiceRoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async createVoiceRoom(userId: string, dto: CreateVoiceRoomDto) {
    return this.prisma.voiceRoom.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        type: dto.type as VoiceRoomType,
        roomId: dto.roomId,
        createdById: userId,
        maxParticipants: dto.maxParticipants ?? 50,
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        createdBy: {
          select: { id: true, username: true, displayName: true },
        },
      },
    });
  }

  async updateVoiceRoom(userId: string, voiceRoomId: string, dto: UpdateVoiceRoomDto) {
    const voiceRoom = await this.prisma.voiceRoom.findUnique({
      where: { id: voiceRoomId },
    });
    if (!voiceRoom) throw new NotFoundException('Voice room not found');
    if (voiceRoom.createdById !== userId) {
      throw new ForbiddenException('Only the creator can update this room');
    }

    return this.prisma.voiceRoom.update({
      where: { id: voiceRoomId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.maxParticipants !== undefined ? { maxParticipants: dto.maxParticipants } : {}),
      },
    });
  }

  async deleteVoiceRoom(userId: string, voiceRoomId: string) {
    const voiceRoom = await this.prisma.voiceRoom.findUnique({
      where: { id: voiceRoomId },
    });
    if (!voiceRoom) throw new NotFoundException('Voice room not found');
    if (voiceRoom.createdById !== userId) {
      throw new ForbiddenException('Only the creator can delete this room');
    }

    await this.prisma.voiceRoom.delete({ where: { id: voiceRoomId } });
    return { deleted: true, voiceRoomId };
  }

  async joinVoiceRoom(userId: string, voiceRoomId: string) {
    const voiceRoom = await this.prisma.voiceRoom.findUnique({
      where: { id: voiceRoomId },
      include: { members: true },
    });
    if (!voiceRoom) throw new NotFoundException('Voice room not found');
    if (!voiceRoom.isActive) throw new BadRequestException('Voice room is inactive');

    // Check capacity
    if (voiceRoom.members.length >= voiceRoom.maxParticipants) {
      throw new BadRequestException('Voice room is full');
    }

    // Already in room?
    const existing = voiceRoom.members.find((m) => m.userId === userId);
    if (existing) return this.getVoiceRoom(voiceRoomId);

    // Leave any other voice room first
    await this.prisma.voiceRoomMember.deleteMany({
      where: { userId },
    });

    await this.prisma.voiceRoomMember.create({
      data: {
        voiceRoomId,
        userId,
      },
    });

    return this.getVoiceRoom(voiceRoomId);
  }

  async leaveVoiceRoom(userId: string, voiceRoomId: string) {
    await this.prisma.voiceRoomMember.deleteMany({
      where: { voiceRoomId, userId },
    });
    return this.getVoiceRoom(voiceRoomId);
  }

  async toggleMute(userId: string, voiceRoomId: string, isMuted: boolean) {
    const member = await this.prisma.voiceRoomMember.findUnique({
      where: { voiceRoomId_userId: { voiceRoomId, userId } },
    });
    if (!member) throw new NotFoundException('Not in this voice room');

    return this.prisma.voiceRoomMember.update({
      where: { id: member.id },
      data: { isMuted },
    });
  }

  async toggleDeafen(userId: string, voiceRoomId: string, isDeafened: boolean) {
    const member = await this.prisma.voiceRoomMember.findUnique({
      where: { voiceRoomId_userId: { voiceRoomId, userId } },
    });
    if (!member) throw new NotFoundException('Not in this voice room');

    return this.prisma.voiceRoomMember.update({
      where: { id: member.id },
      data: { isDeafened, isMuted: isDeafened ? true : member.isMuted },
    });
  }

  async setSpeaking(userId: string, voiceRoomId: string, isSpeaking: boolean) {
    const member = await this.prisma.voiceRoomMember.findUnique({
      where: { voiceRoomId_userId: { voiceRoomId, userId } },
    });
    if (!member) throw new NotFoundException('Not in this voice room');

    return this.prisma.voiceRoomMember.update({
      where: { id: member.id },
      data: { isSpeaking },
    });
  }

  async getVoiceRoom(voiceRoomId: string) {
    const voiceRoom = await this.prisma.voiceRoom.findUnique({
      where: { id: voiceRoomId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        createdBy: {
          select: { id: true, username: true, displayName: true },
        },
      },
    });
    if (!voiceRoom) throw new NotFoundException('Voice room not found');
    return voiceRoom;
  }

  async listVoiceRooms(filters?: { type?: VoiceRoomType; roomId?: string }) {
    return this.prisma.voiceRoom.findMany({
      where: {
        isActive: true,
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.roomId ? { roomId: filters.roomId } : {}),
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        createdBy: {
          select: { id: true, username: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserCurrentVoiceRoom(userId: string) {
    const member = await this.prisma.voiceRoomMember.findFirst({
      where: { userId },
      include: {
        voiceRoom: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
    });
    return member?.voiceRoom ?? null;
  }
}

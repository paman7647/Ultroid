import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole, MessageKind, Prisma, RoomType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from '@/users/users.service';
import { CreateRoomInviteDto } from './dto/create-room-invite.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { MessageKindDto, SendMessageDto } from './dto/send-message.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async listRooms(userId: string) {
    const rooms = await this.prisma.room.findMany({
      where: {
        memberships: {
          some: { userId },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      include: {
        memberships: {
          include: { user: { select: { id: true, username: true, displayName: true } } },
        },
        chatStates: {
          where: { userId },
          select: { isArchived: true, isPinned: true, pinOrder: true, mutedUntil: true },
        },
      },
    });

    const roomIds = rooms.map((room) => room.id);

    const unreadByRoom = roomIds.length
      ? await this.prisma.message.groupBy({
          by: ['roomId'],
          where: {
            roomId: { in: roomIds },
            senderId: { not: userId },
            deletedAt: null,
            hiddenForUsers: {
              none: { userId },
            },
            readReceipts: {
              none: { userId },
            },
          },
          _count: { _all: true },
        })
      : [];

    const unreadMap = new Map(unreadByRoom.map((row) => [row.roomId, row._count._all]));

    return rooms.map((room) => ({
      ...room,
      chatState: room.chatStates[0] ?? { isArchived: false, isPinned: false, pinOrder: null, mutedUntil: null },
      chatStates: undefined,
      unreadCount: unreadMap.get(room.id) ?? 0,
    })).sort((a, b) => {
      if (a.chatState?.isPinned && !b.chatState?.isPinned) return -1;
      if (!a.chatState?.isPinned && b.chatState?.isPinned) return 1;
      const aOrder = a.chatState?.pinOrder ?? 0;
      const bOrder = b.chatState?.pinOrder ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0);
    });
  }

  async createRoom(userId: string, dto: CreateRoomDto) {
    const memberIds = Array.from(new Set([userId, ...dto.memberIds]));

    if (dto.type === 'DM' && memberIds.length !== 2) {
      throw new ForbiddenException('DM requires exactly 2 members');
    }

    if (dto.type === 'DM') {
      const peerId = memberIds.find((id) => id !== userId);
      if (!peerId) throw new ForbiddenException('Invalid DM members');

      const blocked = await this.usersService.isBlockedEitherWay(userId, peerId);
      if (blocked) {
        throw new ForbiddenException('Cannot create DM due to block relationship');
      }

      const existingDm = await this.prisma.room.findFirst({
        where: {
          type: RoomType.DM,
          memberships: {
            every: {
              userId: { in: [userId, peerId] },
            },
          },
        },
        include: { memberships: true },
      });

      if (
        existingDm &&
        existingDm.memberships.length === 2 &&
        existingDm.memberships.some((m) => m.userId === userId) &&
        existingDm.memberships.some((m) => m.userId === peerId)
      ) {
        return existingDm;
      }
    }

    const room = await this.prisma.room.create({
      data: {
        type: dto.type as RoomType,
        name: dto.type === 'GROUP' ? dto.name : null,
        description: dto.type === 'GROUP' ? dto.description?.trim() ?? null : null,
        avatarUrl: dto.type === 'GROUP' ? dto.avatarUrl?.trim() ?? null : null,
        announcementMode: dto.type === 'GROUP' ? (dto.announcementMode ?? false) : false,
        slowModeSeconds: dto.type === 'GROUP' ? (dto.slowModeSeconds ?? 0) : 0,
        createdById: userId,
        memberships: {
          create: memberIds.map((memberId) => ({
            userId: memberId,
            role: memberId === userId ? MembershipRole.OWNER : MembershipRole.MEMBER,
          })),
        },
      },
      include: { memberships: true },
    });

    await this.prisma.userChatState.createMany({
      data: memberIds.map((memberId) => ({
        userId: memberId,
        roomId: room.id,
      })),
      skipDuplicates: true,
    });

    return room;
  }

  private async getMembershipOrThrow(roomId: string, userId: string) {
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: {
        room: true,
      },
    });

    if (!membership) throw new ForbiddenException('Not a room member');
    return membership;
  }

  private async assertCanManageMembers(roomId: string, actorUserId: string) {
    const membership = await this.getMembershipOrThrow(roomId, actorUserId);
    if (membership.role !== MembershipRole.OWNER && membership.role !== MembershipRole.ADMIN) {
      throw new ForbiddenException('Only room admins can manage members');
    }
    return membership;
  }

  async updateRoom(userId: string, roomId: string, dto: UpdateRoomDto) {
    const membership = await this.getMembershipOrThrow(roomId, userId);
    if (membership.room.type !== RoomType.GROUP) {
      throw new BadRequestException('Room settings are available only for group rooms');
    }
    if (membership.role !== MembershipRole.OWNER && membership.role !== MembershipRole.ADMIN) {
      throw new ForbiddenException('Only admins can update room settings');
    }

    return this.prisma.room.update({
      where: { id: roomId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl.trim() || null } : {}),
        ...(dto.announcementMode !== undefined ? { announcementMode: dto.announcementMode } : {}),
        ...(dto.slowModeSeconds !== undefined ? { slowModeSeconds: dto.slowModeSeconds } : {}),
      },
    });
  }

  async addMember(actorUserId: string, roomId: string, targetUserId: string) {
    const actor = await this.assertCanManageMembers(roomId, actorUserId);
    if (actor.room.type !== RoomType.GROUP) {
      throw new BadRequestException('Cannot add members to DM');
    }

    if (actorUserId === targetUserId) {
      throw new BadRequestException('User is already in room');
    }

    const userExists = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!userExists) throw new NotFoundException('User not found');

    const membership = await this.prisma.roomMembership.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId: targetUserId,
        },
      },
      create: {
        roomId,
        userId: targetUserId,
        role: MembershipRole.MEMBER,
      },
      update: {},
    });

    await this.prisma.userChatState.upsert({
      where: {
        userId_roomId: {
          userId: targetUserId,
          roomId,
        },
      },
      create: {
        userId: targetUserId,
        roomId,
      },
      update: {},
    });

    return membership;
  }

  async updateMemberRole(actorUserId: string, roomId: string, memberUserId: string, dto: UpdateMemberRoleDto) {
    const actor = await this.assertCanManageMembers(roomId, actorUserId);
    if (actor.room.type !== RoomType.GROUP) throw new BadRequestException('DM has no member roles');

    const target = await this.prisma.roomMembership.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: memberUserId,
        },
      },
    });
    if (!target) throw new NotFoundException('Room member not found');

    if (target.role === MembershipRole.OWNER && actor.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Only owner can change owner role');
    }
    if (dto.role === MembershipRole.OWNER && actor.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Only owner can assign owner role');
    }

    return this.prisma.roomMembership.update({
      where: { id: target.id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.canPost !== undefined ? { canPost: dto.canPost } : {}),
      },
    });
  }

  async removeMember(actorUserId: string, roomId: string, memberUserId: string) {
    const actor = await this.assertCanManageMembers(roomId, actorUserId);
    if (actor.room.type !== RoomType.GROUP) throw new BadRequestException('Cannot remove members from DM');

    if (actorUserId === memberUserId) {
      throw new BadRequestException('Use leave room endpoint to leave');
    }

    const target = await this.prisma.roomMembership.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: memberUserId,
        },
      },
    });
    if (!target) throw new NotFoundException('Room member not found');
    if (target.role === MembershipRole.OWNER) {
      throw new ForbiddenException('Cannot remove room owner');
    }

    await this.prisma.roomMembership.delete({ where: { id: target.id } });
    return { roomId, removedUserId: memberUserId };
  }

  async leaveRoom(userId: string, roomId: string) {
    const membership = await this.getMembershipOrThrow(roomId, userId);
    if (membership.room.type === RoomType.DM) {
      throw new BadRequestException('Cannot leave DM');
    }

    if (membership.role === MembershipRole.OWNER) {
      const nextAdmin = await this.prisma.roomMembership.findFirst({
        where: {
          roomId,
          userId: { not: userId },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });
      if (!nextAdmin) {
        throw new BadRequestException('Owner cannot leave an empty room');
      }
      await this.prisma.roomMembership.update({
        where: { id: nextAdmin.id },
        data: { role: MembershipRole.OWNER },
      });
    }

    await this.prisma.roomMembership.delete({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    return { roomId, left: true };
  }

  async createRoomInvite(userId: string, roomId: string, dto: CreateRoomInviteDto) {
    const membership = await this.assertCanManageMembers(roomId, userId);
    if (membership.room.type !== RoomType.GROUP) {
      throw new BadRequestException('Invites are available only for group rooms');
    }

    const code = randomBytes(10).toString('base64url');
    const expiresAt = dto.expiresInMinutes ? new Date(Date.now() + dto.expiresInMinutes * 60_000) : null;

    const invite = await this.prisma.roomInvite.create({
      data: {
        roomId,
        code,
        createdById: userId,
        maxUses: dto.maxUses,
        expiresAt,
      },
    });

    return {
      ...invite,
      inviteUrl: `/invite/${invite.code}`,
    };
  }

  async listRoomInvites(userId: string, roomId: string) {
    await this.assertCanManageMembers(roomId, userId);

    return this.prisma.roomInvite.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async joinByInviteCode(userId: string, code: string) {
    const invite = await this.prisma.roomInvite.findUnique({
      where: { code },
      include: { room: true },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.expiresAt && invite.expiresAt <= new Date()) throw new ForbiddenException('Invite expired');
    if (invite.maxUses && invite.uses >= invite.maxUses) throw new ForbiddenException('Invite max usage reached');

    if (invite.room.type !== RoomType.GROUP) {
      throw new BadRequestException('Invite target is not a group');
    }

    await this.prisma.$transaction([
      this.prisma.roomMembership.upsert({
        where: {
          roomId_userId: {
            roomId: invite.roomId,
            userId,
          },
        },
        create: {
          roomId: invite.roomId,
          userId,
          role: MembershipRole.MEMBER,
        },
        update: {},
      }),
      this.prisma.userChatState.upsert({
        where: {
          userId_roomId: {
            userId,
            roomId: invite.roomId,
          },
        },
        create: {
          userId,
          roomId: invite.roomId,
        },
        update: {},
      }),
      this.prisma.roomInvite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    return { roomId: invite.roomId, joined: true };
  }

  async isMember(roomId: string, userId: string) {
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { id: true },
    });

    return Boolean(membership);
  }

  async assertCanSend(roomId: string, userId: string) {
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: {
        room: {
          include: {
            memberships: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!membership) throw new ForbiddenException('Not a room member');

    if (
      membership.room.type === RoomType.GROUP &&
      membership.room.announcementMode &&
      (membership.role === MembershipRole.MEMBER || !membership.canPost)
    ) {
      throw new ForbiddenException('Only admins can post in announcement mode');
    }

    if (membership.room.type === RoomType.DM) {
      const peerId = membership.room.memberships.map((m) => m.userId).find((id) => id !== userId);
      if (peerId) {
        const blocked = await this.usersService.isBlockedEitherWay(userId, peerId);
        if (blocked) {
          throw new ForbiddenException('Cannot send messages to blocked user');
        }
      }
    }
  }

  async listMessages(roomId: string, userId: string, cursor?: string) {
    await this.assertCanSend(roomId, userId);

    const messages = await this.prisma.message.findMany({
      where: {
        roomId,
        deletedAt: null,
        hiddenForUsers: {
          none: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      include: {
        sender: {
          select: { id: true, username: true, displayName: true },
        },
        attachments: true,
        reactions: {
          select: {
            userId: true,
            emoji: true,
          },
        },
        starredByUsers: {
          where: { userId },
          select: { id: true },
        },
        deliveryReceipts: {
          select: { userId: true, deliveredAt: true },
        },
      },
    });

    return messages.map((message) => ({
      ...message,
      starred: message.starredByUsers.length > 0,
      reactions: this.summarizeReactions(message.reactions, userId),
    }));
  }

  async createMessage(roomId: string, userId: string, dto: SendMessageDto) {
    await this.assertCanSend(roomId, userId);

    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { room: true },
    });
    if (!membership) throw new ForbiddenException('Not a room member');

    if (membership.room.slowModeSeconds > 0 && membership.role === MembershipRole.MEMBER) {
      const since = new Date(Date.now() - membership.room.slowModeSeconds * 1000);
      const lastOwnMessage = await this.prisma.message.findFirst({
        where: {
          roomId,
          senderId: userId,
          createdAt: { gte: since },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (lastOwnMessage) {
        throw new ForbiddenException(`Slow mode active. Wait ${membership.room.slowModeSeconds}s before sending.`);
      }
    }

    const kind = (dto.kind as MessageKind | undefined) ?? MessageKind.TEXT;
    const body = dto.body?.trim() ?? null;
    const hasAttachments = (dto.attachmentIds?.length ?? 0) > 0;
    if (!body && !hasAttachments) {
      throw new BadRequestException('Message body or attachments required');
    }
    const mediaKinds = new Set<MessageKind>([
      MessageKind.IMAGE,
      MessageKind.VIDEO,
      MessageKind.AUDIO,
      MessageKind.VOICE,
      MessageKind.FILE,
    ]);
    if (mediaKinds.has(kind) && !hasAttachments) {
      throw new BadRequestException(`${kind} messages require attachments`);
    }

    if (dto.replyToId) {
      const replyExists = await this.prisma.message.findFirst({
        where: {
          id: dto.replyToId,
          roomId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!replyExists) {
        throw new NotFoundException('replyTo message not found');
      }
    }

    if (dto.forwardFromMessageId) {
      const source = await this.prisma.message.findFirst({
        where: {
          id: dto.forwardFromMessageId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!source) throw new NotFoundException('Forward source message not found');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          roomId,
          senderId: userId,
          kind,
          body,
          replyToId: dto.replyToId,
          forwardedFromId: dto.forwardFromMessageId,
          clientMsgId: dto.clientMsgId,
        },
      });

      if (dto.attachmentIds?.length) {
        const updated = await tx.attachment.updateMany({
          where: {
            id: { in: dto.attachmentIds },
            uploadedById: userId,
            scanStatus: 'CLEAN',
            messageId: null,
          },
          data: { messageId: created.id },
        });
        if (updated.count !== dto.attachmentIds.length) {
          throw new BadRequestException('Some attachments are invalid or not clean');
        }
      }

      const recipients = await tx.roomMembership.findMany({
        where: {
          roomId,
          userId: { not: userId },
        },
        select: { userId: true },
      });

      if (recipients.length) {
        await tx.messageDeliveryReceipt.createMany({
          data: recipients.map((recipient) => ({
            messageId: created.id,
            userId: recipient.userId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.room.update({
        where: { id: roomId },
        data: { lastMessageAt: created.createdAt },
      });

      return tx.message.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          sender: {
            select: { id: true, username: true, displayName: true },
          },
          attachments: true,
          reactions: { select: { userId: true, emoji: true } },
          starredByUsers: { where: { userId }, select: { id: true } },
          deliveryReceipts: { select: { userId: true, deliveredAt: true } },
        },
      });
    });

    return {
      ...message,
      starred: message.starredByUsers.length > 0,
      reactions: this.summarizeReactions(message.reactions, userId),
    };
  }

  async editMessage(roomId: string, userId: string, messageId: string, body: string) {
    await this.assertCanSend(roomId, userId);
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('Message body is required');
    }

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        roomId,
        deletedAt: null,
      },
      select: {
        id: true,
        senderId: true,
      },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Can only edit your own message');

    return this.prisma.message.update({
      where: { id: message.id },
      data: {
        body: trimmed,
        editedAt: new Date(),
      },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true },
        },
      },
    });
  }

  async deleteMessage(roomId: string, userId: string, messageId: string) {
    await this.assertCanSend(roomId, userId);

    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException('Not authorized');

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        roomId,
        deletedAt: null,
      },
      select: {
        id: true,
        senderId: true,
      },
    });

    if (!message) throw new NotFoundException('Message not found');

    const canModerate = membership.role === MembershipRole.OWNER || membership.role === MembershipRole.ADMIN;
    if (message.senderId !== userId && !canModerate) {
      throw new ForbiddenException('Cannot delete this message');
    }

    const deletedAt = new Date();
    await this.prisma.message.update({
      where: { id: message.id },
      data: {
        body: null,
        bodyJson: Prisma.JsonNull,
        deletedAt,
      },
    });

    return { id: message.id, roomId, deletedAt: deletedAt.toISOString() };
  }

  async deleteMessageForMe(roomId: string, userId: string, messageId: string) {
    await this.assertCanSend(roomId, userId);

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        roomId,
      },
      select: { id: true },
    });
    if (!message) throw new NotFoundException('Message not found');

    await this.prisma.messageHidden.upsert({
      where: {
        userId_messageId: {
          userId,
          messageId: message.id,
        },
      },
      create: {
        userId,
        messageId: message.id,
      },
      update: {},
    });

    return { roomId, messageId, deletedForMe: true };
  }

  async forwardMessage(roomId: string, userId: string, sourceMessageId: string, dto: ForwardMessageDto) {
    await this.assertCanSend(roomId, userId);
    await this.assertCanSend(dto.targetRoomId, userId);

    const source = await this.prisma.message.findFirst({
      where: {
        id: sourceMessageId,
        roomId,
        deletedAt: null,
      },
      include: {
        attachments: {
          select: { id: true },
        },
      },
    });
    if (!source) throw new NotFoundException('Source message not found');

    const attachmentIds = source.attachments.map((a) => a.id);
    return this.createMessage(dto.targetRoomId, userId, {
      kind: source.kind as MessageKindDto,
      body: dto.bodyOverride ?? source.body ?? undefined,
      replyToId: undefined,
      clientMsgId: undefined,
      forwardFromMessageId: source.id,
      attachmentIds,
    });
  }

  async starMessage(roomId: string, userId: string, messageId: string) {
    await this.assertCanSend(roomId, userId);

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, roomId, deletedAt: null },
      select: { id: true },
    });
    if (!message) throw new NotFoundException('Message not found');

    await this.prisma.starredMessage.upsert({
      where: {
        userId_messageId: {
          userId,
          messageId,
        },
      },
      create: {
        userId,
        messageId,
      },
      update: {},
    });

    return { roomId, messageId, starred: true };
  }

  async unstarMessage(roomId: string, userId: string, messageId: string) {
    await this.assertCanSend(roomId, userId);
    await this.prisma.starredMessage.deleteMany({
      where: {
        userId,
        messageId,
      },
    });
    return { roomId, messageId, starred: false };
  }

  async listStarredMessages(roomId: string, userId: string) {
    await this.assertCanSend(roomId, userId);
    return this.prisma.starredMessage.findMany({
      where: {
        userId,
        message: {
          roomId,
          deletedAt: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        message: {
          include: {
            sender: {
              select: { id: true, username: true, displayName: true },
            },
            attachments: true,
          },
        },
      },
      take: 100,
    });
  }

  async setRoomArchiveState(userId: string, roomId: string, isArchived: boolean) {
    const member = await this.isMember(roomId, userId);
    if (!member) throw new ForbiddenException('Not authorized');

    const state = await this.prisma.userChatState.upsert({
      where: {
        userId_roomId: {
          userId,
          roomId,
        },
      },
      create: {
        userId,
        roomId,
        isArchived,
      },
      update: {
        isArchived,
      },
    });

    return { roomId, isArchived: state.isArchived };
  }

  async setRoomPinState(userId: string, roomId: string, isPinned: boolean) {
    const member = await this.isMember(roomId, userId);
    if (!member) throw new ForbiddenException('Not authorized');

    let pinOrder: number | null = null;
    if (isPinned) {
      const maxPinned = await this.prisma.userChatState.aggregate({
        where: {
          userId,
          isPinned: true,
        },
        _max: {
          pinOrder: true,
        },
      });
      pinOrder = (maxPinned._max.pinOrder ?? 0) + 1;
    }
    const state = await this.prisma.userChatState.upsert({
      where: {
        userId_roomId: {
          userId,
          roomId,
        },
      },
      create: {
        userId,
        roomId,
        isPinned,
        pinOrder,
      },
      update: {
        isPinned,
        pinOrder,
      },
    });

    return { roomId, isPinned: state.isPinned, pinOrder: state.pinOrder };
  }

  async searchMessages(
    userId: string,
    params: {
      query?: string;
      roomId?: string;
      kind?: string;
    },
  ) {
    const query = params.query?.trim();
    const kind = params.kind?.trim().toUpperCase();

    const memberships = await this.prisma.roomMembership.findMany({
      where: { userId },
      select: { roomId: true },
    });
    const roomIds = memberships.map((m) => m.roomId);
    if (!roomIds.length) return [];

    return this.prisma.message.findMany({
      where: {
        roomId: params.roomId ? params.roomId : { in: roomIds },
        deletedAt: null,
        hiddenForUsers: {
          none: { userId },
        },
        ...(query
          ? {
              OR: [
                { body: { contains: query, mode: 'insensitive' } },
                { sender: { is: { username: { contains: query, mode: 'insensitive' } } } },
                { sender: { is: { displayName: { contains: query, mode: 'insensitive' } } } },
              ],
            }
          : {}),
        ...(kind ? { kind: kind as MessageKind } : {}),
      },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true },
        },
        attachments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }

  async addReaction(roomId: string, userId: string, messageId: string, emoji: string) {
    await this.assertCanSend(roomId, userId);
    const normalized = emoji.trim();
    if (!normalized || normalized.length > 16) {
      throw new BadRequestException('Invalid emoji');
    }

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        roomId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!message) throw new NotFoundException('Message not found');

    await this.prisma.messageReaction.createMany({
      data: [{ messageId: message.id, userId, emoji: normalized }],
      skipDuplicates: true,
    });

    return this.getMessageReactions(roomId, userId, message.id);
  }

  async removeReaction(roomId: string, userId: string, messageId: string, emoji: string) {
    await this.assertCanSend(roomId, userId);
    const normalized = emoji.trim();
    if (!normalized || normalized.length > 16) {
      throw new BadRequestException('Invalid emoji');
    }

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        roomId,
      },
      select: { id: true },
    });

    if (!message) throw new NotFoundException('Message not found');

    await this.prisma.messageReaction.deleteMany({
      where: {
        messageId: message.id,
        userId,
        emoji: normalized,
      },
    });

    return this.getMessageReactions(roomId, userId, message.id);
  }

  async getMessageReactions(roomId: string, userId: string, messageId: string) {
    await this.assertCanSend(roomId, userId);

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        roomId,
      },
      select: {
        id: true,
        reactions: {
          select: { userId: true, emoji: true },
        },
      },
    });

    if (!message) throw new NotFoundException('Message not found');

    return {
      messageId: message.id,
      roomId,
      reactions: this.summarizeReactions(message.reactions, userId),
    };
  }

  async markRead(roomId: string, userId: string, messageId: string) {
    const isMember = await this.isMember(roomId, userId);
    if (!isMember) throw new ForbiddenException('Not authorized');

    const message = await this.prisma.message.findUnique({ where: { id: messageId }, select: { id: true } });
    if (!message) throw new NotFoundException('Message not found');

    await this.prisma.messageDeliveryReceipt.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      create: {
        messageId,
        userId,
      },
      update: {
        deliveredAt: new Date(),
      },
    });

    return this.prisma.messageReadReceipt.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      create: {
        messageId,
        userId,
      },
      update: {
        readAt: new Date(),
      },
    });
  }

  async markAllRead(roomId: string, userId: string) {
    const isMember = await this.isMember(roomId, userId);
    if (!isMember) throw new ForbiddenException('Not authorized');

    const unread = await this.prisma.message.findMany({
      where: {
        roomId,
        senderId: { not: userId },
        deletedAt: null,
        readReceipts: {
          none: { userId },
        },
      },
      select: { id: true },
      take: 500,
    });

    if (!unread.length) {
      return { roomId, marked: 0 };
    }

    await this.prisma.messageReadReceipt.createMany({
      data: unread.map((msg) => ({
        messageId: msg.id,
        userId,
      })),
      skipDuplicates: true,
    });

    await this.prisma.messageDeliveryReceipt.createMany({
      data: unread.map((msg) => ({
        messageId: msg.id,
        userId,
      })),
      skipDuplicates: true,
    });

    return { roomId, marked: unread.length };
  }

  private summarizeReactions(
    reactions: Array<{ userId: string; emoji: string }>,
    requesterUserId: string,
  ) {
    const summaryMap = new Map<string, { emoji: string; count: number; reacted: boolean }>();

    for (const reaction of reactions) {
      const existing = summaryMap.get(reaction.emoji);
      if (existing) {
        existing.count += 1;
        if (reaction.userId === requesterUserId) {
          existing.reacted = true;
        }
      } else {
        summaryMap.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          reacted: reaction.userId === requesterUserId,
        });
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
  }
}

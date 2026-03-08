import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { ReportUserDto } from './dto/report-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        statusMessage: true,
        role: true,
        createdAt: true,
        lastSeenAt: true,
        hideLastSeen: true,
        hideProfilePhoto: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio.trim() } : {}),
        ...(dto.statusMessage !== undefined ? { statusMessage: dto.statusMessage.trim() } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl.trim() } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        statusMessage: true,
        updatedAt: true,
      },
    });
  }

  async searchUsers(userId: string, query?: string) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const q = query.trim();

    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: 20,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        statusMessage: true,
        lastSeenAt: true,
        hideLastSeen: true,
        hideProfilePhoto: true,
      },
      orderBy: [{ displayName: 'asc' }],
    });

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.hideProfilePhoto ? null : u.avatarUrl,
      statusMessage: u.statusMessage,
      lastSeenAt: u.hideLastSeen ? null : u.lastSeenAt,
    }));
  }

  async listBlockedUsers(userId: string) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            statusMessage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      blockedAt: row.createdAt,
      user: row.blocked,
    }));
  }

  async listContacts(userId: string) {
    const contacts = await this.prisma.userContact.findMany({
      where: { ownerId: userId },
      include: {
        contact: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            statusMessage: true,
            lastSeenAt: true,
          },
        },
      },
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
    });

    return contacts.map((contact) => ({
      id: contact.id,
      contactUserId: contact.contactUserId,
      alias: contact.alias,
      note: contact.note,
      isFavorite: contact.isFavorite,
      isMuted: contact.isMuted,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      user: contact.contact,
    }));
  }

  async addContact(ownerId: string, contactUserId: string) {
    if (ownerId === contactUserId) {
      throw new BadRequestException('Cannot add yourself as a contact');
    }

    const userExists = await this.prisma.user.findUnique({
      where: { id: contactUserId },
      select: { id: true },
    });
    if (!userExists) throw new NotFoundException('Contact user not found');

    const blocked = await this.isBlockedEitherWay(ownerId, contactUserId);
    if (blocked) {
      throw new ForbiddenException('Cannot add contact due to block relationship');
    }

    const contact = await this.prisma.userContact.upsert({
      where: {
        ownerId_contactUserId: {
          ownerId,
          contactUserId,
        },
      },
      create: {
        ownerId,
        contactUserId,
      },
      update: {},
      include: {
        contact: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            statusMessage: true,
            lastSeenAt: true,
          },
        },
      },
    });

    return {
      id: contact.id,
      contactUserId: contact.contactUserId,
      alias: contact.alias,
      note: contact.note,
      isFavorite: contact.isFavorite,
      isMuted: contact.isMuted,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      user: contact.contact,
    };
  }

  async updateContact(ownerId: string, contactUserId: string, dto: UpdateContactDto) {
    const existing = await this.prisma.userContact.findUnique({
      where: {
        ownerId_contactUserId: {
          ownerId,
          contactUserId,
        },
      },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Contact not found');

    return this.prisma.userContact.update({
      where: { id: existing.id },
      data: {
        ...(dto.alias !== undefined ? { alias: dto.alias.trim() || null } : {}),
        ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
        ...(dto.isFavorite !== undefined ? { isFavorite: dto.isFavorite } : {}),
        ...(dto.isMuted !== undefined ? { isMuted: dto.isMuted } : {}),
      },
      include: {
        contact: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            statusMessage: true,
            lastSeenAt: true,
          },
        },
      },
    });
  }

  async removeContact(ownerId: string, contactUserId: string) {
    await this.prisma.userContact.deleteMany({
      where: {
        ownerId,
        contactUserId,
      },
    });

    return { contactUserId, removed: true };
  }

  async getPrivacy(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hideLastSeen: true, hideProfilePhoto: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updatePrivacy(userId: string, dto: UpdatePrivacyDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.hideLastSeen !== undefined ? { hideLastSeen: dto.hideLastSeen } : {}),
        ...(dto.hideProfilePhoto !== undefined ? { hideProfilePhoto: dto.hideProfilePhoto } : {}),
      },
      select: {
        hideLastSeen: true,
        hideProfilePhoto: true,
        updatedAt: true,
      },
    });
  }

  async reportUser(reporterId: string, reportedId: string, dto: ReportUserDto) {
    if (reporterId === reportedId) {
      throw new BadRequestException('Cannot report yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: reportedId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Target user not found');

    await this.prisma.auditLog.create({
      data: {
        actorUserId: reporterId,
        action: 'USER_REPORTED',
        entityType: 'USER',
        entityId: reportedId,
        severity: 'SECURITY',
        metadata: {
          reason: dto.reason,
          details: dto.details ?? null,
        },
      },
    });

    return { reportedId, status: 'REPORTED' as const };
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const exists = await this.prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Target user not found');

    await this.prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
      create: {
        blockerId,
        blockedId,
      },
      update: {},
    });

    return { blockedId, blocked: true };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({
      where: {
        blockerId,
        blockedId,
      },
    });

    return { blockedId, blocked: false };
  }

  async isBlockedEitherWay(userA: string, userB: string) {
    const count = await this.prisma.userBlock.count({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
    });

    return count > 0;
  }
}

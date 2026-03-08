import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateBotDto, UpdateBotDto, CreateBotTokenDto } from './dto/bot.dto';

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a bot account owned by the given user.
   * Bots share the User table with is_bot=true.
   */
  async createBot(ownerId: string, dto: CreateBotDto) {
    const username = dto.username.toLowerCase().trim();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { email: `${username}@bot.local` }] },
    });
    if (existing) {
      throw new BadRequestException('Bot username already taken');
    }

    // Bots use a placeholder password hash (they authenticate via bot tokens)
    const passwordHash = createHash('sha256').update(randomBytes(64)).digest('hex');

    const bot = await this.prisma.user.create({
      data: {
        username,
        email: `${username}@bot.local`,
        displayName: dto.displayName.trim(),
        passwordHash,
        bio: dto.bio?.trim(),
        isBot: true,
        botOwnerId: ownerId,
        botPermissions: dto.botPermissions ?? [],
        botWebhookUrl: dto.botWebhookUrl,
        botPublic: dto.botPublic ?? false,
        botDescription: dto.botDescription?.trim(),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        isBot: true,
        botOwnerId: true,
        botPermissions: true,
        botWebhookUrl: true,
        botPublic: true,
        botDescription: true,
        createdAt: true,
      },
    });

    // Generate a default bot token
    const token = await this.generateBotToken(bot.id, { name: 'default' });

    return { ...bot, token: token.plainToken };
  }

  async updateBot(ownerId: string, botId: string, dto: UpdateBotDto) {
    await this.assertBotOwner(ownerId, botId);

    return this.prisma.user.update({
      where: { id: botId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio?.trim() } : {}),
        ...(dto.botDescription !== undefined ? { botDescription: dto.botDescription?.trim() } : {}),
        ...(dto.botWebhookUrl !== undefined ? { botWebhookUrl: dto.botWebhookUrl } : {}),
        ...(dto.botPublic !== undefined ? { botPublic: dto.botPublic } : {}),
        ...(dto.botPermissions !== undefined ? { botPermissions: dto.botPermissions } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        isBot: true,
        botPermissions: true,
        botWebhookUrl: true,
        botPublic: true,
        botDescription: true,
        updatedAt: true,
      },
    });
  }

  async deleteBot(ownerId: string, botId: string) {
    await this.assertBotOwner(ownerId, botId);
    await this.prisma.user.update({
      where: { id: botId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true, botId };
  }

  async getBot(botId: string) {
    const bot = await this.prisma.user.findFirst({
      where: { id: botId, isBot: true, deletedAt: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        isBot: true,
        botOwnerId: true,
        botPermissions: true,
        botPublic: true,
        botDescription: true,
        createdAt: true,
        botCommands: { where: { isEnabled: true } },
        voiceRoomMemberships: {
          include: { voiceRoom: { select: { id: true, name: true } } },
        },
      },
    });
    if (!bot) throw new NotFoundException('Bot not found');
    return bot;
  }

  async listOwnedBots(ownerId: string) {
    return this.prisma.user.findMany({
      where: { botOwnerId: ownerId, isBot: true, deletedAt: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isBot: true,
        botPublic: true,
        botDescription: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPublicBots() {
    return this.prisma.user.findMany({
      where: { isBot: true, botPublic: true, deletedAt: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        botDescription: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Generate a new bot token. Returns plaintext token once — it cannot be retrieved again.
   */
  async generateBotToken(botId: string, dto: CreateBotTokenDto) {
    const bot = await this.prisma.user.findFirst({
      where: { id: botId, isBot: true, deletedAt: null },
    });
    if (!bot) throw new NotFoundException('Bot not found');

    const plainToken = `qbot_${randomBytes(32).toString('hex')}`;
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');

    const record = await this.prisma.botToken.create({
      data: {
        botId,
        tokenHash,
        name: dto.name ?? 'default',
        scopes: dto.scopes ?? [],
      },
      select: { id: true, name: true, scopes: true, createdAt: true },
    });

    return { ...record, plainToken };
  }

  async revokeBotToken(ownerId: string, tokenId: string) {
    const token = await this.prisma.botToken.findUnique({
      where: { id: tokenId },
      include: { bot: { select: { botOwnerId: true } } },
    });
    if (!token) throw new NotFoundException('Token not found');
    if (token.bot.botOwnerId !== ownerId) throw new ForbiddenException('Not the bot owner');

    await this.prisma.botToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
    return { revoked: true, tokenId };
  }

  async listBotTokens(ownerId: string, botId: string) {
    await this.assertBotOwner(ownerId, botId);
    return this.prisma.botToken.findMany({
      where: { botId, revokedAt: null },
      select: { id: true, name: true, scopes: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Authenticate a bot by its token. Returns the bot user if valid.
   */
  async authenticateByToken(plainToken: string) {
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');

    const record = await this.prisma.botToken.findUnique({
      where: { tokenHash },
      include: {
        bot: {
          select: {
            id: true,
            username: true,
            displayName: true,
            isBot: true,
            botPermissions: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!record || record.revokedAt || record.bot.deletedAt) {
      return null;
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      return null;
    }

    // Update last used
    await this.prisma.botToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      bot: record.bot,
      scopes: record.scopes,
    };
  }

  /** Add a bot to a room as a member */
  async addBotToRoom(botId: string, roomId: string) {
    const bot = await this.prisma.user.findFirst({
      where: { id: botId, isBot: true, deletedAt: null },
    });
    if (!bot) throw new NotFoundException('Bot not found');

    const existing = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId: botId } },
    });
    if (existing) return existing;

    return this.prisma.roomMembership.create({
      data: { roomId, userId: botId, role: 'MEMBER' },
    });
  }

  /** Remove a bot from a room */
  async removeBotFromRoom(botId: string, roomId: string) {
    await this.prisma.roomMembership.deleteMany({
      where: { roomId, userId: botId },
    });
    return { removed: true };
  }

  private async assertBotOwner(ownerId: string, botId: string) {
    const bot = await this.prisma.user.findFirst({
      where: { id: botId, isBot: true, deletedAt: null },
      select: { botOwnerId: true },
    });
    if (!bot) throw new NotFoundException('Bot not found');
    if (bot.botOwnerId !== ownerId) {
      throw new ForbiddenException('You do not own this bot');
    }
  }
}

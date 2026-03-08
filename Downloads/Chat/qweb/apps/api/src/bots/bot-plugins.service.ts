import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateBotPluginDto } from './dto/bot.dto';

@Injectable()
export class BotPluginsService {
  constructor(private readonly prisma: PrismaService) {}

  async registerPlugin(ownerId: string, botId: string, dto: CreateBotPluginDto) {
    await this.assertOwner(ownerId, botId);

    return this.prisma.botPlugin.create({
      data: {
        botId,
        name: dto.name.trim(),
        version: dto.version ?? '1.0.0',
        description: dto.description?.trim(),
        config: (dto.config ?? undefined) as Prisma.InputJsonValue | undefined,
        commands: dto.commands ?? [],
        events: dto.events ?? [],
        permissions: dto.permissions ?? [],
      },
    });
  }

  async listPlugins(botId: string) {
    return this.prisma.botPlugin.findMany({
      where: { botId, isEnabled: true },
      orderBy: { name: 'asc' },
    });
  }

  async removePlugin(ownerId: string, botId: string, pluginName: string) {
    await this.assertOwner(ownerId, botId);
    await this.prisma.botPlugin.deleteMany({
      where: { botId, name: pluginName },
    });
    return { deleted: true };
  }

  async togglePlugin(ownerId: string, botId: string, pluginName: string, isEnabled: boolean) {
    await this.assertOwner(ownerId, botId);

    const plugin = await this.prisma.botPlugin.findUnique({
      where: { botId_name: { botId, name: pluginName } },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');

    return this.prisma.botPlugin.update({
      where: { id: plugin.id },
      data: { isEnabled },
    });
  }

  /**
   * Get all enabled plugins for a bot, filtering by subscribed events.
   */
  async getPluginsForEvent(botId: string, eventType: string) {
    return this.prisma.botPlugin.findMany({
      where: {
        botId,
        isEnabled: true,
        events: { has: eventType },
      },
    });
  }

  private async assertOwner(ownerId: string, botId: string) {
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

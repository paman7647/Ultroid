import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateBotCommandDto, UpdateBotCommandDto } from './dto/bot.dto';

@Injectable()
export class BotCommandsService {
  constructor(private readonly prisma: PrismaService) {}

  async registerCommand(ownerId: string, botId: string, dto: CreateBotCommandDto) {
    await this.assertOwner(ownerId, botId);

    const name = dto.name.toLowerCase().trim();
    return this.prisma.botCommand.create({
      data: {
        botId,
        name,
        description: dto.description,
        usage: dto.usage,
        arguments: (dto.arguments ?? undefined) as Prisma.InputJsonValue | undefined,
        permissions: dto.permissions ?? [],
      },
    });
  }

  async updateCommand(ownerId: string, botId: string, commandName: string, dto: UpdateBotCommandDto) {
    await this.assertOwner(ownerId, botId);

    const command = await this.prisma.botCommand.findUnique({
      where: { botId_name: { botId, name: commandName } },
    });
    if (!command) throw new NotFoundException('Command not found');

    return this.prisma.botCommand.update({
      where: { id: command.id },
      data: {
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.usage !== undefined ? { usage: dto.usage } : {}),
        ...(dto.arguments !== undefined ? { arguments: dto.arguments as Prisma.InputJsonValue } : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
      },
    });
  }

  async deleteCommand(ownerId: string, botId: string, commandName: string) {
    await this.assertOwner(ownerId, botId);
    await this.prisma.botCommand.deleteMany({
      where: { botId, name: commandName },
    });
    return { deleted: true };
  }

  async listCommands(botId: string) {
    return this.prisma.botCommand.findMany({
      where: { botId, isEnabled: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Parse a command from a message body. Returns { botId, command, args } if matched.
   * Format: /command or /command arg1 arg2
   */
  async parseCommand(roomId: string, body: string) {
    if (!body.startsWith('/') && !body.startsWith('!')) return null;

    const prefix = body[0];
    const parts = body.slice(1).split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    if (!commandName) return null;

    const args = parts.slice(1);

    // Find all bots in this room with matching commands
    const memberships = await this.prisma.roomMembership.findMany({
      where: { roomId, user: { isBot: true, deletedAt: null } },
      include: {
        user: {
          include: {
            botCommands: {
              where: { name: commandName, isEnabled: true },
            },
          },
        },
      },
    });

    for (const membership of memberships) {
      const matchedCommand = membership.user.botCommands[0];
      if (matchedCommand) {
        return {
          botId: membership.user.id,
          botUsername: membership.user.username,
          command: matchedCommand,
          args,
          rawArgs: args.join(' '),
        };
      }
    }

    return null;
  }

  /**
   * Get autocomplete suggestions for a partial command in a room.
   */
  async getAutocompleteSuggestions(roomId: string, partial: string) {
    const prefix = partial.startsWith('/') || partial.startsWith('!') ? partial.slice(1) : partial;

    const memberships = await this.prisma.roomMembership.findMany({
      where: { roomId, user: { isBot: true, deletedAt: null } },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            botCommands: {
              where: {
                isEnabled: true,
                name: { startsWith: prefix.toLowerCase() },
              },
              take: 10,
            },
          },
        },
      },
    });

    const suggestions: Array<{
      command: string;
      description: string | null;
      usage: string | null;
      botId: string;
      botName: string;
    }> = [];

    for (const m of memberships) {
      for (const cmd of m.user.botCommands) {
        suggestions.push({
          command: cmd.name,
          description: cmd.description,
          usage: cmd.usage,
          botId: m.user.id,
          botName: m.user.displayName,
        });
      }
    }

    return suggestions;
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

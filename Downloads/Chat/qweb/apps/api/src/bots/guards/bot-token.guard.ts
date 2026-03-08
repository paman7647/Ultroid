import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { BotsService } from '../bots.service';

/**
 * Guard that authenticates bot requests via Bot-Token header.
 * Sets request.user = { id, username, role: 'BOT', isBot: true, scopes }
 */
@Injectable()
export class BotTokenGuard implements CanActivate {
  constructor(private readonly botsService: BotsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    const token = this.extractBotToken(request);

    if (!token) throw new UnauthorizedException('Missing bot token');

    const result = await this.botsService.authenticateByToken(token);
    if (!result) throw new UnauthorizedException('Invalid or expired bot token');

    request.user = {
      id: result.bot.id,
      username: result.bot.username,
      role: 'BOT',
      jti: `bot:${result.bot.id}`,
      isBot: true,
      botPermissions: result.bot.botPermissions,
      scopes: result.scopes,
    };

    return true;
  }

  private extractBotToken(request: Request): string | null {
    const header = request.headers['bot-token'] as string | undefined;
    if (header) return header;

    const auth = request.headers.authorization;
    if (auth?.startsWith('Bot ')) return auth.slice('Bot '.length);

    return null;
  }
}

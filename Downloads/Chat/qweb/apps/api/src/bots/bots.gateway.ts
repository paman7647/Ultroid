import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
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
import { BotEventService } from './bot-event.service';
import { BotCommandsService } from './bot-commands.service';

/**
 * WebSocket gateway for bot interactions.
 * Namespace: /bots
 */
@WebSocketGateway({
  namespace: '/bots',
  cors: {
    origin: [process.env.CORS_ORIGIN ?? 'http://localhost:3000'],
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
export class BotGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly botEventService: BotEventService,
    private readonly commandsService: BotCommandsService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    if (this.botEventService) {
      this.botEventService.setChatServer(this.server);
    } else {
      console.warn('[BotGateway] botEventService not injected — DI metadata may be missing (tsx/esbuild limitation)');
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    const userId = await authenticateSocket(client, this.jwt);
    if (!userId) return;
    // Join user-specific and bot-specific channels
    await client.join(`user:${userId}`);
    await client.join(`bot:${userId}`);
  }

  async handleDisconnect(_client: AuthenticatedSocket) {
    // Cleanup handled by Socket.IO automatically
  }

  /**
   * Command autocomplete - returns suggestions for partial input.
   */
  @SubscribeMessage('bot:autocomplete')
  async autocomplete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; input: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const suggestions = await this.commandsService.getAutocompleteSuggestions(
      body.roomId,
      body.input,
    );

    return { event: 'bot:autocomplete:result', data: suggestions };
  }

  /**
   * Parse and dispatch a command from the chat.
   */
  @SubscribeMessage('bot:command')
  async handleCommand(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; text: string },
  ) {
    const userId = client.user?.sub;
    if (!userId) throw new WsException('UNAUTHENTICATED');

    const parsed = await this.commandsService.parseCommand(body.roomId, body.text);
    if (!parsed) {
      return { event: 'bot:command:error', data: { message: 'Unknown command' } };
    }

    // Dispatch COMMAND_RECEIVED event to the target bot
    await this.botEventService.dispatchEventToRoom(body.roomId, 'COMMAND_RECEIVED', {
      command: parsed.command.name,
      args: parsed.args,
      rawArgs: parsed.rawArgs,
      userId,
      botId: parsed.botId,
    });

    return {
      event: 'bot:command:ack',
      data: {
        command: parsed.command.name,
        botId: parsed.botId,
        botUsername: parsed.botUsername,
      },
    };
  }
}

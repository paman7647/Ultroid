import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { ChatService } from '@/chat/chat.service';
import { BotTokenGuard } from './guards/bot-token.guard';
import { BotRateLimitGuard } from './guards/bot-rate-limit.guard';
import { BotEventService, BotEvent } from './bot-event.service';
import { BotVoiceService } from './bot-voice.service';
import { BotSendMessageDto } from './dto/bot.dto';

/**
 * REST API for bots to interact with the platform.
 * Authenticated via Bot-Token header or Authorization: Bot <token>
 */
@UseGuards(BotTokenGuard, BotRateLimitGuard)
@Controller('bot-api')
export class BotApiController {
  constructor(
    private readonly chatService: ChatService,
    private readonly botEventService: BotEventService,
    private readonly botVoiceService: BotVoiceService,
  ) {}

  // ── Messaging ──

  @Post('messages')
  async sendMessage(@CurrentUser() bot: RequestUser, @Body() dto: BotSendMessageDto) {
    // Verify bot is member of the room
    await this.chatService.assertCanSend(dto.roomId, bot.id);

    const message = await this.chatService.createMessage(dto.roomId, bot.id, {
      body: dto.text,
      kind: dto.kind as any,
      replyToId: dto.replyToId,
      attachmentIds: dto.attachmentIds,
      clientMsgId: undefined,
    });

    // Emit event via WebSocket gateway
    this.botEventService.emitToRoom(dto.roomId, 'message:new', message);

    return message;
  }

  @Post('messages/:messageId/edit')
  async editMessage(
    @CurrentUser() bot: RequestUser,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() body: { roomId: string; text: string },
  ) {
    const message = await this.chatService.editMessage(body.roomId, bot.id, messageId, body.text);
    this.botEventService.emitToRoom(body.roomId, 'message:edited', {
      roomId: body.roomId,
      message,
    });
    return message;
  }

  @Post('messages/:messageId/react')
  async addReaction(
    @CurrentUser() bot: RequestUser,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() body: { roomId: string; emoji: string },
  ) {
    return this.chatService.addReaction(body.roomId, bot.id, messageId, body.emoji);
  }

  // ── Room interaction ──

  @Get('rooms')
  async listRooms(@CurrentUser() bot: RequestUser) {
    return this.chatService.listRooms(bot.id);
  }

  @Get('rooms/:roomId/messages')
  async getMessages(
    @CurrentUser() bot: RequestUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.chatService.listMessages(roomId, bot.id);
  }

  // ── Events ──

  @Post('webhooks/test')
  async testWebhook(@CurrentUser() bot: RequestUser) {
    const testEvent: BotEvent = {
      type: 'MESSAGE_CREATE',
      botId: bot.id,
      data: { test: true, message: 'Webhook test event' },
      timestamp: new Date().toISOString(),
    };
    await this.botEventService.dispatchWebhook(bot.id, testEvent);
    return { sent: true };
  }

  // ── Voice ──

  @Post('voice/join')
  async joinVoice(
    @CurrentUser() bot: RequestUser,
    @Body() body: { voiceRoomId: string },
  ) {
    return this.botVoiceService.joinVoiceChannel(bot.id, body.voiceRoomId);
  }

  @Post('voice/leave')
  async leaveVoice(
    @CurrentUser() bot: RequestUser,
    @Body() body: { voiceRoomId: string },
  ) {
    return this.botVoiceService.leaveVoiceChannel(bot.id, body.voiceRoomId);
  }

  @Post('voice/stream/start')
  async startStream(
    @CurrentUser() bot: RequestUser,
    @Body() body: { voiceRoomId: string; sourceUrl: string; source?: 'FILE' | 'URL' },
  ) {
    return this.botVoiceService.startStream({
      botId: bot.id,
      voiceRoomId: body.voiceRoomId,
      sourceUrl: body.sourceUrl,
      source: body.source ?? 'URL',
    });
  }

  @Post('voice/stream/stop')
  async stopStream(
    @CurrentUser() bot: RequestUser,
    @Body() body: { voiceRoomId: string },
  ) {
    return this.botVoiceService.stopStream(bot.id, body.voiceRoomId);
  }

  @Post('voice/stream/pause')
  async pauseStream(
    @CurrentUser() bot: RequestUser,
    @Body() body: { voiceRoomId: string },
  ) {
    return this.botVoiceService.pauseStream(bot.id, body.voiceRoomId);
  }

  @Post('voice/stream/resume')
  async resumeStream(
    @CurrentUser() bot: RequestUser,
    @Body() body: { voiceRoomId: string },
  ) {
    return this.botVoiceService.resumeStream(bot.id, body.voiceRoomId);
  }

  @Post('voice/stream/volume')
  async setVolume(
    @CurrentUser() bot: RequestUser,
    @Body() body: { voiceRoomId: string; volume: number },
  ) {
    return this.botVoiceService.setVolume(bot.id, body.voiceRoomId, body.volume);
  }
}

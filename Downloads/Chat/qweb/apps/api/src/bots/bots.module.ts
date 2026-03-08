import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { VoiceRoomsModule } from '@/voice-rooms/voice-rooms.module';
import { ChatModule } from '@/chat/chat.module';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';
import { BotApiController } from './bot-api.controller';
import { BotCommandsService } from './bot-commands.service';
import { BotPluginsService } from './bot-plugins.service';
import { BotMarketplaceController } from './bot-marketplace.controller';
import { BotMarketplaceService } from './bot-marketplace.service';
import { BotEventService } from './bot-event.service';
import { BotGateway } from './bots.gateway';
import { BotVoiceService } from './bot-voice.service';
import { BotTokenGuard } from './guards/bot-token.guard';

@Module({
  imports: [AuthModule, forwardRef(() => VoiceRoomsModule), forwardRef(() => ChatModule)],
  controllers: [BotsController, BotApiController, BotMarketplaceController],
  providers: [
    BotsService,
    BotCommandsService,
    BotPluginsService,
    BotMarketplaceService,
    BotEventService,
    BotGateway,
    BotVoiceService,
    BotTokenGuard,
  ],
  exports: [BotsService, BotEventService, BotVoiceService, BotCommandsService],
})
export class BotsModule {}

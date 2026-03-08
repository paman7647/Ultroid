import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { BotsModule } from '@/bots/bots.module';
import { VoiceRoomsController } from './voice-rooms.controller';
import { VoiceRoomsGateway } from './voice-rooms.gateway';
import { VoiceRoomsService } from './voice-rooms.service';

@Module({
  imports: [AuthModule, forwardRef(() => BotsModule)],
  providers: [VoiceRoomsService, VoiceRoomsGateway],
  controllers: [VoiceRoomsController],
  exports: [VoiceRoomsService],
})
export class VoiceRoomsModule {}

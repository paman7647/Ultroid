import { Module, Global } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { PresenceService } from './presence.service';
import { PresenceGateway } from './presence.gateway';

@Global()
@Module({
  imports: [AuthModule],
  providers: [PresenceService, PresenceGateway],
  exports: [PresenceService],
})
export class PresenceModule {}

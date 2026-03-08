import { Global, Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { MediaServerService } from './media-server.service';
import { MediaController } from './media.controller';

@Global()
@Module({
  imports: [AuthModule],
  providers: [MediaServerService],
  controllers: [MediaController],
  exports: [MediaServerService],
})
export class MediaModule {}

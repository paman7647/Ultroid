import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { EncryptionController } from './encryption.controller';
import { EncryptionService } from './encryption.service';

@Module({
  imports: [AuthModule],
  providers: [EncryptionService],
  controllers: [EncryptionController],
  exports: [EncryptionService],
})
export class EncryptionModule {}

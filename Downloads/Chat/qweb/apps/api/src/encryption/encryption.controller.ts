import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { EncryptionService } from './encryption.service';
import { PublishKeyDto, CreateSessionDto } from './dto/encryption.dto';
import { KeyAlgorithm } from '@prisma/client';

@UseGuards(AccessTokenGuard)
@Controller('encryption')
export class EncryptionController {
  constructor(private readonly encryptionService: EncryptionService) {}

  @Post('keys')
  publishKey(@CurrentUser() user: RequestUser, @Body() dto: PublishKeyDto) {
    return this.encryptionService.publishKey(user.id, dto);
  }

  @Post('keys/prekeys')
  publishPreKeys(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      algorithm: string;
      keys: Array<{ publicKey: string; signature?: string }>;
      deviceId?: string;
    },
  ) {
    return this.encryptionService.publishPreKeys(
      user.id,
      body.algorithm as KeyAlgorithm,
      body.keys,
      body.deviceId,
    );
  }

  @Get('keys/:userId/bundle')
  fetchKeyBundle(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.encryptionService.fetchKeyBundle(userId, deviceId);
  }

  @Get('keys/prekey-count')
  getPreKeyCount(
    @CurrentUser() user: RequestUser,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.encryptionService.getPreKeyCount(user.id, deviceId);
  }

  @Get('keys/:userId/devices')
  listDeviceKeys(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.encryptionService.listUserDeviceKeys(userId);
  }

  @Post('sessions')
  createSession(@CurrentUser() user: RequestUser, @Body() dto: CreateSessionDto) {
    return this.encryptionService.createSession(user.id, dto);
  }

  @Get('sessions/:peerUserId')
  getSession(
    @CurrentUser() user: RequestUser,
    @Param('peerUserId', ParseUUIDPipe) peerUserId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.encryptionService.getSession(user.id, peerUserId, deviceId);
  }
}

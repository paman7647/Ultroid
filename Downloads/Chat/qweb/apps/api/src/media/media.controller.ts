import { Controller, Post, Body, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { MediaServerService } from './media-server.service';

@Controller('media')
@UseGuards(AccessTokenGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaServerService) {}

  @Post('token')
  createToken(
    @Request() req: { user: { sub: string } },
    @Body() body: { roomName: string; canPublish?: boolean; canScreenShare?: boolean },
  ) {
    if (!this.mediaService.isAvailable) {
      return { sfu: false, turnConfig: this.mediaService.getTurnConfig() };
    }

    const token = this.mediaService.createRoomToken(body.roomName, req.user.sub, {
      canPublish: body.canPublish,
      canScreenShare: body.canScreenShare,
    });

    return { sfu: true, ...token };
  }

  @Get('ice-servers')
  getIceServers() {
    const turnConfig = this.mediaService.getTurnConfig();
    const servers: { urls: string; username?: string; credential?: string }[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    if (turnConfig) {
      servers.push(...turnConfig);
    }

    return { iceServers: servers };
  }
}

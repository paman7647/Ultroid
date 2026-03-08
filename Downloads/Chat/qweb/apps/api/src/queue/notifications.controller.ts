import { Controller, Get, Post, Body, Query, Delete, Param, UseGuards, HttpCode } from '@nestjs/common';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.getNotifications(
      user.id,
      parseInt(offset ?? '0', 10),
      parseInt(limit ?? '50', 10),
    );
  }

  @Post('read-all')
  @HttpCode(200)
  async markAllRead(@CurrentUser() user: RequestUser) {
    await this.notificationService.markAllRead(user.id);
    return { ok: true };
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(@CurrentUser() user: RequestUser, @Param('id') notificationId: string) {
    await this.notificationService.markRead(user.id, notificationId);
    return { ok: true };
  }

  @Delete()
  @HttpCode(200)
  async clearAll(@CurrentUser() user: RequestUser) {
    await this.notificationService.clearAll(user.id);
    return { ok: true };
  }

  @Post('mute/:roomId')
  @HttpCode(200)
  async muteRoom(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Body() body?: { durationSeconds?: number },
  ) {
    await this.notificationService.muteRoom(user.id, roomId, body?.durationSeconds);
    return { ok: true, roomId };
  }

  @Delete('mute/:roomId')
  @HttpCode(200)
  async unmuteRoom(@CurrentUser() user: RequestUser, @Param('roomId') roomId: string) {
    await this.notificationService.unmuteRoom(user.id, roomId);
    return { ok: true, roomId };
  }
}

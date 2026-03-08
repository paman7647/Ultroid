import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { VoiceRoomsService } from './voice-rooms.service';
import { CreateVoiceRoomDto, UpdateVoiceRoomDto } from './dto/voice-room.dto';
import { VoiceRoomType } from '@prisma/client';

@UseGuards(AccessTokenGuard)
@Controller('voice-rooms')
export class VoiceRoomsController {
  constructor(private readonly voiceRoomsService: VoiceRoomsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateVoiceRoomDto) {
    return this.voiceRoomsService.createVoiceRoom(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVoiceRoomDto,
  ) {
    return this.voiceRoomsService.updateVoiceRoom(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.voiceRoomsService.deleteVoiceRoom(user.id, id);
  }

  @Post(':id/join')
  join(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.voiceRoomsService.joinVoiceRoom(user.id, id);
  }

  @Post(':id/leave')
  leave(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.voiceRoomsService.leaveVoiceRoom(user.id, id);
  }

  @Post(':id/mute')
  toggleMute(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isMuted: boolean },
  ) {
    return this.voiceRoomsService.toggleMute(user.id, id, body.isMuted);
  }

  @Post(':id/deafen')
  toggleDeafen(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isDeafened: boolean },
  ) {
    return this.voiceRoomsService.toggleDeafen(user.id, id, body.isDeafened);
  }

  @Get()
  list(@Query('type') type?: string, @Query('roomId') roomId?: string) {
    return this.voiceRoomsService.listVoiceRooms({
      type: type as VoiceRoomType | undefined,
      roomId,
    });
  }

  @Get('me')
  getCurrentVoiceRoom(@CurrentUser() user: RequestUser) {
    return this.voiceRoomsService.getUserCurrentVoiceRoom(user.id);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.voiceRoomsService.getVoiceRoom(id);
  }
}

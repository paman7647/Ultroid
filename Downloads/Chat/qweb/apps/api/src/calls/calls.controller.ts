import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { CallsService } from './calls.service';
import { CallTypeDto, InitiateCallDto } from './dto/call.dto';
import { CallType } from '@prisma/client';

@UseGuards(AccessTokenGuard)
@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post()
  initiateCall(@CurrentUser() user: RequestUser, @Body() dto: InitiateCallDto) {
    return this.callsService.initiateCall(
      user.id,
      dto.roomId,
      dto.type as unknown as CallType,
      dto.isGroup ?? false,
    );
  }

  @Post(':callId/answer')
  answerCall(
    @CurrentUser() user: RequestUser,
    @Param('callId', ParseUUIDPipe) callId: string,
  ) {
    return this.callsService.answerCall(user.id, callId);
  }

  @Post(':callId/reject')
  rejectCall(
    @CurrentUser() user: RequestUser,
    @Param('callId', ParseUUIDPipe) callId: string,
  ) {
    return this.callsService.rejectCall(user.id, callId);
  }

  @Post(':callId/end')
  endCall(
    @CurrentUser() user: RequestUser,
    @Param('callId', ParseUUIDPipe) callId: string,
  ) {
    return this.callsService.endCall(user.id, callId);
  }

  @Post(':callId/leave')
  leaveCall(
    @CurrentUser() user: RequestUser,
    @Param('callId', ParseUUIDPipe) callId: string,
  ) {
    return this.callsService.leaveCall(user.id, callId);
  }

  @Post(':callId/mute')
  toggleMute(
    @CurrentUser() user: RequestUser,
    @Param('callId', ParseUUIDPipe) callId: string,
    @Body() body: { isMuted: boolean },
  ) {
    return this.callsService.toggleMute(user.id, callId, body.isMuted);
  }

  @Post(':callId/video')
  toggleVideo(
    @CurrentUser() user: RequestUser,
    @Param('callId', ParseUUIDPipe) callId: string,
    @Body() body: { isVideoOff: boolean },
  ) {
    return this.callsService.toggleVideo(user.id, callId, body.isVideoOff);
  }

  @Post(':callId/screen-share')
  toggleScreenShare(
    @CurrentUser() user: RequestUser,
    @Param('callId', ParseUUIDPipe) callId: string,
    @Body() body: { isScreenSharing: boolean },
  ) {
    return this.callsService.toggleScreenShare(user.id, callId, body.isScreenSharing);
  }

  @Post(':callId/hand-raise')
  toggleHandRaise(
    @CurrentUser() user: RequestUser,
    @Param('callId', ParseUUIDPipe) callId: string,
    @Body() body: { isHandRaised: boolean },
  ) {
    return this.callsService.toggleHandRaise(user.id, callId, body.isHandRaised);
  }

  @Get('history')
  getCallHistory(
    @CurrentUser() user: RequestUser,
    @Query('cursor') cursor?: string,
  ) {
    return this.callsService.getCallHistory(user.id, cursor);
  }

  @Get(':callId')
  getCall(@Param('callId', ParseUUIDPipe) callId: string) {
    return this.callsService.getCall(callId);
  }

  @Get('room/:roomId/active')
  getActiveCall(@Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.callsService.getActiveCallInRoom(roomId);
  }
}

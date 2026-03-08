import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { ChatService } from './chat.service';
import { AddRoomMemberDto } from './dto/add-room-member.dto';
import { CreateRoomInviteDto } from './dto/create-room-invite.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ToggleFlagDto } from './dto/toggle-flag.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@UseGuards(AccessTokenGuard)
@Controller('rooms')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  listRooms(@CurrentUser() user: RequestUser) {
    return this.chatService.listRooms(user.id);
  }

  @Post()
  createRoom(@CurrentUser() user: RequestUser, @Body() dto: CreateRoomDto) {
    return this.chatService.createRoom(user.id, dto);
  }

  @Patch(':roomId')
  updateRoom(
    @CurrentUser() user: RequestUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.chatService.updateRoom(user.id, roomId, dto);
  }

  @Post(':roomId/members')
  addMember(
    @CurrentUser() user: RequestUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: AddRoomMemberDto,
  ) {
    return this.chatService.addMember(user.id, roomId, dto.userId);
  }

  @Patch(':roomId/members/:memberId')
  updateMemberRole(
    @CurrentUser() user: RequestUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.chatService.updateMemberRole(user.id, roomId, memberId, dto);
  }

  @Delete(':roomId/members/:memberId')
  removeMember(
    @CurrentUser() user: RequestUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.chatService.removeMember(user.id, roomId, memberId);
  }

  @Post(':roomId/leave')
  leaveRoom(@CurrentUser() user: RequestUser, @Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.chatService.leaveRoom(user.id, roomId);
  }

  @Post(':roomId/invites')
  createInvite(
    @CurrentUser() user: RequestUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: CreateRoomInviteDto,
  ) {
    return this.chatService.createRoomInvite(user.id, roomId, dto);
  }

  @Get(':roomId/invites')
  listInvites(@CurrentUser() user: RequestUser, @Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.chatService.listRoomInvites(user.id, roomId);
  }

  @Post('join/:code')
  joinByInvite(@CurrentUser() user: RequestUser, @Param('code') code: string) {
    return this.chatService.joinByInviteCode(user.id, code);
  }

  @Get(':roomId/messages')
  listMessages(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.listMessages(roomId, user.id, cursor);
  }

  @Post(':roomId/messages')
  sendMessage(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.createMessage(roomId, user.id, dto);
  }

  @Post(':roomId/messages/:messageId/forward')
  forwardMessage(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ForwardMessageDto,
  ) {
    return this.chatService.forwardMessage(roomId, user.id, messageId, dto);
  }

  @Patch(':roomId/messages/:messageId')
  editMessage(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.chatService.editMessage(roomId, user.id, messageId, dto.body);
  }

  @Delete(':roomId/messages/:messageId')
  deleteMessage(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.chatService.deleteMessage(roomId, user.id, messageId);
  }

  @Delete(':roomId/messages/:messageId/me')
  deleteForMe(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.chatService.deleteMessageForMe(roomId, user.id, messageId);
  }

  @Delete(':roomId/messages/:messageId/everyone')
  deleteForEveryone(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.chatService.deleteMessage(roomId, user.id, messageId);
  }

  @Get(':roomId/messages/:messageId/reactions')
  listReactions(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.chatService.getMessageReactions(roomId, user.id, messageId);
  }

  @Post(':roomId/messages/:messageId/reactions')
  addReaction(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ReactMessageDto,
  ) {
    return this.chatService.addReaction(roomId, user.id, messageId, dto.emoji);
  }

  @Delete(':roomId/messages/:messageId/reactions')
  removeReaction(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Query('emoji') emoji?: string,
  ) {
    return this.chatService.removeReaction(roomId, user.id, messageId, emoji ?? '');
  }

  @Post(':roomId/messages/:messageId/star')
  starMessage(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.chatService.starMessage(roomId, user.id, messageId);
  }

  @Delete(':roomId/messages/:messageId/star')
  unstarMessage(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.chatService.unstarMessage(roomId, user.id, messageId);
  }

  @Get(':roomId/messages/starred')
  starredMessages(@CurrentUser() user: RequestUser, @Param('roomId') roomId: string) {
    return this.chatService.listStarredMessages(roomId, user.id);
  }

  @Get('messages/search')
  searchMessages(@CurrentUser() user: RequestUser, @Query('q') q?: string, @Query('kind') kind?: string) {
    return this.chatService.searchMessages(user.id, { query: q, kind });
  }

  @Get(':roomId/search/messages')
  searchMessagesInRoom(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Query('q') q?: string,
    @Query('kind') kind?: string,
  ) {
    return this.chatService.searchMessages(user.id, { query: q, roomId, kind });
  }

  @Post(':roomId/archive')
  archiveRoom(
    @CurrentUser() user: RequestUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: ToggleFlagDto,
  ) {
    return this.chatService.setRoomArchiveState(user.id, roomId, dto.value);
  }

  @Post(':roomId/pin')
  pinRoom(
    @CurrentUser() user: RequestUser,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: ToggleFlagDto,
  ) {
    return this.chatService.setRoomPinState(user.id, roomId, dto.value);
  }

  @Post(':roomId/messages/:messageId/read')
  markRead(
    @CurrentUser() user: RequestUser,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.markRead(roomId, user.id, messageId);
  }

  @Post(':roomId/read-all')
  markAllRead(@CurrentUser() user: RequestUser, @Param('roomId') roomId: string) {
    return this.chatService.markAllRead(roomId, user.id);
  }
}

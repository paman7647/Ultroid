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
import { AuthService } from '@/auth/auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { ReportUserDto } from './dto/report-user.dto';
import { UsersService } from './users.service';

@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Get('search')
  search(@CurrentUser() user: RequestUser, @Query('q') q?: string) {
    return this.usersService.searchUsers(user.id, q);
  }

  @Get('me/privacy')
  getPrivacy(@CurrentUser() user: RequestUser) {
    return this.usersService.getPrivacy(user.id);
  }

  @Patch('me/privacy')
  updatePrivacy(@CurrentUser() user: RequestUser, @Body() dto: UpdatePrivacyDto) {
    return this.usersService.updatePrivacy(user.id, dto);
  }

  @Get('blocked')
  blocked(@CurrentUser() user: RequestUser) {
    return this.usersService.listBlockedUsers(user.id);
  }

  @Post(':userId/block')
  block(@CurrentUser() user: RequestUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.usersService.blockUser(user.id, userId);
  }

  @Delete(':userId/block')
  unblock(@CurrentUser() user: RequestUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.usersService.unblockUser(user.id, userId);
  }

  @Post(':userId/report')
  reportUser(
    @CurrentUser() user: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ReportUserDto,
  ) {
    return this.usersService.reportUser(user.id, userId, dto);
  }

  @Get('contacts')
  contacts(@CurrentUser() user: RequestUser) {
    return this.usersService.listContacts(user.id);
  }

  @Post('contacts/:userId')
  addContact(@CurrentUser() user: RequestUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.usersService.addContact(user.id, userId);
  }

  @Patch('contacts/:userId')
  updateContact(
    @CurrentUser() user: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.usersService.updateContact(user.id, userId, dto);
  }

  @Delete('contacts/:userId')
  removeContact(@CurrentUser() user: RequestUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.usersService.removeContact(user.id, userId);
  }

  @Get('security/devices')
  listDevices(@CurrentUser() user: RequestUser) {
    return this.authService.listDevices(user.id);
  }

  @Delete('security/devices/:deviceId')
  revokeDevice(@CurrentUser() user: RequestUser, @Param('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.authService.revokeDevice(user.id, deviceId);
  }

  @Get('security/sessions')
  listSessions(@CurrentUser() user: RequestUser) {
    return this.authService.listSessions(user.id);
  }

  @Delete('security/sessions/:sessionId')
  revokeSession(@CurrentUser() user: RequestUser, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.authService.revokeSession(user.id, sessionId);
  }

  @Post('security/logout-all')
  logoutAll(@CurrentUser() user: RequestUser) {
    return this.authService.logoutAll(user.id, user.jti);
  }
}

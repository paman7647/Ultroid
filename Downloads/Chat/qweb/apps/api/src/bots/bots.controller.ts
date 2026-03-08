import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { BotsService } from './bots.service';
import { BotCommandsService } from './bot-commands.service';
import { BotPluginsService } from './bot-plugins.service';
import {
  CreateBotDto,
  UpdateBotDto,
  CreateBotTokenDto,
  CreateBotCommandDto,
  UpdateBotCommandDto,
  CreateBotPluginDto,
} from './dto/bot.dto';

/**
 * Bot developer portal: create, manage, and configure bots.
 * All endpoints require a human user's JWT.
 */
@UseGuards(AccessTokenGuard)
@Controller('bots')
export class BotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly commandsService: BotCommandsService,
    private readonly pluginsService: BotPluginsService,
  ) {}

  // ── Bot CRUD ──

  @Post()
  createBot(@CurrentUser() user: RequestUser, @Body() dto: CreateBotDto) {
    return this.botsService.createBot(user.id, dto);
  }

  @Patch(':botId')
  updateBot(
    @CurrentUser() user: RequestUser,
    @Param('botId', ParseUUIDPipe) botId: string,
    @Body() dto: UpdateBotDto,
  ) {
    return this.botsService.updateBot(user.id, botId, dto);
  }

  @Delete(':botId')
  deleteBot(
    @CurrentUser() user: RequestUser,
    @Param('botId', ParseUUIDPipe) botId: string,
  ) {
    return this.botsService.deleteBot(user.id, botId);
  }

  @Get('me')
  listOwnedBots(@CurrentUser() user: RequestUser) {
    return this.botsService.listOwnedBots(user.id);
  }

  @Get('public')
  listPublicBots() {
    return this.botsService.listPublicBots();
  }

  @Get(':botId')
  getBot(@Param('botId', ParseUUIDPipe) botId: string) {
    return this.botsService.getBot(botId);
  }

  // ── Bot Tokens ──

  @Post(':botId/tokens')
  generateToken(
    @CurrentUser() user: RequestUser,
    @Param('botId', ParseUUIDPipe) botId: string,
    @Body() dto: CreateBotTokenDto,
  ) {
    return this.botsService.generateBotToken(botId, dto);
  }

  @Get(':botId/tokens')
  listTokens(
    @CurrentUser() user: RequestUser,
    @Param('botId', ParseUUIDPipe) botId: string,
  ) {
    return this.botsService.listBotTokens(user.id, botId);
  }

  @Delete('tokens/:tokenId')
  revokeToken(
    @CurrentUser() user: RequestUser,
    @Param('tokenId', ParseUUIDPipe) tokenId: string,
  ) {
    return this.botsService.revokeBotToken(user.id, tokenId);
  }

  // ── Bot Commands ──

  @Post(':botId/commands')
  registerCommand(
    @CurrentUser() user: RequestUser,
    @Param('botId', ParseUUIDPipe) botId: string,
    @Body() dto: CreateBotCommandDto,
  ) {
    return this.commandsService.registerCommand(user.id, botId, dto);
  }

  @Patch(':botId/commands/:commandName')
  updateCommand(
    @CurrentUser() user: RequestUser,
    @Param('botId', ParseUUIDPipe) botId: string,
    @Param('commandName') commandName: string,
    @Body() dto: UpdateBotCommandDto,
  ) {
    return this.commandsService.updateCommand(user.id, botId, commandName, dto);
  }

  @Delete(':botId/commands/:commandName')
  deleteCommand(
    @CurrentUser() user: RequestUser,
    @Param('botId', ParseUUIDPipe) botId: string,
    @Param('commandName') commandName: string,
  ) {
    return this.commandsService.deleteCommand(user.id, botId, commandName);
  }

  @Get(':botId/commands')
  listCommands(@Param('botId', ParseUUIDPipe) botId: string) {
    return this.commandsService.listCommands(botId);
  }

  // ── Bot Plugins ──

  @Post(':botId/plugins')
  registerPlugin(
    @CurrentUser() user: RequestUser,
    @Param('botId', ParseUUIDPipe) botId: string,
    @Body() dto: CreateBotPluginDto,
  ) {
    return this.pluginsService.registerPlugin(user.id, botId, dto);
  }

  @Get(':botId/plugins')
  listPlugins(@Param('botId', ParseUUIDPipe) botId: string) {
    return this.pluginsService.listPlugins(botId);
  }

  @Delete(':botId/plugins/:pluginName')
  removePlugin(
    @CurrentUser() user: RequestUser,
    @Param('botId', ParseUUIDPipe) botId: string,
    @Param('pluginName') pluginName: string,
  ) {
    return this.pluginsService.removePlugin(user.id, botId, pluginName);
  }

  // ── Bot Room Management ──

  @Post(':botId/rooms/:roomId')
  addBotToRoom(
    @Param('botId', ParseUUIDPipe) botId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.botsService.addBotToRoom(botId, roomId);
  }

  @Delete(':botId/rooms/:roomId')
  removeBotFromRoom(
    @Param('botId', ParseUUIDPipe) botId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.botsService.removeBotFromRoom(botId, roomId);
  }
}

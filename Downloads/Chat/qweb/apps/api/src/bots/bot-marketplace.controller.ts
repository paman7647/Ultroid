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
import { Roles } from '@/common/decorators/roles.decorator';
import { BotMarketplaceService } from './bot-marketplace.service';
import {
  SubmitMarketplaceDto,
  ReviewMarketplaceDto,
  BotInstallDto,
  BotCategoryDto,
} from './dto/bot.dto';

@UseGuards(AccessTokenGuard)
@Controller('marketplace')
export class BotMarketplaceController {
  constructor(private readonly marketplaceService: BotMarketplaceService) {}

  // ── Public Browse ──

  @Get()
  browse(
    @Query('category') category?: BotCategoryDto,
    @Query('search') search?: string,
    @Query('sort') sortBy?: 'popular' | 'newest' | 'rating',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketplaceService.browseListings({
      category,
      search,
      sortBy,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':listingId')
  getListing(@Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.marketplaceService.getListing(listingId);
  }

  // ── Submission ──

  @Post('submit/:botId')
  submitListing(
    @CurrentUser() user: RequestUser,
    @Param('botId', ParseUUIDPipe) botId: string,
    @Body() dto: SubmitMarketplaceDto,
  ) {
    return this.marketplaceService.submitListing(user.id, botId, dto);
  }

  // ── Admin Review ──

  @Post(':listingId/review')
  @Roles('ADMIN')
  reviewListing(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; note?: string },
  ) {
    return this.marketplaceService.reviewListing(listingId, body.status, body.note);
  }

  // ── User Reviews ──

  @Post(':listingId/reviews')
  addReview(
    @CurrentUser() user: RequestUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: ReviewMarketplaceDto,
  ) {
    return this.marketplaceService.addReview(user.id, listingId, dto);
  }

  // ── Install / Uninstall ──

  @Post(':listingId/install')
  installBot(
    @CurrentUser() user: RequestUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: BotInstallDto,
  ) {
    return this.marketplaceService.installBot(user.id, listingId, dto);
  }

  @Delete('installations/:installationId')
  uninstallBot(
    @CurrentUser() user: RequestUser,
    @Param('installationId', ParseUUIDPipe) installationId: string,
  ) {
    return this.marketplaceService.uninstallBot(user.id, installationId);
  }

  @Get('installations/me')
  listMyInstallations(@CurrentUser() user: RequestUser) {
    return this.marketplaceService.listUserInstallations(user.id);
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  SubmitMarketplaceDto,
  ReviewMarketplaceDto,
  BotInstallDto,
  BotCategoryDto,
} from './dto/bot.dto';

@Injectable()
export class BotMarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit a bot to the marketplace for review.
   */
  async submitListing(ownerId: string, botId: string, dto: SubmitMarketplaceDto) {
    await this.assertBotOwner(ownerId, botId);

    const existing = await this.prisma.botMarketplaceListing.findUnique({
      where: { botId },
    });
    if (existing) {
      throw new BadRequestException('Bot already has a marketplace listing');
    }

    return this.prisma.botMarketplaceListing.create({
      data: {
        botId,
        category: dto.category,
        tags: dto.tags ?? [],
        shortDescription: dto.shortDescription,
        longDescription: dto.longDescription,
        websiteUrl: dto.websiteUrl,
        sourceUrl: dto.sourceUrl,
        reviewStatus: 'PENDING',
      },
    });
  }

  /**
   * Admin approves or rejects a marketplace listing.
   */
  async reviewListing(
    listingId: string,
    status: 'APPROVED' | 'REJECTED',
    reviewerNote?: string,
  ) {
    const listing = await this.prisma.botMarketplaceListing.findUnique({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    return this.prisma.botMarketplaceListing.update({
      where: { id: listingId },
      data: {
        reviewStatus: status,
        reviewerNote,
        isListed: status === 'APPROVED',
        publishedAt: status === 'APPROVED' ? new Date() : null,
      },
    });
  }

  /**
   * Browse marketplace listings.
   */
  async browseListings(options?: {
    category?: BotCategoryDto;
    search?: string;
    sortBy?: 'popular' | 'newest' | 'rating';
    page?: number;
    limit?: number;
  }) {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: any = {
      isListed: true,
      reviewStatus: 'APPROVED',
    };

    if (options?.category) {
      where.category = options.category;
    }

    if (options?.search) {
      where.OR = [
        { shortDescription: { contains: options.search, mode: 'insensitive' } },
        { longDescription: { contains: options.search, mode: 'insensitive' } },
        { tags: { has: options.search.toLowerCase() } },
      ];
    }

    const orderBy: any =
      options?.sortBy === 'popular'
        ? { installCount: 'desc' as const }
        : options?.sortBy === 'rating'
          ? { installCount: 'desc' as const } // approximate for now
          : { publishedAt: 'desc' as const };

    const [listings, total] = await Promise.all([
      this.prisma.botMarketplaceListing.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          reviews: {
            select: { rating: true },
          },
        },
      }),
      this.prisma.botMarketplaceListing.count({ where }),
    ]);

    // Enrich with average rating
    const enriched = listings.map((listing) => {
      const ratings = listing.reviews.map((r) => r.rating);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const { reviews, ...rest } = listing;
      return {
        ...rest,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: ratings.length,
      };
    });

    return { listings: enriched, total, page, limit };
  }

  async getListing(listingId: string) {
    const listing = await this.prisma.botMarketplaceListing.findUnique({
      where: { id: listingId },
      include: {
        reviews: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    const ratings = listing.reviews.map((r) => r.rating);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    return {
      ...listing,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: ratings.length,
    };
  }

  /**
   * User reviews a bot in the marketplace.
   */
  async addReview(userId: string, listingId: string, dto: ReviewMarketplaceDto) {
    const listing = await this.prisma.botMarketplaceListing.findUnique({
      where: { id: listingId },
    });
    if (!listing || !listing.isListed) {
      throw new NotFoundException('Listing not found');
    }

    return this.prisma.botReview.upsert({
      where: { listingId_userId: { listingId, userId } },
      update: { rating: dto.rating, comment: dto.comment },
      create: {
        listingId,
        userId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }

  /**
   * Install a bot (add to user's room). Increments install count.
   */
  async installBot(userId: string, listingId: string, dto: BotInstallDto) {
    const listing = await this.prisma.botMarketplaceListing.findUnique({
      where: { id: listingId, isListed: true },
    });
    if (!listing) throw new NotFoundException('Bot listing not found');

    const [installation] = await this.prisma.$transaction([
      this.prisma.botInstallation.create({
        data: {
          listingId,
          userId,
          roomId: dto.roomId,
          permissions: dto.permissions ?? [],
        },
      }),
      this.prisma.botMarketplaceListing.update({
        where: { id: listingId },
        data: { installCount: { increment: 1 } },
      }),
    ]);

    // If a room was specified, add the bot as a member
    if (dto.roomId) {
      await this.prisma.roomMembership.upsert({
        where: { roomId_userId: { roomId: dto.roomId, userId: listing.botId } },
        update: {},
        create: { roomId: dto.roomId, userId: listing.botId, role: 'MEMBER' },
      });
    }

    return installation;
  }

  async uninstallBot(userId: string, installationId: string) {
    const installation = await this.prisma.botInstallation.findUnique({
      where: { id: installationId },
      include: { listing: true },
    });
    if (!installation) throw new NotFoundException('Installation not found');
    if (installation.userId !== userId) throw new ForbiddenException('Not your installation');

    // Remove bot from room if applicable
    if (installation.roomId) {
      await this.prisma.roomMembership.deleteMany({
        where: { roomId: installation.roomId, userId: installation.listing.botId },
      });
    }

    await this.prisma.botInstallation.delete({ where: { id: installationId } });
    return { uninstalled: true };
  }

  async listUserInstallations(userId: string) {
    return this.prisma.botInstallation.findMany({
      where: { userId },
      include: {
        listing: {
          select: {
            id: true,
            botId: true,
            shortDescription: true,
            category: true,
            iconUrl: true,
          },
        },
      },
      orderBy: { installedAt: 'desc' },
    });
  }

  private async assertBotOwner(ownerId: string, botId: string) {
    const bot = await this.prisma.user.findFirst({
      where: { id: botId, isBot: true, deletedAt: null },
      select: { botOwnerId: true },
    });
    if (!bot) throw new NotFoundException('Bot not found');
    if (bot.botOwnerId !== ownerId) {
      throw new ForbiddenException('You do not own this bot');
    }
  }
}

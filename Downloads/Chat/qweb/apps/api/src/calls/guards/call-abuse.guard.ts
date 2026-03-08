import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Guard that prevents call abuse:
 * - Max concurrent calls per user: 1
 * - Max call initiations per user per hour: 60
 * - Only room members can initiate calls
 */
@Injectable()
export class CallAbuseGuard implements CanActivate {
  private readonly callCountWindow = new Map<string, { count: number; resetAt: number }>();
  private static readonly MAX_CALLS_PER_HOUR = 60;

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;

    if (!userId) throw new ForbiddenException('Authentication required');

    // Check call rate
    const now = Date.now();
    const window = this.callCountWindow.get(userId);

    if (window && window.resetAt > now) {
      if (window.count >= CallAbuseGuard.MAX_CALLS_PER_HOUR) {
        throw new ForbiddenException('Call rate limit exceeded. Max 60 calls per hour.');
      }
      window.count++;
    } else {
      this.callCountWindow.set(userId, { count: 1, resetAt: now + 3600_000 });
    }

    // Check for existing active call
    const activeCall = await this.prisma.callParticipant.findFirst({
      where: {
        userId,
        status: 'JOINED',
      },
    });

    if (activeCall) {
      throw new ForbiddenException('You are already in an active call');
    }

    return true;
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Notification service — handles mentions, push notifications, chat alerts.
 * Stores notifications in Redis for quick retrieval and PostgreSQL for persistence.
 */
@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private readonly redis: Redis;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
    });
  }

  async onModuleInit() {
    this.logger.log('NotificationService initialized');
  }

  /**
   * Send a notification to a user.
   */
  async notify(userId: string, notification: {
    type: string;
    title: string;
    body: string;
    roomId?: string;
    messageId?: string;
    senderId?: string;
    data?: Record<string, unknown>;
  }) {
    const id = `notif:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      ...notification,
      data: notification.data ?? {},
      read: false,
      createdAt: new Date().toISOString(),
    };

    // Store in Redis list for quick retrieval (capped at 200)
    const key = `notifications:${userId}`;
    await this.redis.lpush(key, JSON.stringify(entry));
    await this.redis.ltrim(key, 0, 199);
    await this.redis.expire(key, 30 * 86400); // 30 day expiry

    // Increment unread badge
    await this.redis.incr(`notifications:unread:${userId}`);

    return entry;
  }

  /**
   * Send mention notifications to mentioned users.
   */
  async notifyMentions(
    roomId: string,
    messageId: string,
    senderId: string,
    senderName: string,
    body: string,
    mentionedUserIds: string[],
  ) {
    for (const userId of mentionedUserIds) {
      if (userId === senderId) continue; // Don't notify self

      await this.notify(userId, {
        type: 'mention',
        title: `${senderName} mentioned you`,
        body: body.slice(0, 200),
        roomId,
        messageId,
        senderId,
      });
    }
  }

  /**
   * Send a new message notification to room members (except sender).
   */
  async notifyNewMessage(
    roomId: string,
    messageId: string,
    senderId: string,
    senderName: string,
    body: string,
    memberIds: string[],
  ) {
    for (const userId of memberIds) {
      if (userId === senderId) continue;

      // Check if user has muted this room
      const muted = await this.redis.get(`mute:${userId}:${roomId}`);
      if (muted) continue;

      await this.notify(userId, {
        type: 'message',
        title: senderName,
        body: body.slice(0, 200),
        roomId,
        messageId,
        senderId,
      });
    }
  }

  /**
   * Get notifications for a user.
   */
  async getNotifications(userId: string, offset = 0, limit = 50): Promise<{
    notifications: unknown[];
    unread: number;
  }> {
    const key = `notifications:${userId}`;
    const raw = await this.redis.lrange(key, offset, offset + limit - 1);
    const notifications = raw.map((r) => JSON.parse(r));
    const unread = parseInt(await this.redis.get(`notifications:unread:${userId}`) ?? '0', 10);
    return { notifications, unread };
  }

  /**
   * Mark all notifications as read.
   */
  async markAllRead(userId: string) {
    await this.redis.set(`notifications:unread:${userId}`, '0');
  }

  /**
   * Mark a specific notification as read.
   */
  async markRead(userId: string, notificationId: string) {
    const key = `notifications:${userId}`;
    const all = await this.redis.lrange(key, 0, -1);
    for (let i = 0; i < all.length; i++) {
      const raw = all[i];
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed.id === notificationId && !parsed.read) {
        parsed.read = true;
        await this.redis.lset(key, i, JSON.stringify(parsed));
        await this.redis.decr(`notifications:unread:${userId}`);
        break;
      }
    }
  }

  /**
   * Clear all notifications for a user.
   */
  async clearAll(userId: string) {
    await this.redis.del(`notifications:${userId}`);
    await this.redis.set(`notifications:unread:${userId}`, '0');
  }

  /**
   * Mute a room for a user.
   */
  async muteRoom(userId: string, roomId: string, durationSeconds?: number) {
    const key = `mute:${userId}:${roomId}`;
    if (durationSeconds) {
      await this.redis.set(key, '1', 'EX', durationSeconds);
    } else {
      await this.redis.set(key, '1');
    }
  }

  /**
   * Unmute a room for a user.
   */
  async unmuteRoom(userId: string, roomId: string) {
    await this.redis.del(`mute:${userId}:${roomId}`);
  }

  /**
   * Extract @mentions from message body and return user IDs.
   */
  parseMentions(body: string): string[] {
    const mentionRegex = /@<([a-f0-9-]{36})>/g;
    const ids: string[] = [];
    let match;
    while ((match = mentionRegex.exec(body)) !== null) {
      if (match[1]) ids.push(match[1]);
    }
    return [...new Set(ids)];
  }
}

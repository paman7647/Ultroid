import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '@/prisma/prisma.service';

export interface UserPresence {
  status: 'online' | 'offline' | 'away' | 'dnd';
  typing?: { roomId: string; at: string };
  inCall?: { callId: string; roomId: string };
  inVoiceRoom?: { voiceRoomId: string };
  lastSeenAt?: string;
  recording?: boolean;
}

const PRESENCE_PREFIX = 'presence:';
const PRESENCE_TTL = 300; // 5 minutes for presence expiry

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private redis!: Redis;
  private subscriber!: Redis;
  private listeners = new Map<string, Array<(presence: UserPresence) => void>>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.redis = new Redis(url);
    this.subscriber = new Redis(url);

    // Subscribe to presence updates for distributed scaling
    await this.subscriber.subscribe('presence:updates');
    this.subscriber.on('message', (_channel: string, message: string) => {
      try {
        const data = JSON.parse(message) as { userId: string; presence: UserPresence };
        const handlers = this.listeners.get(data.userId);
        if (handlers) {
          for (const handler of handlers) {
            handler(data.presence);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });
  }

  async onModuleDestroy() {
    await this.subscriber.unsubscribe('presence:updates');
    this.subscriber.disconnect();
    this.redis.disconnect();
  }

  async setOnline(userId: string) {
    const presence: UserPresence = { status: 'online', lastSeenAt: new Date().toISOString() };
    await this.setPresence(userId, presence);
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
  }

  async setOffline(userId: string) {
    const now = new Date();
    const presence: UserPresence = { status: 'offline', lastSeenAt: now.toISOString() };
    await this.setPresence(userId, presence);
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: now },
    });
  }

  async setTyping(userId: string, roomId: string) {
    const current = await this.getPresence(userId);
    const presence: UserPresence = {
      ...current,
      status: current?.status ?? 'online',
      typing: { roomId, at: new Date().toISOString() },
    };
    await this.setPresence(userId, presence);
  }

  async clearTyping(userId: string) {
    const current = await this.getPresence(userId);
    if (current) {
      const { typing, ...rest } = current;
      await this.setPresence(userId, rest as UserPresence);
    }
  }

  async setInCall(userId: string, callId: string, roomId: string) {
    const current = await this.getPresence(userId);
    const presence: UserPresence = {
      ...current,
      status: current?.status ?? 'online',
      inCall: { callId, roomId },
    };
    await this.setPresence(userId, presence);
  }

  async clearInCall(userId: string) {
    const current = await this.getPresence(userId);
    if (current) {
      const { inCall, ...rest } = current;
      await this.setPresence(userId, rest as UserPresence);
    }
  }

  async setInVoiceRoom(userId: string, voiceRoomId: string) {
    const current = await this.getPresence(userId);
    const presence: UserPresence = {
      ...current,
      status: current?.status ?? 'online',
      inVoiceRoom: { voiceRoomId },
    };
    await this.setPresence(userId, presence);
  }

  async clearInVoiceRoom(userId: string) {
    const current = await this.getPresence(userId);
    if (current) {
      const { inVoiceRoom, ...rest } = current;
      await this.setPresence(userId, rest as UserPresence);
    }
  }

  async setRecording(userId: string, recording: boolean) {
    const current = await this.getPresence(userId);
    const presence: UserPresence = {
      ...current,
      status: current?.status ?? 'online',
      recording,
    };
    await this.setPresence(userId, presence);
  }

  async getPresence(userId: string): Promise<UserPresence | null> {
    const data = await this.redis.get(`${PRESENCE_PREFIX}${userId}`);
    if (!data) return null;
    return JSON.parse(data) as UserPresence;
  }

  async getMultiplePresence(userIds: string[]): Promise<Map<string, UserPresence>> {
    if (!userIds.length) return new Map();

    const keys = userIds.map((id) => `${PRESENCE_PREFIX}${id}`);
    const values = await this.redis.mget(...keys);

    const result = new Map<string, UserPresence>();
    for (let i = 0; i < userIds.length; i++) {
      const val = values[i];
      const uid = userIds[i];
      if (val && uid) {
        result.set(uid, JSON.parse(val) as UserPresence);
      }
    }
    return result;
  }

  async getRoomPresence(roomId: string): Promise<Map<string, UserPresence>> {
    const members = await this.prisma.roomMembership.findMany({
      where: { roomId },
      select: { userId: true },
    });
    return this.getMultiplePresence(members.map((m) => m.userId));
  }

  private async setPresence(userId: string, presence: UserPresence) {
    const key = `${PRESENCE_PREFIX}${userId}`;
    await this.redis.setex(key, PRESENCE_TTL, JSON.stringify(presence));

    // Publish for distributed scaling
    await this.redis.publish(
      'presence:updates',
      JSON.stringify({ userId, presence }),
    );
  }

  /** Subscribe to presence updates for a specific user */
  onPresenceUpdate(userId: string, handler: (presence: UserPresence) => void) {
    const handlers = this.listeners.get(userId) ?? [];
    handlers.push(handler);
    this.listeners.set(userId, handlers);

    return () => {
      const current = this.listeners.get(userId) ?? [];
      this.listeners.set(
        userId,
        current.filter((h) => h !== handler),
      );
    };
  }

  /** Heartbeat to keep presence alive */
  async heartbeat(userId: string) {
    const key = `${PRESENCE_PREFIX}${userId}`;
    const exists = await this.redis.exists(key);
    if (exists) {
      await this.redis.expire(key, PRESENCE_TTL);
    } else {
      await this.setOnline(userId);
    }
  }
}

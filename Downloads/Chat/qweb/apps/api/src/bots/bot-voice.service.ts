import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { VoiceRoomsService } from '@/voice-rooms/voice-rooms.service';
import Redis from 'ioredis';

export interface AudioStreamRequest {
  botId: string;
  voiceRoomId: string;
  sourceUrl: string;
  source: 'FILE' | 'URL' | 'GENERATED';
  volume?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Service managing bot voice channel participation and audio streaming.
 * Bots join voice rooms as regular members, then stream audio via the worker service.
 */
@Injectable()
export class BotVoiceService {
  private readonly logger = new Logger(BotVoiceService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly voiceRoomsService: VoiceRoomsService,
  ) {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  /**
   * Bot joins a voice room.
   */
  async joinVoiceChannel(botId: string, voiceRoomId: string) {
    await this.assertIsBot(botId);
    return this.voiceRoomsService.joinVoiceRoom(botId, voiceRoomId);
  }

  /**
   * Bot leaves a voice room and stops any active streams.
   */
  async leaveVoiceChannel(botId: string, voiceRoomId: string) {
    await this.assertIsBot(botId);
    await this.stopStream(botId, voiceRoomId);
    return this.voiceRoomsService.leaveVoiceRoom(botId, voiceRoomId);
  }

  /**
   * Start a new audio stream in a voice room.
   * Creates a VoiceStream record and enqueues an audio-stream job for the worker.
   */
  async startStream(request: AudioStreamRequest) {
    await this.assertIsBot(request.botId);

    // Verify bot is in the voice room
    const member = await this.prisma.voiceRoomMember.findUnique({
      where: {
        voiceRoomId_userId: {
          voiceRoomId: request.voiceRoomId,
          userId: request.botId,
        },
      },
    });
    if (!member) {
      throw new BadRequestException('Bot must join voice room before streaming');
    }

    // Stop any existing stream from this bot in this room
    await this.prisma.voiceStream.updateMany({
      where: {
        botId: request.botId,
        voiceRoomId: request.voiceRoomId,
        status: { in: ['BUFFERING', 'PLAYING', 'PAUSED'] },
      },
      data: { status: 'STOPPED', endedAt: new Date() },
    });

    const stream = await this.prisma.voiceStream.create({
      data: {
        botId: request.botId,
        voiceRoomId: request.voiceRoomId,
        source: request.source,
        sourceUrl: request.sourceUrl,
        status: 'BUFFERING',
        volume: request.volume ?? 100,
        metadata: (request.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    // Enqueue audio streaming job to the worker
    await this.redis.rpush(
      'queue:audio-stream',
      JSON.stringify({
        streamId: stream.id,
        botId: request.botId,
        voiceRoomId: request.voiceRoomId,
        sourceUrl: request.sourceUrl,
        source: request.source,
        volume: request.volume ?? 100,
      }),
    );

    this.logger.log(`Audio stream ${stream.id} enqueued for bot ${request.botId}`);
    return stream;
  }

  async stopStream(botId: string, voiceRoomId: string) {
    const updated = await this.prisma.voiceStream.updateMany({
      where: {
        botId,
        voiceRoomId,
        status: { in: ['BUFFERING', 'PLAYING', 'PAUSED'] },
      },
      data: { status: 'STOPPED', endedAt: new Date() },
    });

    // Signal worker to stop
    await this.redis.publish(
      'audio-stream:control',
      JSON.stringify({ action: 'stop', botId, voiceRoomId }),
    );

    return { stopped: updated.count };
  }

  async pauseStream(botId: string, voiceRoomId: string) {
    await this.prisma.voiceStream.updateMany({
      where: { botId, voiceRoomId, status: 'PLAYING' },
      data: { status: 'PAUSED' },
    });
    await this.redis.publish(
      'audio-stream:control',
      JSON.stringify({ action: 'pause', botId, voiceRoomId }),
    );
    return { paused: true };
  }

  async resumeStream(botId: string, voiceRoomId: string) {
    await this.prisma.voiceStream.updateMany({
      where: { botId, voiceRoomId, status: 'PAUSED' },
      data: { status: 'PLAYING' },
    });
    await this.redis.publish(
      'audio-stream:control',
      JSON.stringify({ action: 'resume', botId, voiceRoomId }),
    );
    return { resumed: true };
  }

  async setVolume(botId: string, voiceRoomId: string, volume: number) {
    const clamped = Math.max(0, Math.min(200, volume));
    await this.prisma.voiceStream.updateMany({
      where: {
        botId,
        voiceRoomId,
        status: { in: ['PLAYING', 'PAUSED', 'BUFFERING'] },
      },
      data: { volume: clamped },
    });
    await this.redis.publish(
      'audio-stream:control',
      JSON.stringify({ action: 'volume', botId, voiceRoomId, volume: clamped }),
    );
    return { volume: clamped };
  }

  async getActiveStream(botId: string, voiceRoomId: string) {
    return this.prisma.voiceStream.findFirst({
      where: {
        botId,
        voiceRoomId,
        status: { in: ['BUFFERING', 'PLAYING', 'PAUSED'] },
      },
    });
  }

  async getStreamsByRoom(voiceRoomId: string) {
    return this.prisma.voiceStream.findMany({
      where: {
        voiceRoomId,
        status: { in: ['BUFFERING', 'PLAYING', 'PAUSED'] },
      },
    });
  }

  private async assertIsBot(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isBot: true, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Bot not found');
  }
}

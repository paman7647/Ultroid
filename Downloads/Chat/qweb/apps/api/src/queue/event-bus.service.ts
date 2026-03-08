import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis Streams-based event bus for distributing events across services.
 * Supports pub/sub pattern with consumer groups for reliable delivery.
 */
@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private readonly redis: Redis;
  private readonly subscriber: Redis;
  private readonly handlers = new Map<string, Array<(data: Record<string, string>) => Promise<void>>>();
  private running = false;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.redis = new Redis(url, { maxRetriesPerRequest: 2 });
    this.subscriber = new Redis(url, { maxRetriesPerRequest: 2 });
  }

  async onModuleInit() {
    this.running = true;
    this.logger.log('EventBus initialized with Redis Streams');
  }

  async onModuleDestroy() {
    this.running = false;
    await this.redis.quit();
    await this.subscriber.quit();
  }

  /**
   * Publish an event to a Redis Stream.
   */
  async publish(stream: string, data: Record<string, string>): Promise<string> {
    const id = await this.redis.xadd(stream, 'MAXLEN', '~', '50000', '*', ...Object.entries(data).flat());
    return id ?? '';
  }

  /**
   * Subscribe to a stream with a consumer group for reliable delivery.
   */
  async subscribe(
    stream: string,
    group: string,
    consumer: string,
    handler: (data: Record<string, string>) => Promise<void>,
  ) {
    // Create consumer group if it doesn't exist
    try {
      await this.subscriber.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
    } catch {
      // Group already exists — ignore
    }

    const handlers = this.handlers.get(`${stream}:${group}`) ?? [];
    handlers.push(handler);
    this.handlers.set(`${stream}:${group}`, handlers);

    // Start consuming in background
    this.consumeLoop(stream, group, consumer, handler);
  }

  private async consumeLoop(
    stream: string,
    group: string,
    consumer: string,
    handler: (data: Record<string, string>) => Promise<void>,
  ) {
    while (this.running) {
      try {
        const results: any = await this.subscriber.xreadgroup(
          'GROUP', group, consumer,
          'COUNT', '10',
          'BLOCK', '2000',
          'STREAMS', stream, '>',
        );

        if (!results) continue;

        for (const [, entries] of results) {
          for (const [id, fields] of entries) {
            // Convert flat array to object
            const data: Record<string, string> = {};
            for (let i = 0; i < fields.length; i += 2) {
              data[fields[i]] = fields[i + 1];
            }

            try {
              await handler(data);
              await this.subscriber.xack(stream, group, id);
            } catch (err: any) {
              this.logger.warn(`Failed to process event ${id} from ${stream}: ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        if (this.running) {
          this.logger.warn(`Stream read error on ${stream}: ${err.message}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  /**
   * Publish a message event to the message processing stream.
   */
  async publishMessageEvent(
    type: 'created' | 'edited' | 'deleted',
    messageId: string,
    roomId: string,
    senderId: string,
    body?: string,
  ): Promise<string> {
    return this.publish('stream:messages', {
      type,
      messageId,
      roomId,
      senderId,
      body: body ?? '',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish a notification event.
   */
  async publishNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    return this.publish('stream:notifications', {
      userId,
      type,
      title,
      body,
      data: JSON.stringify(data ?? {}),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish an analytics event.
   */
  async publishAnalyticsEvent(
    eventType: string,
    userId: string,
    roomId: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    return this.publish('stream:analytics', {
      eventType,
      userId,
      roomId,
      metadata: JSON.stringify(metadata ?? {}),
      timestamp: new Date().toISOString(),
    });
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';

/**
 * Centralized message queue service using BullMQ.
 * Manages queues for: messages, notifications, bot events, AI tasks, media processing.
 */
@Injectable()
export class MessageQueueService implements OnModuleInit {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private readonly redisOpts = { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } };

  async onModuleInit() {
    this.logger.log('MessageQueueService initialized');
  }

  /**
   * Get or create a named queue.
   */
  getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, this.redisOpts);
      this.queues.set(name, queue);
    }
    return queue;
  }

  /**
   * Add a job to a queue.
   */
  async addJob<T extends Record<string, unknown>>(
    queueName: string,
    jobName: string,
    data: T,
    opts?: { priority?: number; delay?: number; attempts?: number },
  ): Promise<string> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, {
      priority: opts?.priority,
      delay: opts?.delay,
      attempts: opts?.attempts ?? 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    });
    return job.id ?? '';
  }

  /**
   * Register a worker for a queue.
   */
  registerWorker(
    queueName: string,
    processor: (job: Job) => Promise<void>,
    concurrency = 3,
  ): Worker {
    const existing = this.workers.get(queueName);
    if (existing) return existing;

    const worker = new Worker(queueName, processor, {
      ...this.redisOpts,
      concurrency,
    });

    worker.on('failed', (job, err) => {
      this.logger.warn(`Job ${job?.id} in ${queueName} failed: ${err.message}`);
    });

    worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} in ${queueName} completed`);
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  // ─── Convenience methods for common queues ──────────────────────────

  async queueMessageProcessing(data: {
    messageId: string;
    roomId: string;
    senderId: string;
    body: string;
    kind: string;
  }): Promise<string> {
    return this.addJob('message-processing', 'process-message', data);
  }

  async queueBotEvent(data: {
    botId: string;
    eventType: string;
    roomId: string;
    payload: Record<string, unknown>;
  }): Promise<string> {
    return this.addJob('bot-events', 'bot-event', data);
  }

  async queueAITask(data: {
    taskType: string;
    content: string;
    metadata: Record<string, unknown>;
  }): Promise<string> {
    return this.addJob('ai-tasks', 'ai-task', data);
  }

  async queueMediaProcessing(data: {
    attachmentId: string;
    jobType: string;
    sourceKey: string;
    options: Record<string, unknown>;
  }): Promise<string> {
    return this.addJob('media-processing', 'media-job', data);
  }

  async queueNotification(data: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<string> {
    return this.addJob('notifications', 'send-notification', data);
  }

  async queueSearchIndex(data: {
    messageId: string;
    roomId: string;
    senderId: string;
    content: string;
    action: 'index' | 'remove';
  }): Promise<string> {
    return this.addJob('search-index', 'index-message', data);
  }

  /**
   * Get queue statistics.
   */
  async getQueueStats(queueName: string) {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    return { queueName, waiting, active, completed, failed, delayed };
  }

  /**
   * Get stats for all managed queues.
   */
  async getAllQueueStats() {
    const stats = [];
    for (const name of this.queues.keys()) {
      stats.push(await this.getQueueStats(name));
    }
    return stats;
  }
}

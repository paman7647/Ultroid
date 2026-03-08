import { Readable } from 'stream';
import net from 'net';
import { execFile } from 'child_process';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { Worker } from 'bullmq';
import pino from 'pino';
import Redis from 'ioredis';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

// Validate required environment variables
const requiredEnv = ['REDIS_URL', 'S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const;
for (const key of requiredEnv) {
  if (!process.env[key]) {
    logger.warn({ key }, `Environment variable ${key} is not set, using default fallback`);
  }
}

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const prisma = new PrismaClient();

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? '',
    secretAccessKey: process.env.S3_SECRET_KEY ?? '',
  },
});

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function scanWithClamAv(buffer: Buffer): Promise<'CLEAN' | 'INFECTED' | 'FAILED'> {
  const host = process.env.CLAMAV_HOST ?? 'localhost';
  const port = Number(process.env.CLAMAV_PORT ?? 3310);

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let response = '';
    let settled = false;

    const done = (status: 'CLEAN' | 'INFECTED' | 'FAILED') => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(status);
    };

    socket.setTimeout(20_000, () => done('FAILED'));
    socket.on('error', () => done('FAILED'));

    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
    });

    socket.on('close', () => {
      if (!settled) {
        if (response.includes('FOUND')) return done('INFECTED');
        if (response.includes('OK')) return done('CLEAN');
        return done('FAILED');
      }
    });

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      const chunkSize = 64 * 1024;

      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, buffer.length);
        const slice = buffer.subarray(offset, end);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(slice.length, 0);
        socket.write(len);
        socket.write(slice);
      }

      const zero = Buffer.alloc(4);
      zero.writeUInt32BE(0, 0);
      socket.write(zero);
    });
  });
}

async function quarantineObject(bucket: string, key: string, quarantineBucket: string) {
  await s3.send(
    new CopyObjectCommand({
      Bucket: quarantineBucket,
      Key: key,
      CopySource: `${bucket}/${key}`,
    }),
  );

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

const worker = new Worker(
  'malware-scan',
  async (job) => {
    if (job.name !== 'scan-object') return;

    const attachment = await prisma.attachment.findUnique({
      where: { id: job.data.attachmentId as string },
    });

    if (!attachment) {
      logger.warn({ jobId: job.id }, 'Attachment missing, skipping job');
      return;
    }

    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: attachment.bucket,
          Key: attachment.objectKey,
        }),
      );

      const body = response.Body;
      if (!body || !(body instanceof Readable)) {
        throw new Error('Unable to fetch upload body');
      }

      const fileBuffer = await streamToBuffer(body);
      const scanStatus = await scanWithClamAv(fileBuffer);

      if (scanStatus === 'INFECTED') {
        await quarantineObject(
          attachment.bucket,
          attachment.objectKey,
          process.env.S3_QUARANTINE_BUCKET ?? 'qweb-quarantine',
        );

        await prisma.attachment.update({
          where: { id: attachment.id },
          data: {
            scanStatus: 'INFECTED',
            scannedAt: new Date(),
            quarantinedAt: new Date(),
          },
        });

        return;
      }

      await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          scanStatus,
          scannedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error({ error, attachmentId: attachment.id }, 'scan-object job failed');
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          scanStatus: 'FAILED',
          scannedAt: new Date(),
        },
      });
      throw error;
    }
  },
  { connection: { url: redisUrl } },
);

worker.on('ready', () => logger.info('Malware-scan worker ready'));
worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Malware-scan job completed'));
worker.on('failed', (job, error) => logger.error({ jobId: job?.id, error }, 'Malware-scan job failed'));

// --------------- Media Processing Worker ---------------
const mediaWorker = new Worker(
  'media-processing',
  async (job) => {
    const { type } = job.data as { type: string };

    switch (type) {
      case 'call-recording-finalize': {
        const { callId, recordingUrl, bucket, objectKey } = job.data as {
          callId: string;
          recordingUrl: string;
          bucket: string;
          objectKey: string;
        };

        logger.info({ callId }, 'Finalizing call recording');

        // Fetch recording from media server and upload to S3
        const response = await fetch(recordingUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch recording: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const recordingBuffer = Buffer.from(arrayBuffer);

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Body: recordingBuffer,
            ContentType: 'audio/webm',
          }),
        );

        // Update call record with recording URL in metadata
        const existingCall = await prisma.call.findUnique({ where: { id: callId } });
        const existingMeta = (existingCall?.metadata as Record<string, unknown>) ?? {};
        await prisma.call.update({
          where: { id: callId },
          data: {
            metadata: { ...existingMeta, recordingUrl: `s3://${bucket}/${objectKey}` },
          },
        });

        logger.info({ callId }, 'Call recording finalized');
        break;
      }

      case 'generate-thumbnail': {
        const { attachmentId } = job.data as { attachmentId: string };
        logger.info({ attachmentId }, 'Thumbnail generation requested (requires ffmpeg)');
        // Thumbnail generation would require ffmpeg — log and skip if not available
        break;
      }

      default:
        logger.warn({ type }, 'Unknown media-processing job type');
    }
  },
  { connection: { url: redisUrl } },
);

mediaWorker.on('ready', () => logger.info('Media-processing worker ready'));
mediaWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Media job completed'));
mediaWorker.on('failed', (job, error) => logger.error({ jobId: job?.id, error }, 'Media job failed'));

// --------------- Notifications Worker ---------------
const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const { type } = job.data as { type: string };

    switch (type) {
      case 'missed-call': {
        const { callId, callerId, recipientIds } = job.data as {
          callId: string;
          callerId: string;
          recipientIds: string[];
        };

        logger.info({ callId, callerId, recipients: recipientIds.length }, 'Sending missed call notifications');

        // Create a single system message for missed call
        if (job.data.roomId) {
          await prisma.message.create({
            data: {
              roomId: job.data.roomId as string,
              senderId: callerId,
              body: `Missed ${job.data.callType as string} call`,
              kind: 'SYSTEM',
            },
          });
        }

        break;
      }

      case 'push-notification': {
        const { userId, title, body: notifBody } = job.data as {
          userId: string;
          title: string;
          body: string;
        };

        logger.info({ userId, title }, 'Push notification enqueued');
        // Web Push implementation would go here when push subscription is implemented
        break;
      }

      default:
        logger.warn({ type }, 'Unknown notification job type');
    }
  },
  { connection: { url: redisUrl } },
);

notificationWorker.on('ready', () => logger.info('Notifications worker ready'));
notificationWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Notification job completed'));
notificationWorker.on('failed', (job, error) => logger.error({ jobId: job?.id, error }, 'Notification job failed'));

// --------------- Audio Stream Worker ---------------
// Polls the Redis list "queue:audio-stream" and listens on "audio-stream:control"
// for pause/resume/stop/volume commands. Uses FFmpeg to transcode audio to Opus.

interface AudioStreamJob {
  streamId: string;
  botId: string;
  voiceRoomId: string;
  sourceUrl: string;
  source: 'FILE' | 'URL' | 'GENERATED';
  volume: number;
}

const audioRedis = new Redis(redisUrl);
const audioControlRedis = new Redis(redisUrl);
const activeStreams = new Map<string, { stopped: boolean; paused: boolean; volume: number }>();

function streamKey(botId: string, voiceRoomId: string) {
  return `${botId}:${voiceRoomId}`;
}

// Listen for control signals
audioControlRedis.subscribe('audio-stream:control');
audioControlRedis.on('message', (_channel: string, message: string) => {
  try {
    const { action, botId, voiceRoomId, volume } = JSON.parse(message);
    const key = streamKey(botId, voiceRoomId);
    const state = activeStreams.get(key);
    if (!state) return;

    switch (action) {
      case 'stop':
        state.stopped = true;
        break;
      case 'pause':
        state.paused = true;
        break;
      case 'resume':
        state.paused = false;
        break;
      case 'volume':
        state.volume = volume ?? 100;
        break;
    }
  } catch {
    // ignore malformed messages
  }
});

async function processAudioStream(job: AudioStreamJob) {
  const key = streamKey(job.botId, job.voiceRoomId);
  const state = { stopped: false, paused: false, volume: job.volume };
  activeStreams.set(key, state);

  try {
    // Update stream status to PLAYING
    await prisma.voiceStream.update({
      where: { id: job.streamId },
      data: { status: 'PLAYING', startedAt: new Date() },
    });

    // Transcode with FFmpeg to Opus
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-i', job.sourceUrl,
        '-f', 'opus',
        '-acodec', 'libopus',
        '-b:a', '128k',
        '-ar', '48000',
        '-ac', '2',
        '-vn',
        '-y',
        'pipe:1',
      ];

      const proc = execFile('ffmpeg', args, { maxBuffer: 1024 * 1024 * 100 }, (err) => {
        if (err && !state.stopped) {
          reject(err);
        } else {
          resolve();
        }
      });

      // Monitor stop signal
      const checkInterval = setInterval(() => {
        if (state.stopped) {
          proc.kill('SIGTERM');
          clearInterval(checkInterval);
        }
      }, 500);

      proc.on('exit', () => {
        clearInterval(checkInterval);
      });
    });

    // Update stream status
    await prisma.voiceStream.update({
      where: { id: job.streamId },
      data: { status: 'STOPPED', endedAt: new Date() },
    });

    logger.info({ streamId: job.streamId, botId: job.botId }, 'Audio stream completed');
  } catch (err) {
    logger.error({ err, streamId: job.streamId }, 'Audio stream failed');
    await prisma.voiceStream.update({
      where: { id: job.streamId },
      data: { status: 'ERROR', endedAt: new Date() },
    });
  } finally {
    activeStreams.delete(key);
  }
}

// Poll the audio stream queue
async function pollAudioQueue() {
  while (true) {
    try {
      const result = await audioRedis.blpop('queue:audio-stream', 5);
      if (result) {
        const job: AudioStreamJob = JSON.parse(result[1]);
        logger.info({ streamId: job.streamId, botId: job.botId }, 'Processing audio stream job');
        processAudioStream(job).catch((err) => {
          logger.error({ err }, 'Audio stream processing error');
        });
      }
    } catch (err) {
      logger.error({ err }, 'Audio queue poll error');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

pollAudioQueue();
logger.info('Audio stream worker polling started');

// --------------- Search Index Worker ---------------
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000';
const PYTHON_API_KEY = process.env.PYTHON_INTERNAL_API_KEY ?? 'change-me-internal-api-key';

const searchWorker = new Worker(
  'search-index',
  async (job) => {
    const { action, messageId, roomId, senderId, content } = job.data as {
      action: 'index' | 'remove';
      messageId: string;
      roomId: string;
      senderId: string;
      content: string;
    };

    if (action === 'index' && content) {
      await fetch(`${PYTHON_SERVICE_URL}/v1/search/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Api-Key': PYTHON_API_KEY },
        body: JSON.stringify({ id: messageId, content, room_id: roomId, sender_id: senderId }),
        signal: AbortSignal.timeout(10_000),
      });
    } else if (action === 'remove') {
      await fetch(`${PYTHON_SERVICE_URL}/v1/search/index/${messageId}`, {
        method: 'DELETE',
        headers: { 'X-Internal-Api-Key': PYTHON_API_KEY },
        signal: AbortSignal.timeout(5_000),
      });
    }
  },
  { connection: { url: redisUrl }, concurrency: 5 },
);

searchWorker.on('ready', () => logger.info('Search-index worker ready'));
searchWorker.on('failed', (job, error) => logger.error({ jobId: job?.id, error: error.message }, 'Search job failed'));

// --------------- AI Tasks Worker ---------------
const aiWorker = new Worker(
  'ai-tasks',
  async (job) => {
    const { taskType, content, metadata } = job.data as {
      taskType: string;
      content: string;
      metadata: Record<string, unknown>;
    };

    const endpoints: Record<string, string> = {
      'spam-check': '/v1/ai/spam-check',
      'moderate': '/v1/ai/moderate',
      'analyze': '/v1/ai/analyze',
    };

    const endpoint = endpoints[taskType];
    if (!endpoint) {
      logger.warn({ taskType }, 'Unknown AI task type');
      return;
    }

    const body = taskType === 'spam-check'
      ? { user_id: (metadata.userId as string) ?? '', content, room_id: (metadata.roomId as string) ?? '' }
      : taskType === 'moderate'
      ? { content, context: (metadata.context as string) ?? 'chat' }
      : { messages: [content], analysis_type: (metadata.analysisType as string) ?? 'summary' };

    const res = await fetch(`${PYTHON_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Api-Key': PYTHON_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`AI task ${taskType} failed: ${res.status}`);
    }

    return res.json();
  },
  { connection: { url: redisUrl }, concurrency: 3 },
);

aiWorker.on('ready', () => logger.info('AI-tasks worker ready'));
aiWorker.on('failed', (job, error) => logger.error({ jobId: job?.id, error: error.message }, 'AI job failed'));

const shutdown = async () => {
  logger.info('Shutting down workers...');
  await Promise.all([
    worker.close(),
    mediaWorker.close(),
    notificationWorker.close(),
    searchWorker.close(),
    aiWorker.close(),
  ]);
  audioControlRedis.disconnect();
  audioRedis.disconnect();
  await prisma.$disconnect();
  logger.info('All workers stopped');
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

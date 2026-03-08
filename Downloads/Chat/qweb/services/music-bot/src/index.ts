import pino from 'pino';
import { MusicBotClient } from './client';
import { CommandHandler } from './commands';
import { MusicQueue } from './queue';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_TOKEN = process.env.BOT_TOKEN;
const WS_URL = process.env.WS_URL ?? 'http://localhost:4000';

if (!BOT_TOKEN) {
  logger.fatal('BOT_TOKEN environment variable is required');
  process.exit(1);
}

async function main() {
  logger.info('Starting QWeb MusicBot...');

  const queue = new MusicQueue();
  const client = new MusicBotClient(API_URL, WS_URL, BOT_TOKEN, logger);
  const commands = new CommandHandler(client, queue, logger);

  await client.connect();

  client.onCommand((roomId, command, args, senderId) => {
    commands.handle(roomId, command, args, senderId);
  });

  logger.info('MusicBot is ready and listening for commands');
}

main().catch((err) => {
  logger.fatal({ err }, 'MusicBot crashed');
  process.exit(1);
});

const shutdown = () => {
  logger.info('Shutting down MusicBot...');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

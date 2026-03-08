import { createServer } from './server';
import { loadConfig } from './lib/config';
import { logger } from './lib/logger';

const config = loadConfig(process.env);
const { server } = createServer();

server.listen(config.SIGNALING_PORT, () => {
  logger.info({ port: config.SIGNALING_PORT }, 'Signaling server listening');
});

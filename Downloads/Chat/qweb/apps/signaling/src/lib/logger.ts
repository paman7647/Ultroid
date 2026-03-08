import pino from 'pino';
import { loadConfig } from './config';

const config = loadConfig(process.env);

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: ['req.headers.authorization', 'token', 'payload.ciphertext'],
});

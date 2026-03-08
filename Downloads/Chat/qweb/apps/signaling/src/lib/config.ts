import { z } from 'zod';

const schema = z.object({
  SIGNALING_PORT: z.coerce.number().default(4100),
  SIGNALING_CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SIGNALING_JWT_SECRET: z.string().min(32),
  PYTHON_AI_URL: z.string().url().default('http://localhost:8000'),
  PYTHON_INTERNAL_API_KEY: z.string().min(16),
  SOCKET_EVENT_RATE_LIMIT: z.coerce.number().default(120),
  SOCKET_EVENT_RATE_WINDOW_MS: z.coerce.number().default(60_000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  TURN_URLS: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),
});

export type SignalingConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv): SignalingConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Signaling env invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}

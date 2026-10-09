import { pino } from 'pino';
import { env, isProduction } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { rateLimitHandler } from './middleware/rate-limit-handler.js';
import { createApiRouter } from './routes/index.js';

export interface AppOptions {
  /** Turn the rate limiters off, so tests can make many requests. On by default. */
  rateLimits?: boolean;
}

/**
 * Builds the Express app without starting it (server.ts does that), so the same
 * app can be imported by tests without opening a port or a DB connection.
 */
export function createApp({ rateLimits = true }: AppOptions = {}): Express {
  const app = express();

  // Behind a single reverse proxy in production (Render/Fly/etc.) — needed for correct client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  if (rateLimits) {
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: rateLimitHandler,
      }),
    );
  }
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', createApiRouter({ rateLimits }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

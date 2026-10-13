import type { Server } from 'node:http';
import { createApp } from './app.js';
import { cookieSecure, env, isProduction } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDb, disconnectDb } from './db/connect.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  if (isProduction && !cookieSecure) {
    logger.warn('COOKIE_SECURE is off in production: the refresh cookie is sent over plain http');
  }

  await connectDb();

  const server = createApp().listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  registerShutdownHandlers(server);
}

function registerShutdownHandlers(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down`);

    // Hard stop if connections refuse to drain.
    setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close((serverError) => {
      disconnectDb()
        .catch((err: unknown) => logger.error({ err }, 'Error closing MongoDB connection'))
        .finally(() => process.exit(serverError ? 1 : 0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

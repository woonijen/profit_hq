import type { ErrorRequestHandler, RequestHandler } from 'express';
import { isProduction } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { isDuplicateKeyError } from '../utils/mongo-errors.js';

/** Shape of every error response: `{ error: { code, message, details?, requestId } }`. */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

interface HttpLikeError extends Error {
  status?: number;
  expose?: boolean;
  type?: string;
}

/** Errors raised by Express/body-parser carry `status` + `expose` (http-errors). */
function isExposedHttpError(err: unknown): err is HttpLikeError & { status: number } {
  return (
    err instanceof Error &&
    'expose' in err &&
    'status' in err &&
    (err as HttpLikeError).expose === true
  );
}

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  // httpLogger always sets a string id and echoes it in this header.
  const requestId = res.getHeader('x-request-id')?.toString() ?? '';

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details: unknown;

  if (err instanceof AppError) {
    ({ statusCode: status, code, message, details } = err);
  } else if (isExposedHttpError(err)) {
    status = err.status;
    code = err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
    message = err.type === 'entity.parse.failed' ? 'Malformed JSON body' : err.message;
  } else if (isDuplicateKeyError(err)) {
    status = 409;
    code = 'CONFLICT';
    message = 'Resource already exists';
  }

  if (status >= 500) {
    // Full error (with stack) goes to the logs only, never to the client.
    req.log.error({ err }, 'Unhandled error');
    if (isProduction) message = 'Something went wrong';
  }

  const body: ErrorResponse = { error: { code, message, details, requestId } };
  res.status(status).json(body);
};

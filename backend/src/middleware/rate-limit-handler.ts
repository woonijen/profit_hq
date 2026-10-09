import type { Options } from 'express-rate-limit';
import { AppError } from '../errors/app-error.js';

/** Routes rate-limit rejections through the error handler so they use the standard envelope. */
export const rateLimitHandler: Options['handler'] = (_req, _res, next) => {
  next(new AppError(429, 'TOO_MANY_REQUESTS', 'Too many requests, please try again later'));
};

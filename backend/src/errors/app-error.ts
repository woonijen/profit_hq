export type ErrorDetails = Record<string, unknown> | unknown[];

/**
 * An error we deliberately throw and are happy to show to the client.
 * Anything that is NOT an AppError is treated as an unexpected 500.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: ErrorDetails): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details: ErrorDetails): AppError {
    return new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to this resource'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }
}

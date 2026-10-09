import type { RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

/** Zod schemas for the parts of a request we validate. Any key may be omitted. */
export interface RequestSchema {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

/** The parsed (coerced, defaulted, stripped) output of a `RequestSchema`. */
export type Validated<S extends RequestSchema> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never;
};

const SOURCES = ['params', 'query', 'body'] as const;

/**
 * Validates `params`, `query` and `body` against the given schemas.
 *
 * Parsed results are stored on `res.locals.validated` instead of overwriting `req.*`
 * (Express 5 makes `req.query` read-only). Read them with `getValidated`.
 *
 * @example
 * router.get('/', validate({ query: listQuery }), (req, res) => {
 *   const { query } = getValidated(res, { query: listQuery });
 * });
 */
export function validate(schema: RequestSchema): RequestHandler {
  return (req, res, next) => {
    const validated: Record<string, unknown> = {};
    const issues: { source: string; path: string; message: string }[] = [];

    for (const source of SOURCES) {
      const sourceSchema = schema[source];
      if (!sourceSchema) continue;

      const result = sourceSchema.safeParse(req[source]);
      if (result.success) {
        validated[source] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ source, path: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) return next(AppError.validation(issues));

    res.locals.validated = validated;
    next();
  };
}

/** Typed accessor for what `validate(schema)` stored. Pass the same schema to infer types. */
export function getValidated<S extends RequestSchema>(res: Response, _schema: S): Validated<S> {
  return res.locals.validated as Validated<S>;
}

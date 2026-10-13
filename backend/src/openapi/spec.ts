/**
 * The OpenAPI 3.1 description of the API, served at `/api/openapi.json` and rendered by
 * Swagger UI at `/api/docs`.
 *
 * Request shapes (bodies, query and path parameters) are generated from the same Zod schemas
 * the routes validate with, so they cannot drift. Response shapes are written out below and
 * mirror the service/controller return types and `docs/metrics.md`.
 */
import { z } from 'zod';
import { GRANULARITIES } from '../metrics/trend-pipeline.js';
import { loginBody, registerBody } from '../schemas/auth.schemas.js';
import { summaryQuery, trendQuery } from '../schemas/metrics.schemas.js';
import { storeParams } from '../schemas/store.schemas.js';
import { RANGE_KEYS } from '../utils/date-range.js';

type Json = Record<string, unknown>;

/** JSON Schema of a Zod schema, as the client must send it (before transforms). */
function jsonSchemaOf(schema: z.ZodType): Json {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, { io: 'input' }) as Json;
  return rest;
}

/** OpenAPI `parameters` for each property of a Zod object schema. */
function parametersOf(location: 'query' | 'path', schema: z.ZodObject): Json[] {
  const { properties = {}, required = [] } = jsonSchemaOf(schema) as {
    properties?: Record<string, Json>;
    required?: string[];
  };
  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: location,
    required: location === 'path' || required.includes(name),
    schema: propertySchema,
  }));
}

const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: Json): Json => ({ 'application/json': { schema } });
const response = (description: string, schema?: Json): Json => ({
  description,
  ...(schema && { content: json(schema) }),
});
const errorResponse = (description: string): Json => response(description, ref('Error'));

const integer = (description?: string): Json => ({
  type: 'integer',
  ...(description && { description }),
});
const nullableNumber: Json = { type: ['number', 'null'] };
const dateTime: Json = { type: 'string', format: 'date-time' };

function object(properties: Record<string, Json>, required = Object.keys(properties)): Json {
  return { type: 'object', properties, required, additionalProperties: false };
}

const cents = (what: string): Json => integer(`${what}, integer cents of the store currency`);

const comparison = object({
  current: { type: 'number' },
  previous: { type: 'number' },
  changeRatio: {
    ...nullableNumber,
    description: '(current − previous) ÷ |previous|; 0.1 = up 10%. Null when previous is 0.',
  },
});

const schemas: Record<string, Json> = {
  Error: object({
    error: object(
      {
        code: {
          type: 'string',
          examples: [
            'VALIDATION_ERROR',
            'UNAUTHORIZED',
            'NOT_FOUND',
            'CONFLICT',
            'TOO_MANY_REQUESTS',
          ],
        },
        message: { type: 'string' },
        details: { description: 'Extra information, e.g. which fields failed validation.' },
        requestId: { type: 'string', description: 'Also sent as the `x-request-id` header.' },
      },
      ['code', 'message', 'requestId'],
    ),
  }),
  User: object({
    id: { type: 'string' },
    email: { type: 'string', format: 'email' },
    createdAt: dateTime,
  }),
  AuthResponse: object({
    user: ref('User'),
    accessToken: {
      type: 'string',
      description: 'Short-lived JWT; send as `Authorization: Bearer`.',
    },
  }),
  Store: object({
    id: { type: 'string' },
    shopDomain: { type: 'string' },
    currency: { type: 'string', description: 'ISO 4217 code' },
    timezone: { type: 'string', description: 'IANA zone; day and month buckets are cut in it' },
  }),
  SyncCounts: object({
    inserted: integer(),
    updated: integer(),
    unchanged: integer(),
    failed: integer(),
  }),
  SyncRun: object({
    id: { type: 'string' },
    storeId: { type: 'string' },
    status: { enum: ['running', 'succeeded', 'partial', 'failed'] },
    startedAt: dateTime,
    finishedAt: { oneOf: [dateTime, { type: 'null' }] },
    resumed: { type: 'boolean', description: 'Continued from the checkpoint of a failed run.' },
    products: ref('SyncCounts'),
    orders: ref('SyncCounts'),
    error: {
      oneOf: [
        object({ message: { type: 'string' }, entity: { enum: ['products', 'orders'] } }, [
          'message',
        ]),
        { type: 'null' },
      ],
    },
    failures: {
      type: 'array',
      description: 'Documents that were skipped (at most 20 are kept).',
      items: object({
        entity: { enum: ['products', 'orders'] },
        shopifyId: { type: 'string' },
        message: { type: 'string' },
      }),
    },
  }),
  Comparison: comparison,
  MarginComparison: object({
    current: nullableNumber,
    previous: nullableNumber,
    deltaPoints: { ...nullableNumber, description: 'current − previous; 0.02 = +2 points.' },
  }),
  MetricsSummary: object({
    range: object({
      key: { enum: [...RANGE_KEYS] },
      timezone: { type: 'string' },
      currency: { type: 'string' },
      current: object({ from: dateTime, to: dateTime }),
      previous: object({ from: dateTime, to: dateTime }),
    }),
    metrics: object({
      grossRevenueCents: ref('Comparison'),
      discountsCents: ref('Comparison'),
      refundsCents: ref('Comparison'),
      netRevenueCents: ref('Comparison'),
      taxesCents: ref('Comparison'),
      cogsCents: ref('Comparison'),
      netProfitCents: ref('Comparison'),
      orders: ref('Comparison'),
      aovCents: ref('Comparison'),
      netMargin: ref('MarginComparison'),
    }),
    costCoverage: object({
      current: { type: 'number', minimum: 0, maximum: 1 },
      previous: { type: 'number', minimum: 0, maximum: 1 },
    }),
  }),
  TrendPoint: object({
    date: {
      type: 'string',
      format: 'date',
      description: 'Local calendar date of the store the bucket starts on (the 1st for months).',
    },
    orders: integer(),
    grossRevenueCents: cents('Gross revenue'),
    netRevenueCents: cents('Net revenue'),
    cogsCents: cents('Cost of goods sold'),
    netProfitCents: cents('Net profit'),
    netMargin: {
      ...nullableNumber,
      description: 'Net profit ÷ net revenue; null without net revenue.',
    },
    partial: { type: 'boolean', description: 'A month bucket cut short by the range.' },
  }),
  MetricsTrend: object({
    range: object({
      key: { enum: [...RANGE_KEYS] },
      timezone: { type: 'string' },
      currency: { type: 'string' },
      from: dateTime,
      to: dateTime,
    }),
    granularity: { enum: [...GRANULARITIES] },
    points: { type: 'array', items: ref('TrendPoint') },
  }),
  HealthReport: object({
    status: { enum: ['ok', 'degraded'] },
    uptimeSeconds: integer(),
    timestamp: dateTime,
    database: { enum: ['connected', 'connecting', 'disconnecting', 'disconnected'] },
  }),
};

const secured = [{ bearerAuth: [] }];
const storeIdParameters = parametersOf('path', storeParams);
const authErrors = {
  '401': errorResponse('Missing, invalid or expired access token'),
  '404': errorResponse('The store does not exist or belongs to someone else'),
};
const validationError = errorResponse('Invalid request (`VALIDATION_ERROR`)');
const tooManyRequests = errorResponse('Rate limit exceeded (`TOO_MANY_REQUESTS`)');
const wrongOrigin = errorResponse('The `Origin` header is not the frontend (`FORBIDDEN`)');

const credentialsBody = (schema: z.ZodType): Json => ({
  required: true,
  content: json(jsonSchemaOf(schema)),
});

const refreshCookieNote =
  'Sets the rotating refresh token as an httpOnly, SameSite=Lax cookie scoped to `/api/auth`.';

export const openApiSpec: Json = {
  openapi: '3.1.0',
  info: {
    title: 'ProfitHQ API',
    version: '0.1.0',
    description:
      'True net profit analytics for Shopify merchants (simulated Shopify data). Money is integer ' +
      'cents; ratios are plain numbers (0.25 = 25%). Metric definitions: `docs/metrics.md`.',
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'JWT access token + rotating refresh cookie.' },
    { name: 'Stores' },
    { name: 'Sync', description: 'Idempotent import of products and orders.' },
    { name: 'Metrics' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        operationId: 'getHealth',
        summary: 'Liveness and database status',
        responses: {
          '200': response('Healthy', ref('HealthReport')),
          '503': response('Database not connected', ref('HealthReport')),
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        operationId: 'register',
        summary: 'Create an account (and its store) and sign in',
        description: refreshCookieNote,
        requestBody: credentialsBody(registerBody),
        responses: {
          '201': response('Account created', ref('AuthResponse')),
          '400': validationError,
          '409': errorResponse('The email is already registered'),
          '429': tooManyRequests,
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        operationId: 'login',
        summary: 'Sign in',
        description: `${refreshCookieNote} A wrong password and an unknown email give the same answer.`,
        requestBody: credentialsBody(loginBody),
        responses: {
          '200': response('Signed in', ref('AuthResponse')),
          '400': validationError,
          '401': errorResponse('Invalid email or password'),
          '429': tooManyRequests,
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        operationId: 'refresh',
        summary: 'Swap the refresh cookie for a new access token',
        description:
          `${refreshCookieNote} The presented token is revoked. Presenting one that was already ` +
          'rotated revokes the whole session (reuse detection) and clears the cookie.',
        security: [{ refreshCookie: [] }],
        responses: {
          '200': response('New access token and rotated cookie', ref('AuthResponse')),
          '401': errorResponse('Missing, unknown, expired or reused refresh token'),
          '403': wrongOrigin,
          '429': tooManyRequests,
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        operationId: 'logout',
        summary: 'Revoke the session and clear the cookie',
        description: 'Idempotent: succeeds even without a session.',
        security: [{ refreshCookie: [] }],
        responses: { '204': { description: 'Signed out' }, '403': wrongOrigin },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        operationId: 'getCurrentUser',
        summary: 'The signed-in user',
        security: secured,
        responses: {
          '200': response('The user', object({ user: ref('User') })),
          '401': errorResponse('Missing, invalid or expired access token'),
        },
      },
    },
    '/stores': {
      get: {
        tags: ['Stores'],
        operationId: 'listStores',
        summary: 'Your stores (the default store is created on first call)',
        security: secured,
        responses: {
          '200': response('Stores', object({ stores: { type: 'array', items: ref('Store') } })),
          '401': errorResponse('Missing, invalid or expired access token'),
        },
      },
    },
    '/stores/{storeId}/sync': {
      post: {
        tags: ['Sync'],
        operationId: 'startSync',
        summary: 'Start a sync',
        description:
          'Answers as soon as the run exists; the sync continues in the background. Follow it with ' +
          '`GET /stores/{storeId}/sync/latest`. If the previous run failed part-way, this one resumes there. ' +
          'Limited to 20 starts per user per 15 minutes.',
        security: secured,
        parameters: storeIdParameters,
        responses: {
          '202': response('Run created', object({ run: ref('SyncRun') })),
          ...authErrors,
          '409': errorResponse('A sync is already running for this store'),
          '429': tooManyRequests,
        },
      },
    },
    '/stores/{storeId}/sync/latest': {
      get: {
        tags: ['Sync'],
        operationId: 'getLatestSync',
        summary: 'The most recent sync run',
        security: secured,
        parameters: storeIdParameters,
        responses: {
          '200': response(
            'The latest run, or null if the store never synced',
            object({ run: { oneOf: [ref('SyncRun'), { type: 'null' }] } }),
          ),
          ...authErrors,
        },
      },
    },
    '/stores/{storeId}/metrics/summary': {
      get: {
        tags: ['Metrics'],
        operationId: 'getMetricsSummary',
        summary: 'Headline metrics with the previous period beside them',
        security: secured,
        parameters: [...storeIdParameters, ...parametersOf('query', summaryQuery)],
        responses: {
          '200': response('Summary', ref('MetricsSummary')),
          '400': validationError,
          ...authErrors,
        },
      },
    },
    '/stores/{storeId}/metrics/trend': {
      get: {
        tags: ['Metrics'],
        operationId: 'getMetricsTrend',
        summary: 'Revenue, COGS, profit and margin per day or month, without gaps',
        security: secured,
        parameters: [...storeIdParameters, ...parametersOf('query', trendQuery)],
        responses: {
          '200': response('Trend', ref('MetricsTrend')),
          '400': validationError,
          ...authErrors,
        },
      },
    },
  },
  components: {
    schemas,
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'refresh_token' },
    },
  },
};

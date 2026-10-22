import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { openApiSpec } from './spec.js';

const spec = openApiSpec as {
  paths: Record<
    string,
    Record<
      string,
      {
        operationId: string;
        parameters?: {
          name: string;
          in: string;
          required: boolean;
          schema: Record<string, unknown>;
        }[];
        requestBody?: unknown;
        responses: Record<string, unknown>;
      }
    >
  >;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
};

/** Every `$ref` string found anywhere inside the value. */
function refsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(refsIn);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      key === '$ref' && typeof child === 'string' ? [child] : refsIn(child),
    );
  }
  return [];
}

const operations = Object.entries(spec.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, operation]) => ({ path, method, operation })),
);

describe('OpenAPI spec', () => {
  it('documents every endpoint of the API', () => {
    const documented = operations
      .map(({ method, path }) => `${method.toUpperCase()} ${path}`)
      .sort();
    expect(documented).toEqual(
      [
        'GET /health',
        'POST /auth/register',
        'POST /auth/login',
        'POST /auth/refresh',
        'POST /auth/logout',
        'GET /auth/me',
        'GET /stores',
        'PATCH /stores/{storeId}/settings',
        'POST /stores/{storeId}/sync',
        'GET /stores/{storeId}/sync/latest',
        'GET /stores/{storeId}/metrics/summary',
        'GET /stores/{storeId}/metrics/trend',
        'GET /stores/{storeId}/inventory/dead-stock',
      ].sort(),
    );
  });

  it('gives every operation a unique id and at least one response', () => {
    const ids = operations.map(({ operation }) => operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { operation } of operations) {
      expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
    }
  });

  it('has no dangling $ref', () => {
    const names = new Set(Object.keys(spec.components.schemas));
    for (const target of refsIn(spec)) {
      expect(target).toMatch(/^#\/components\/schemas\//);
      expect(names).toContain(target.replace('#/components/schemas/', ''));
    }
  });

  it('declares a path parameter for every {placeholder}', () => {
    for (const { path, operation } of operations) {
      for (const [, name] of path.matchAll(/\{(\w+)\}/g)) {
        expect(operation.parameters?.some((p) => p.in === 'path' && p.name === name)).toBe(true);
      }
    }
  });

  it('takes the allowed query values from the same schemas the routes validate with', () => {
    const trend = spec.paths['/stores/{storeId}/metrics/trend']?.get;
    const query = Object.fromEntries(
      (trend?.parameters ?? []).filter((p) => p.in === 'query').map((p) => [p.name, p.schema]),
    );

    expect(query.range).toMatchObject({ enum: ['7d', '30d', '90d'], default: '30d' });
    expect(query.granularity).toMatchObject({ enum: ['day', 'month'], default: 'day' });
  });

  it('describes the registration body from the validation schema', () => {
    const body = spec.paths['/auth/register']?.post?.requestBody as {
      content: {
        'application/json': {
          schema: { properties: Record<string, { minLength?: number }>; required: string[] };
        };
      };
    };
    const schema = body.content['application/json'].schema;

    expect(schema.required).toEqual(expect.arrayContaining(['email', 'password']));
    expect(schema.properties.password?.minLength).toBe(10);
  });
});

describe('docs endpoints (no database needed)', () => {
  const app = createApp({ rateLimits: false });

  it('serves the spec as JSON', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ openapi: '3.1.0', info: { title: 'ProfitHQ API' } });
  });

  it('serves the Swagger UI page and its assets from this server', async () => {
    const page = await request(app).get('/api/docs');
    expect(page.status).toBe(200);
    expect(page.text).toContain('swagger-ui-bundle.js');
    expect(page.text).not.toMatch(/https?:\/\/(?!localhost)/); // no CDN

    const script = await request(app).get('/api/docs/assets/swagger-ui-bundle.js');
    expect(script.status).toBe(200);
    expect((await request(app).get('/api/docs/init.js')).status).toBe(200);
  });

  it('keeps a strict Content-Security-Policy on the docs page', async () => {
    const res = await request(app).get('/api/docs');
    const csp = res.get('Content-Security-Policy') ?? '';

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('leaves the API itself with the full default policy', async () => {
    const res = await request(app).get('/api/health');

    expect(res.get('Content-Security-Policy')).toContain('upgrade-insecure-requests');
  });
});

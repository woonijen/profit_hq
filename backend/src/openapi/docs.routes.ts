import express, { Router } from 'express';
import helmet from 'helmet';
import { absolutePath } from 'swagger-ui-dist';
import { openApiSpec } from './spec.js';

const INIT_SCRIPT = `window.onload = () => {
  window.ui = SwaggerUIBundle({
    url: '/api/openapi.json',
    dom_id: '#swagger-ui',
    persistAuthorization: false,
  });
};
`;

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ProfitHQ API docs</title>
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
    <script src="/api/docs/init.js"></script>
  </body>
</html>
`;

/**
 * `/openapi.json` and the Swagger UI page. The UI's own files are served from the
 * `swagger-ui-dist` package (no CDN) and the page has no inline script, so it runs under the
 * same strict Content-Security-Policy as the API. Only `upgrade-insecure-requests` is dropped
 * for these routes: it makes Safari request the assets over https on http://localhost.
 */
export function createDocsRouter(): Router {
  const router = Router();

  router.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  const docs = Router();
  docs.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: { upgradeInsecureRequests: null },
      },
    }),
  );
  docs.use('/assets', express.static(absolutePath(), { index: false }));
  docs.get('/init.js', (_req, res) => {
    res.type('application/javascript').send(INIT_SCRIPT);
  });
  docs.get('/', (_req, res) => {
    res.type('html').send(PAGE);
  });
  router.use('/docs', docs);

  return router;
}

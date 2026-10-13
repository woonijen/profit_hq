import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
    server: {
      port: 5173,
      // Proxying /api keeps the browser same-origin in dev, so the refresh-token
      // cookie (added in Phase 1) needs no cross-site configuration.
      proxy: {
        '/api': { target: env.DEV_API_PROXY_TARGET ?? 'http://localhost:4000', changeOrigin: true },
      },
    },
  };
});

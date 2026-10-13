import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup-env.ts'],
    // Integration tests share one database, so files run one after another.
    fileParallelism: false,
    // Database-backed tests make many round trips to Atlas.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

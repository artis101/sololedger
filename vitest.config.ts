import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'vitest.config.ts',
        'vite.config.*',
      ],
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
});
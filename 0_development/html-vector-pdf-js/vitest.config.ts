import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['services/**/*.{test,spec}.ts', '__tests__/**/*.{test,spec}.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});

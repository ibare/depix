import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    passWithNoTests: true,
    setupFiles: ['./__tests__/setup.ts'],
  },
});

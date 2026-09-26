import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    env: {
      // Sem logs de request nos testes; a config lê LOG_LEVEL do ambiente.
      LOG_LEVEL: 'silent',
    },
  },
});

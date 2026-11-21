import { defineConfig } from 'vitest/config';

// Testy uruchamiane przez `bun --bun vitest run` (checker uzywa Bun.Glob/Bun.file). Fixtures to dane, nie testy.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/fixtures/**', 'node_modules/**'],
  },
});

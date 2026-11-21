import { defineConfig } from 'vitest/config';

// RuleTester z oxlint/plugins-dev wymaga Node >= 22 (raw transfer AST) - testy biegna pod Node (domyslnie w vitest).
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});

import { defineConfig } from 'vitest/config';

// Testy pod Bunem (`bun --bun vitest run`), obok kodu w folderach jednostek.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });

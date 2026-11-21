import { fileURLToPath } from 'node:url';

import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Testy komponentow i logiki aplikacji: jsdom + Testing Library. Bez wtyczek Start i Cloudflare (testy nie renderuja
// tras przez serwer); alias `@/` jak w tsconfig. Dane w testach pochodza z fabryk i `setQueryData` (bez API).
export default defineConfig({
  plugins: [viteReact()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    clearMocks: true,
  },
});

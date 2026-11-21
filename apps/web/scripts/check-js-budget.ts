// Budzet JS stron publicznych na buildzie produkcyjnym: `vite preview` (workerd) na zbudowanym `dist/`, dla kazdej
// strony suma gzip skryptow z HTML (`<script src>` + `<link rel="modulepreload">`) - tyle JS pobiera przegladarka
// na start. Przekroczenie = kod 1 (CI). Regres typu „kod sekcji w kazdej stronie” (brak sideEffects, barrel)
// wychodzi tu, zanim trafi do uzytkownikow. Uzycie: `bun run build && bun run check:js-budget`.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** Limit gzip JS na strone (KB). Dzis 218-240 KB (Next w kontekst: 246-255); podniesienie = decyzja w PR. */
const BUDGET_KB = 260;
// strona glowna, formularz analizy, raport i gospodarstwo (raport i gospodarstwo bez mapy - nie moga ciagnac MapLibre)
const PAGES = [
  '/',
  '/analiza?dzialki=141201_1.0001.6509',
  '/raport?dzialki=141201_1.0001.6509&uprawa=winter_wheat&data=2026-06-15',
  '/gospodarstwo?dzialki=141201_1.0001.6509,141201_1.0001.6508&uprawa=winter_wheat&data=2026-06-15',
];
const PORT = Number(process.env.JS_BUDGET_PORT ?? 3690);
const BASE = `http://localhost:${PORT}`;
const CLIENT_DIR = join(import.meta.dirname, '..', 'dist', 'client');

function scriptsOf(html: string): string[] {
  const sources = [
    ...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g),
    ...html.matchAll(/<link rel="modulepreload"[^>]*\shref="([^"]+)"/g),
  ].map((match) => match[1] ?? '');

  return [...new Set(sources.filter((source) => source.startsWith('/assets/')))];
}

function gzipKb(path: string): number {
  return gzipSync(readFileSync(join(CLIENT_DIR, path))).length / 1024;
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      // serwer jeszcze nie slucha
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`vite preview nie wystartowal na ${BASE}`);
}

const server = spawn('bunx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: join(import.meta.dirname, '..'),
  stdio: 'ignore',
});
let failed = false;

try {
  await waitForServer();

  for (const page of PAGES) {
    const scripts = scriptsOf(await (await fetch(BASE + page)).text());
    const total = scripts.reduce((sum, script) => sum + gzipKb(script), 0);
    const over = total > BUDGET_KB;

    failed ||= over;
    console.log(
      `${over ? 'PRZEKROCZONY' : 'ok'.padEnd(11)} ${page.padEnd(12)} ${total.toFixed(0)} KB gzip (${scripts.length} plikow)`,
    );
  }
} finally {
  server.kill();
}

if (failed) {
  console.error(`Budzet JS ${BUDGET_KB} KB gzip na strone przekroczony.`);
  process.exit(1);
}

// Raporty wzorcowe do oddania (`docs/samples/*.pdf`): Playwright otwiera raport na dzialajacym serwerze z prawdziwym
// API (`bun run --cwd apps/web dev -- --port 3310`), czeka na pelny raport i szkic, drukuje A4 tak, jak przegladarka
// ("Drukuj / zapisz PDF"). Nie jest czescia e2e: woła prawdziwe zrodla (GUGiK ma nocny limit), wiec uruchamiamy recznie,
// jeden raport po drugim. Uzycie: `bun run --cwd apps/web samples:pdf` (SAMPLES_BASE_URL zmienia serwer).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.SAMPLES_BASE_URL ?? 'http://localhost:3310';
const OUT_DIR = join(import.meta.dirname, '../../../docs/samples');

/** Trzy przypadki z rozna diagnoza: susza z rowem przez pole, nadmiar wody na lace, susza na slabej glebie. */
const SAMPLES = [
  {
    file: 'raport-susza-row-przez-pole-349-1.pdf',
    search: { dzialki: '080904_5.0001.349/1', uprawa: 'winter_wheat', data: '2018-06-15' },
  },
  {
    file: 'raport-nadmiar-wody-laka-39-2.pdf',
    search: { dzialki: '141507_2.0010.39/2', uprawa: 'grassland', data: '2017-09-20' },
  },
  {
    file: 'raport-susza-slaba-gleba-254.pdf',
    search: { dzialki: '141507_2.0019.254', uprawa: 'spring_barley', data: '2023-06-20' },
  },
] as const;

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

try {
  for (const sample of SAMPLES) {
    const page = await browser.newPage({
      locale: 'pl-PL',
      timezoneId: 'Europe/Warsaw',
      colorScheme: 'light',
    });
    const url = `${BASE}/raport?${new URLSearchParams(sample.search).toString()}`;

    await page.goto(url);
    await page.getByTestId('verdict').waitFor({ timeout: 90_000 });
    await page.locator('[data-hydro="ready"], [data-hydro="unavailable"]').waitFor({ timeout: 30_000 });
    await page.emulateMedia({ media: 'print' });
    // otwiera szczegoly dla doradcy jak przed prawdziwym wydrukiem (`beforeprint`)
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.evaluate(() => document.fonts.ready);

    const path = join(OUT_DIR, sample.file);

    await page.pdf({ path, preferCSSPageSize: true, printBackground: true });
    console.log(`${sample.file} <- ${url}`);
    await page.close();
  }
} finally {
  await browser.close();
}

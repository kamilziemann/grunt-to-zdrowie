// Raporty wzorcowe do oddania (`docs/samples/*.pdf`): Playwright otwiera raport na dzialajacym serwerze z prawdziwym
// API (`bun run --cwd apps/web dev -- --port 3310`), czeka na pelny raport i szkic, drukuje A4 tak, jak przegladarka
// ("Drukuj / zapisz PDF") razem z obrazami "Pole z satelity". Nie jest czescia e2e: woła prawdziwe zrodla (GUGiK ma nocny limit), wiec uruchamiamy recznie,
// jeden raport po drugim. Uzycie: `bun run --cwd apps/web samples:pdf` (SAMPLES_BASE_URL zmienia serwer).
// Adres w naglowku i krotki link to adres wdrozenia (SAMPLES_PUBLIC_URL), nie `localhost`: przegladarka otwiera
// adres wdrozenia, a skrypt podaje tresc z serwera lokalnego (SAMPLES_API_URL - osobny serwer API, np. z nowszym
// silnikiem przed scaleniem).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.SAMPLES_BASE_URL ?? 'http://localhost:3310';
const PUBLIC = process.env.SAMPLES_PUBLIC_URL ?? 'https://grunt-to-zdrowie.hoxu.workers.dev';
const API = process.env.SAMPLES_API_URL ?? BASE;
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
    const url = `${PUBLIC}/raport?${new URLSearchParams(sample.search).toString()}`;

    // wszystko z adresu wdrozenia idzie do serwera lokalnego (strony) albo serwera API (`/api/...`)
    await page.route(`${PUBLIC}/**`, async (route) => {
      const target = new URL(route.request().url());
      const server = target.pathname.startsWith('/api/') ? API : BASE;
      const response = await route.fetch({
        url: `${server}${target.pathname}${target.search}`,
        timeout: 90_000,
      });

      await route.fulfill({ response });
    });
    await page.goto(url);
    await page.getByTestId('short-analysis').waitFor({ timeout: 90_000 });
    await page.locator('[data-hydro="ready"], [data-hydro="unavailable"]').waitFor({ timeout: 30_000 });
    // "Pole z satelity" jak po kliknieciu "Zapisz PDF": rozwiniecie pobiera oba obrazy, czekamy na wynik (obraz albo
    // jedno zdanie o braku zdjecia); pierwsze pobranie z Copernicus trwa do kilkunastu sekund
    await page.evaluate(() => {
      const section = document.querySelector<HTMLDetailsElement>('[data-testid="satellite-section"]');

      if (section) section.open = true;
    });
    await page
      .locator(
        '[data-testid="satellite-images"], [data-testid="satellite-problem"], [data-testid="satellite-none"]',
      )
      .first()
      .waitFor({ state: 'attached', timeout: 90_000 });
    await page
      .locator('[data-testid="satellite-loading"]')
      .first()
      .waitFor({ state: 'detached', timeout: 90_000 });
    await page.evaluate(async () => {
      await Promise.allSettled(
        [...document.querySelectorAll<HTMLImageElement>('img[data-satellite-image]')].map((image) =>
          image.decode(),
        ),
      );
    });
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

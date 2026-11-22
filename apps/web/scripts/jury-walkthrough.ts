// Przejscie sciezki jury w Chromium, Firefoksie i WebKit (silnik Safari), na komputerze i telefonie: strona glowna ->
// numer dzialki -> "Czy to Twoja dzialka?" -> uprawa i dzien -> liczenie -> raport (prosto, szczegolowo) -> wydruk;
// do tego mapa (klik w dzialke), "Tylko czesc" (podzial linia) i panel "Warstwy". Na kazdym kroku zrzut ekranu
// i notatka: blad strony, przewijanie w poziomie, stan mapy. Nie jest czescia e2e: woła prawdziwe uslugi (GUGiK ma
// limit zapytan), wiec kombinacje ida jedna po drugiej, z przerwa. Raport policzony raz wraca z zapisu.
// Uzycie: `bun run --cwd apps/web walkthrough` (WALKTHROUGH_BASE_URL - serwer, domyslnie wdrozenie;
// WALKTHROUGH_OUT - katalog zrzutow; WALKTHROUGH_ONLY=firefox-phone - jedna kombinacja; WALKTHROUGH_FLOWS=number,map;
// WALKTHROUGH_API_URL - `/api` brane z innego serwera, np. lokalny build ze stronami i dane z wdrozenia, bez liczenia
// raportu od nowa).
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContextOptions,
  type BrowserType,
  type Page,
} from '@playwright/test';

const BASE = process.env.WALKTHROUGH_BASE_URL ?? 'https://grunt-to-zdrowie.hoxu.workers.dev';
const OUT = process.env.WALKTHROUGH_OUT ?? join(tmpdir(), 'jury-walkthrough');
const ONLY = process.env.WALKTHROUGH_ONLY;
const FLOWS = (process.env.WALKTHROUGH_FLOWS ?? 'number,map,part,layers').split(',');
const API = process.env.WALKTHROUGH_API_URL;

const PARCEL = '080904_5.0001.349/1';
// srodek dzialki 349/1 (Chwalim) - z ULDK, zeby kliknac w nia na mapie bez wyszukiwania
const CENTER = [15.82695, 52.04205] as const;
const VIEW = [CENTER[0] - 0.004, CENTER[1] - 0.0025, CENTER[0] + 0.004, CENTER[1] + 0.0025].join(',');
const PAUSE_MS = 4000;

const ENGINES: Record<string, BrowserType> = { chromium, firefox, webkit };

interface Device {
  name: 'desktop' | 'phone';
  options: (engine: string) => BrowserContextOptions;
}

const DEVICES: Device[] = [
  { name: 'desktop', options: () => ({ viewport: { width: 1366, height: 850 } }) },
  {
    name: 'phone',
    // Firefox w Playwright nie ma trybu `isMobile` - telefon to waskie okno z dotykiem
    options: (engine) => ({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: engine !== 'firefox',
      deviceScaleFactor: engine === 'firefox' ? 1 : 2,
    }),
  },
];

interface Note {
  combo: string;
  step: string;
  problems: string[];
}

const notes: Note[] = [];

/** Zrzut kroku i to, co da sie zmierzyc bez oka: przewijanie w poziomie i bledy z konsoli od poprzedniego kroku. */
async function shot(page: Page, combo: string, step: string, errors: string[], fullPage = false) {
  const problems = errors.splice(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  if (overflow > 1) problems.push(`przewijanie w poziomie: ${overflow}px`);

  await page.screenshot({ path: join(OUT, combo, `${step}.png`), fullPage });
  notes.push({ combo, step, problems });
}

async function attempt(combo: string, step: string, action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    notes.push({ combo, step, problems: [`NIE DZIALA: ${String(error).split('\n')[0]}`] });
  }
}

async function waitForMapReady(page: Page, timeout = 30_000) {
  await page.locator('[data-testid="parcel-map"][data-map-state="ready"]').first().waitFor({ timeout });
}

async function numberFlow(page: Page, combo: string, errors: string[]) {
  await page.goto(BASE);
  await shot(page, combo, '01-home', errors);
  // fokus z klawiatury: kilka Tabow od poczatku strony
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await shot(page, combo, '02-home-focus', errors);
  await page.getByRole('searchbox', { name: 'Numer działki albo nazwa wsi i numer' }).fill(PARCEL);
  await page.getByRole('button', { name: 'Sprawdź działkę' }).first().click();
  await page.waitForURL(/\/analiza/);
  await page.getByTestId('parcel-facts').waitFor({ timeout: 30_000 });
  await shot(page, combo, '03-check-loading', errors);
  await attempt(combo, '04-check-map', async () => {
    await waitForMapReady(page);
    await page.waitForTimeout(1500);
    await shot(page, combo, '04-check-map', errors);
  });
  await page.locator('label').filter({ hasText: 'Zboża ozime' }).first().click();
  await page.getByText('Inny dzień').click();
  await page.locator('input[type="date"]').fill('2018-06-15');
  await shot(page, combo, '05-check-form', errors);
  await page.locator('input[type="date"]').scrollIntoViewIfNeeded();
  await shot(page, combo, '05b-check-date', errors);
  await page.getByRole('button', { name: 'Analizuj działkę' }).click();
  await page.waitForURL(/\/raport/);
  await shot(page, combo, '06-counting', errors);
  await page.getByTestId('verdict-word').waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  await shot(page, combo, '07-report-simple', errors);
  await shot(page, combo, '07b-report-simple-full', errors, true);
  await attempt(combo, '08-copy-link', async () => {
    await page
      .getByRole('button', { name: /Kopiuj link|Udostępnij/ })
      .first()
      .click();
    await page.waitForTimeout(500);
    await shot(page, combo, '08-copy-link', errors);
  });
  await page.getByTestId('view-switch').getByRole('link', { name: 'Szczegółowo' }).click();
  await page.getByTestId('report-details').waitFor();
  await page.waitForTimeout(2000);
  await shot(page, combo, '09-report-detailed-full', errors, true);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForTimeout(1000);
  await shot(page, combo, '10-print-full', errors, true);
  await page.emulateMedia({ media: 'screen' });
}

async function mapFlow(page: Page, combo: string, errors: string[]) {
  await page.goto(BASE);
  await page
    .getByRole('link', { name: /Nie znam numeru/ })
    .first()
    .click();
  await page.waitForURL(/\/mapa/);
  await attempt(combo, '11-map', async () => {
    await waitForMapReady(page);
    await shot(page, combo, '11-map', errors);
  });
  await page.goto(`${BASE}/mapa?widok=${VIEW}`);
  await waitForMapReady(page);
  await page.waitForTimeout(2000);

  const box = await page.locator('[data-testid="parcel-map"] canvas').first().boundingBox();

  if (!box) throw new Error('brak mapy');

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(4000);
  await shot(page, combo, '12-map-clicked', errors);
}

async function partFlow(page: Page, combo: string, errors: string[]) {
  await page.goto(`${BASE}/analiza?dzialki=${PARCEL}`);
  await page.getByRole('link', { name: 'Tylko część' }).click();
  await page.waitForURL(/rysuj=podziel/);
  await waitForMapReady(page);
  await page.waitForTimeout(3000);
  await shot(page, combo, '13-split', errors);

  const box = await page.locator('[data-testid="parcel-map"] canvas').first().boundingBox();

  if (!box) throw new Error('brak mapy');

  const y = box.y + box.height / 2;
  const tap = async (x: number, ty: number) => {
    if (combo.endsWith('phone') && !combo.startsWith('firefox')) await page.touchscreen.tap(x, ty);
    else await page.mouse.click(x, ty);

    await page.waitForTimeout(700);
  };

  // linia pionowa przez srodek dzialki, potem wybor lewej czesci
  await tap(box.x + box.width / 2, box.y + box.height * 0.15);
  await tap(box.x + box.width / 2, box.y + box.height * 0.85);
  await shot(page, combo, '14-split-line', errors);
  await tap(box.x + box.width * 0.4, y);
  await shot(page, combo, '15-split-part', errors);
  await attempt(combo, '16-split-done', async () => {
    await page.getByRole('link', { name: /Gotowe/ }).click();
    await page.waitForURL(/obszar=/, { timeout: 10_000 });
    await page.getByTestId('own-area').waitFor();
    await shot(page, combo, '16-split-done', errors);
  });
}

async function layersFlow(page: Page, combo: string, errors: string[]) {
  await page.goto(`${BASE}/mapa?dzialki=${PARCEL}`);
  await waitForMapReady(page);
  await page.getByTestId('layers-button').click();
  await page.getByTestId('layers-panel').waitFor();
  await shot(page, combo, '17-layers', errors);

  const panel = page.getByTestId('layers-panel');

  await attempt(combo, '18-layers-ortho-hydro', async () => {
    await panel.getByRole('radio', { name: /Zdjęcie lotnicze/ }).check();
    await panel.getByRole('checkbox', { name: /Rowy i cieki/ }).check();
    await page.waitForTimeout(4000);
    await shot(page, combo, '18-layers-ortho-hydro', errors);
  });
  await attempt(combo, '19-layers-moisture', async () => {
    await panel.getByText('Woda w roślinach').first().click();
    await page.waitForTimeout(20_000);
    await shot(page, combo, '19-layers-moisture', errors);
  });
}

const FLOW_FNS: Record<string, (page: Page, combo: string, errors: string[]) => Promise<void>> = {
  number: numberFlow,
  map: mapFlow,
  part: partFlow,
  layers: layersFlow,
};

async function runCombo(browser: Browser, engine: string, device: Device) {
  const combo = `${engine}-${device.name}`;

  mkdirSync(join(OUT, combo), { recursive: true });

  for (const flow of FLOWS) {
    const run = FLOW_FNS[flow];

    if (!run) continue;

    const context = await browser.newContext({
      ...device.options(engine),
      locale: 'pl-PL',
      timezoneId: 'Europe/Warsaw',
      colorScheme: 'light',
    });

    if (API) {
      await context.route(`${BASE}/api/**`, async (route) => {
        const request = route.request();
        const target = new URL(request.url());
        // zwykly fetch zamiast `route.fetch`: ten niesie naglowek Host serwera lokalnego
        const response = await fetch(`${API}${target.pathname}${target.search}`, {
          method: request.method(),
          headers: { 'content-type': request.headers()['content-type'] ?? 'application/json' },
          body: request.postData() ?? undefined,
          signal: AbortSignal.timeout(90_000),
        });

        await route.fulfill({
          status: response.status,
          contentType: response.headers.get('content-type') ?? undefined,
          body: Buffer.from(await response.arrayBuffer()),
        });
      });
    }

    const page = await context.newPage();
    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(`blad strony: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`konsola: ${message.text().slice(0, 200)}`);
    });
    await attempt(combo, flow, () => run(page, combo, errors));
    await context.close();
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
}

mkdirSync(OUT, { recursive: true });

for (const [engine, type] of Object.entries(ENGINES)) {
  const devices = DEVICES.filter((device) => !ONLY || ONLY === `${engine}-${device.name}`);

  if (devices.length === 0) continue;

  const browser = await type.launch();

  try {
    for (const device of devices) await runCombo(browser, engine, device);
  } finally {
    await browser.close();
  }
}

writeFileSync(join(OUT, 'notes.json'), JSON.stringify(notes, null, 2));

for (const note of notes.filter((item) => item.problems.length > 0)) {
  console.log(`${note.combo} ${note.step}: ${note.problems.join(' | ')}`);
}

console.log(`Zrzuty i notatki: ${OUT}`);

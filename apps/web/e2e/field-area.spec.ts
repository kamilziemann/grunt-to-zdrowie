import { expect, test } from './support/test';
import { mockAnalysisApi, PARCEL, PARCEL_ID } from './support/analysis-api';
import { expectNoViolations } from './support/axe';
import { mockMapServices, waitForMap } from './support/map-services';
import { expectTouchTargets } from './support/touch-targets';

// Wlasne pole (D3): tryb rysowania na mapie i analiza obszaru z adresu. Podklad mapy to usluga zewnetrzna, wiec
// stukanie w mape (punkty, podzial linia) sprawdzaja testy jednostkowe geometrii i trybu oraz przeglad reczny;
// tu: panel trybu, przejscie obszaru z adresu przez formularz do zadania analizy (geometria w POST).
const SQUARE = 'g54jEo5t-JmDsDREpBBvBA';
const OUTLINE = { id: PARCEL.id, number: PARCEL.number, geometry: PARCEL.geometry, center: PARCEL.centroid };

test.describe('własne pole', () => {
  test('tryb rysowania: panel, podział wymaga jednej działki, analiza zablokowana do zamknięcia obszaru', async ({
    page,
  }) => {
    await mockAnalysisApi(page);
    await page.goto('/mapa');

    await expect(page.getByRole('button', { name: 'Podziel działkę linią' })).toBeDisabled();
    await page.getByRole('button', { name: 'Obrysuj pole na mapie' }).click();

    const panel = page.getByTestId('field-draw');

    await expect(panel.getByRole('heading', { level: 1, name: 'Obrysuj swoje pole' })).toBeVisible();
    await expect(page.getByTestId('field-area')).toHaveText('Brak punktów');
    await expect(page.getByTestId('field-draw-hint')).toHaveText(/Stuknij narożniki swojego pola/);
    await expect(panel.getByRole('radio', { name: 'Podziel linią' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Gotowe – dalej' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cofnij' })).toBeDisabled();
    await expectNoViolations(page);

    await panel.getByRole('button', { name: 'Anuluj' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toBeVisible();
  });

  test(
    '„Tylko część” z kroku działki: mapa od razu w podziale, podpowiedzi prowadzą krok po kroku',
    { tag: '@smoke' },
    async ({ page }) => {
      await mockAnalysisApi(page);
      await mockMapServices(page);
      await page.goto(`/analiza?dzialki=${PARCEL_ID}`);
      await page.getByRole('link', { name: 'Tylko część' }).click();

      await expect(page).toHaveURL(/\/mapa\?dzialki=.*&rysuj=podziel/);

      const hint = page.getByTestId('field-draw-hint');

      await expect(page.getByRole('heading', { level: 1, name: 'Pokaż swoją część działki' })).toBeVisible();
      await expect(hint).toHaveText(/Stuknij na mapie początek linii/);
      await waitForMap(page);

      // linia przez srodek mapy (dzialka jest wysrodkowana): poczatek nad nia, koniec pod nia
      const box = await page.getByTestId('parcel-map').boundingBox();

      if (!box) throw new Error('brak mapy');

      // srodek widocznej czesci mapy (na komputerze panel zaslania lewe 25 rem), ponizej podpowiedzi
      const x = box.x + 400 + (box.width - 400) / 2;

      // mapa najpierw dojezdza do dzialki (animacja) - stukniecie w trakcie ruchu MapLibre bierze za przeciagniecie
      await page.waitForTimeout(1500);
      await page.mouse.click(x, box.y + box.height * 0.35);
      await expect(hint).toHaveText(/Teraz stuknij koniec linii/);
      await page.getByRole('button', { name: 'Cofnij' }).click();
      await expect(hint).toHaveText(/Stuknij na mapie początek linii/);
    },
  );

  test('obrys pola: stuknięcia dodają punkty, działka pod nimi się nie podświetla ani nie wybiera', async ({
    page,
  }) => {
    await mockAnalysisApi(page);
    await mockMapServices(page);
    // granice z jedna dzialka pod srodkiem mapy - klikniecie poza trybem rysowania by ja zaznaczylo
    await page.route('**/api/parcels/boundaries**', (route) =>
      route.fulfill({ json: { items: [OUTLINE], truncated: false } }),
    );
    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await waitForMap(page);

    const map = page.getByTestId('parcel-map');
    const box = await map.boundingBox();

    if (!box) throw new Error('brak mapy');

    // dzialka stoi na srodku czesci mapy obok panelu (lewe 25 rem); czekamy na koniec dojazdu
    const x = box.x + 400 + (box.width - 400) / 2;
    const y = box.y + box.height / 2;
    // narozniki w srodku trojkatnej dzialki - kazde stukniecie trafia w nia
    const corners = [
      [x + 5, y - 40],
      [x + 45, y - 40],
      [x + 15, y + 10],
    ] as const;

    await expect(map).toHaveAttribute('data-map-zoom', /\d/);
    await page.waitForTimeout(1500);
    // poza trybem rysowania dzialka pod kursorem sie podswietla (atrybut diagnostyczny mapy)
    // (granice dociagaja sie po dojezdzie, wiec ruszamy kursorem, az warstwa trafi pod niego)
    await expect
      .poll(async () => {
        await page.mouse.move(corners[0][0] - 10, corners[0][1], { steps: 2 });
        await page.mouse.move(corners[0][0], corners[0][1], { steps: 2 });

        return map.getAttribute('data-map-hover');
      })
      .toBe(PARCEL_ID);

    await page.getByRole('button', { name: 'Obrysuj pole na mapie' }).click();
    await expect(map).toHaveAttribute('data-map-hover', '');

    const parcelRequests: string[] = [];

    page.on('request', (request) => {
      if (/\/api\/parcels\/(at|by-id)/.test(request.url())) parcelRequests.push(request.url());
    });

    for (const [cornerX, cornerY] of corners) {
      await page.mouse.click(cornerX, cornerY);
      await expect(map).toHaveAttribute('data-map-hover', '');
    }

    await expect(page.getByTestId('field-area')).toContainText('ha');
    expect(parcelRequests).toEqual([]);

    // Cofnij zdejmuje ostatni punkt, Anuluj wraca do listy z wybrana dzialka
    await page.getByRole('button', { name: 'Cofnij' }).click();
    await expect(page.getByTestId('field-area')).not.toContainText('ha');
    await page.getByTestId('field-draw').getByRole('button', { name: 'Anuluj' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toBeVisible();
    await expect(page.getByText('Działka 6509').first()).toBeVisible();
    expect(parcelRequests).toEqual([]);
  });

  test('obszar z adresu: podsumowanie, formularz i zapytanie z geometrią zamiast całej działki', async ({
    page,
  }) => {
    await mockAnalysisApi(page);

    const body = page.waitForRequest((request) => request.url().endsWith('/api/analysis'));

    await page.goto(`/analiza?dzialki=${PARCEL_ID}&obszar=${SQUARE}&rodzaj=part`);
    await expect(page.getByTestId('own-area')).toContainText('Część działki 6509');
    await page.locator('label[data-crop="winter_wheat"]').click();
    await page.getByRole('button', { name: 'Analizuj działkę' }).click();

    await expect(page).toHaveURL(new RegExp(`obszar=${SQUARE}&rodzaj=part&uprawa=winter_wheat`));

    const request = JSON.parse((await body).postData() ?? '{}') as {
      field: { kind?: string; parcelIds?: string[]; label?: string; geometry?: { type: string } };
    };

    expect(request.field).toMatchObject({
      kind: 'part',
      parcelIds: [PARCEL_ID],
      label: 'Część działki 6509',
      geometry: { type: 'Polygon' },
    });
    await expect(page.getByTestId('short-analysis')).toBeVisible();
  });

  test('uszkodzony obszar w linku raportu prosi o ponowny wybór', async ({ page }) => {
    await page.goto(`/raport?obszar=%21%21&uprawa=winter_wheat&data=2026-06-15`);

    await expect(page.getByRole('heading', { level: 1, name: 'Brakuje danych do raportu' })).toBeVisible();
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('pasek trybu: cofnij i analizuj zawsze widoczne, duże cele, bez poziomego przewijania', async ({
      page,
    }) => {
      await page.goto('/mapa');
      await page.getByRole('button', { name: 'Obrysuj pole na mapie' }).click();

      await expect(page.getByRole('button', { name: 'Gotowe – dalej' })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Cofnij' })).toBeInViewport();
      await expect(page.getByTestId('field-draw-hint')).toBeInViewport();
      await expectTouchTargets(
        page
          .getByTestId('field-draw')
          .getByRole('button')
          .or(page.getByRole('button', { name: /^Cofnij$|Gotowe – dalej/ })),
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    });
  });
});

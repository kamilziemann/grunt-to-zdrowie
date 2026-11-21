import type { AppHref } from '@/lib/routes';
import type { WaterReport } from '@app/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl, translator } from '@/test/render-intl';

import { DROUGHT_REPORT } from '../../fixtures/drought-report';
import { FIELD_REPORT } from '../../fixtures/field-report';
import { FOREST_REPORT } from '../../fixtures/forest-report';
import { LOW_CONFIDENCE_REPORT } from '../../fixtures/low-confidence-report';
import { SAMPLE_REPORT } from '../../fixtures/sample-report';
import { ReportView } from './report-view';

const t = translator('report');
const CHANGE = '/analiza' as AppHref;
const MAP = '/' as AppHref;

function renderReport(report: WaterReport = SAMPLE_REPORT, grasslandHref?: AppHref) {
  // mapa pola pobiera kafle hydrografii przez TanStack Query (w jsdom bez sieci - warstwa "niedostepna")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return renderWithIntl(
    <QueryClientProvider client={client}>
      <ReportView report={report} changeHref={CHANGE} mapHref={MAP} grasslandHref={grasslandHref} />
    </QueryClientProvider>,
  );
}

const realReport: WaterReport = {
  ...SAMPLE_REPORT,
  meta: { ...SAMPLE_REPORT.meta, sample: false, status: 'complete' },
  sources: SAMPLE_REPORT.sources.map((source) => Object.assign(structuredClone(source), { sample: false })),
};

describe('ReportView', () => {
  it('sekcje w kolejnosci konkursowej: ocena, historia, przyczyny, retencja, agrotechnika, nawadnianie, zrodla', () => {
    renderReport();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

    expect(headings).toEqual(
      ['verdict', 'history', 'causes', 'retention', 'agrotech', 'irrigation', 'sources'].map(
        (key, index) => `${index + 1}.${t(`sections.${key}` as 'sections.verdict')}`,
      ),
    );
  });

  it('pierwsza linia mowi jezykiem rolnika, bez skrotow technicznych', () => {
    renderReport();

    const verdict = screen.getByTestId('verdict');

    expect(verdict).toHaveTextContent(t('verdict.sentences.risk'));
    expect(verdict.textContent).not.toMatch(/NDVI|NDMI|KBW|FAO/);
  });

  it('dane przykladowe = baner ostrzegawczy; prawdziwe dane = bez banera', () => {
    const { unmount } = renderReport();

    expect(screen.getByTestId('sample-banner')).toHaveTextContent(t('sample.title'));
    unmount();
    renderReport(realReport);
    expect(screen.queryByTestId('sample-banner')).toBeNull();
    expect(screen.queryByTestId('report-status')).toBeNull();
  });

  it('brak danych zrodla nazwany wprost', () => {
    renderReport();

    const forecast = screen
      .getAllByRole('listitem')
      .find((item) => item.getAttribute('data-source') === 'forecast');

    expect(forecast).toBeDefined();
    expect(within(forecast as HTMLElement).getByText(t('sources.status.missing'))).toBeInTheDocument();
  });

  it('puste listy i brak nawadniania maja wlasne zdania', () => {
    renderReport({
      ...realReport,
      causes: [],
      recommendations: { retention: [], agrotech: [], irrigation: null },
      limitations: [],
      history: { ...realReport.history, seasons: [], calendar: [], seasonsWithData: 0, riskMonths: [] },
      assessment: {
        ...realReport.assessment,
        level: 'unknown',
        rootZone: null,
        vegetation: null,
        precipitation: null,
        climaticBalance: null,
      },
    });

    expect(screen.getByText(t('causes.none'))).toBeInTheDocument();
    expect(screen.getByText(t('recommendations.none.retention'))).toBeInTheDocument();
    expect(screen.getByText(t('recommendations.none.agrotech'))).toBeInTheDocument();
    expect(screen.getByText(t('irrigation.none'))).toBeInTheDocument();
    expect(screen.getByText(t('history.noData'))).toBeInTheDocument();
    expect(screen.getByText(t('sources.limitationsNone'))).toBeInTheDocument();
    expect(screen.getByTestId('verdict')).toHaveTextContent(t('verdict.levels.unknown'));
  });

  it('raport z prawdziwego silnika: czesci przykladowe oznaczone, ten rok na tle lat, scenariusze gleby', () => {
    renderReport(DROUGHT_REPORT);

    // przyczyny i zalecenia z regul przykladowych, ocena i historia nie
    const marked = screen
      .getAllByTestId('sample-part')
      .map((marker) => marker.closest('section')?.getAttribute('data-report-section'));

    expect(marked).toEqual(['przyczyny', 'retencja', 'agrotechnika', 'nawadnianie']);
    expect(screen.getByTestId('sample-banner')).toHaveTextContent('przyczyny, strefy na polu i zalecenia');

    const summary = screen.getByTestId('history-summary');

    expect(summary).toHaveTextContent('W żadnym z 10 poprzednich sezonów');
    expect(summary).toHaveTextContent('najsuchszy taki okres z 11 lat');
    expect(summary).toHaveTextContent('31 dni z niedoborem wody');
    expect(screen.getByTestId('soil-scenarios')).toHaveTextContent(
      'Na glebie lżejszej (kategoria I, II) byłaby susza, na cięższej (III, IV) nie.',
    );
  });

  it('nawadnianie: laczny niedobor, nie jedna dawka; czas przeszly dla dawnej daty', () => {
    renderReport(DROUGHT_REPORT);

    expect(screen.getByTestId('irrigation-deficit')).toHaveTextContent('brakuje ok. 136 l/m²');
    expect(screen.getByText(t('irrigation.deficitNote'))).toBeInTheDocument();
    expect(screen.getByText(t('irrigation.advisablePast.yes'))).toBeInTheDocument();
  });

  it('jedna atrapa: ograniczenie nie mowi, ze wyniki nie opisuja pola; numer dzialki w pelnej szerokosci', () => {
    renderReport(LOW_CONFIDENCE_REPORT);

    const limitation = document.querySelector('[data-limitation="sample_data"]');

    expect(limitation).toHaveTextContent('Część danych jest jeszcze przykładowa');
    expect(limitation).not.toHaveTextContent('Wyniki nie opisują tego pola');
    expect(screen.getByText('141201_1.0001.6509').parentElement).toHaveClass('col-span-2');
  });

  it('zaden identyfikator miary ani jednostki nie trafia na ekran', () => {
    const { container } = renderReport({
      ...DROUGHT_REPORT,
      causes: [
        ...DROUGHT_REPORT.causes,
        {
          id: 'fast_drainage',
          weight: 0.2,
          evidence: [{ metric: 'brand_new_metric', value: 3, unit: 'weird_unit', source: 'hydro' }],
        },
      ],
    });
    // dowody stoja przy przyczynach i zaleceniach (identyfikator dzialki z podkresleniem jest w naglowku celowo)
    const text = [...container.querySelectorAll('[data-report-section]')]
      .filter((section) => section.getAttribute('data-report-section') !== 'zrodla')
      .map((section) => section.textContent)
      .join(' ');

    expect(text).not.toMatch(/[a-z0-9]+_[a-z0-9_]+/);
    expect(text).not.toMatch(/\bshare\b/);
    expect(text).toContain(t('evidence.unknownMetric'));
  });

  it('przeglad: "woda w normie" przy niskiej pewnosci ma zastrzezenie, jedna atrapa nie robi calego raportu przykladowym', () => {
    renderReport(LOW_CONFIDENCE_REPORT);

    const verdict = screen.getByTestId('verdict');

    expect(verdict).toHaveTextContent(t('verdict.levels.ok'));
    expect(within(verdict).getByTestId('verdict-caveat')).toHaveTextContent(t('verdict.caveat.title'));
    expect(within(verdict).getByTestId('verdict-caveat')).toHaveTextContent(
      t('verdict.caveat.reasons.soil_missing'),
    );

    const banner = screen.getByTestId('sample-banner');

    expect(banner).toHaveAttribute('data-scope', 'some');
    expect(banner).toHaveTextContent('Jedno źródło danych jest jeszcze przykładowe: ukształtowanie terenu');
    expect(banner).not.toHaveTextContent(t('sample.title'));
  });

  it('noty zrodel (po angielsku) tylko w szczegolach dla doradcy; w glownym widoku zdanie po polsku', () => {
    renderReport(LOW_CONFIDENCE_REPORT);

    const soil = screen
      .getAllByRole('listitem')
      .find((item) => item.getAttribute('data-source') === 'soil') as HTMLElement;

    expect(soil).toHaveTextContent(t('sources.statusNote.missing'));

    const note = within(soil).getByTestId('source-note');

    expect(note.tagName).toBe('DETAILS');
    expect(note).not.toHaveAttribute('open');
    expect(note).toHaveTextContent(/no SoilGrids prediction/);
  });

  describe('uzytek z ewidencji', () => {
    const landUse = (patch: Partial<NonNullable<WaterReport['landUse']>>): WaterReport => ({
      ...realReport,
      landUse: {
        codes: ['RIVb', 'RV', 'RVI', 'ŁV', 'W/ŁV'],
        kinds: ['arable', 'meadow', 'ditches'],
        agricultural: true,
        soilClasses: ['IVb', 'V', 'VI'],
        cropHint: 'grassland',
        mismatch: null,
        registryAreaHa: 19.3485,
        ...patch,
      },
    });

    it('grunt nierolny: ramka na gorze raportu, przed ocena, slowami rolnika', () => {
      renderReport(
        landUse({ codes: ['LsV'], kinds: ['forest'], agricultural: false, mismatch: 'non_agricultural' }),
      );

      const notice = screen.getByTestId('land-use-notice');

      expect(notice).toHaveTextContent(t('landUse.nonAgriculturalTitle', { kinds: 'las' }));
      expect(notice).toHaveTextContent(t('landUse.nonAgriculturalText'));
      expect(
        notice.compareDocumentPosition(screen.getByTestId('verdict')) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(notice.textContent).not.toMatch(/LsV/);
    });

    it('same laki: spokojna podpowiedz z linkiem do raportu dla uzytkow zielonych', () => {
      renderReport(
        landUse({ codes: ['ŁIV', 'PsV'], kinds: ['meadow', 'pasture'], mismatch: 'grassland_only' }),
        '/raport?uprawa=grassland' as AppHref,
      );

      const notice = screen.getByTestId('land-use-notice');

      expect(notice).toHaveTextContent(t('landUse.grasslandTitle', { kinds: 'łąka i pastwisko' }));
      expect(within(notice).getByRole('link', { name: t('landUse.grasslandLink') })).toHaveAttribute(
        'href',
        '/raport?uprawa=grassland',
      );
    });

    it('zwykle pole: bez ramki; uzytki slowami w naglowku, kody tylko w szczegolach dla doradcy', () => {
      renderReport(landUse({}));

      expect(screen.queryByTestId('land-use-notice')).not.toBeInTheDocument();
      expect(screen.getByTestId('report-header')).toHaveTextContent(
        'grunty orne klasy IVb–VI, łąka klasy V i rów',
      );
      expect(screen.getByTestId('report-header').textContent).not.toMatch(/RIVb/);
      expect(screen.getByTestId('land-use')).toHaveTextContent(
        'Klasoużytki z ewidencji: RIVb, RV, RVI, ŁV, W/ŁV.',
      );
    });

    it('brak opisu uzytku = nic nie pokazujemy', () => {
      renderReport(realReport);

      expect(screen.queryByTestId('land-use-notice')).not.toBeInTheDocument();
      expect(screen.queryByTestId('land-use')).not.toBeInTheDocument();
    });
  });

  it.each([
    ['pole z rowem (silnik)', FIELD_REPORT],
    ['las (silnik)', FOREST_REPORT],
    ['susza (silnik)', DROUGHT_REPORT],
    ['niska pewnosc', LOW_CONFIDENCE_REPORT],
  ])('%s: zaden surowy identyfikator (snake_case) nie trafia na ekran, takze w szczegolach', (_, report) => {
    renderReport(report);

    // adresy zrodel (na wydruku) maja wlasne identyfikatory - to nie tekst dla rolnika
    const text = (screen.getByTestId('report').textContent ?? '').replaceAll(/https?:\/\/[^\s,)]+/g, '');

    expect(text.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) ?? []).toEqual([]);
    expect(text).not.toContain(t('evidence.unknownMetric'));
  });

  describe('raport z pelnego silnika', () => {
    it('nawadnianie: plan dawek i woda na cale pole zamiast jednej liczby', () => {
      renderReport(FIELD_REPORT);

      const plan = screen.getByTestId('irrigation-plan');

      expect(plan).toHaveTextContent('Plan podlewania: 4 podlania po 30 l/m² co 6 dni.');
      // 30 l/m2 na 19,35 ha = 5804 m3, cztery dawki = 23 215 m3
      expect(plan.textContent?.replaceAll(/\s/g, ' ')).toMatch(/5804 m³.*23 215 m³/);
      expect(screen.queryByText(t('irrigation.deficitNote'))).not.toBeInTheDocument();
    });

    it('historia: sezony z niedoborem wody, susza IUNG i nadmiar wody; kalendarz z biezacym rokiem i nadmiarem', () => {
      renderReport(FIELD_REPORT);

      expect(screen.getByTestId('deficit-seasons')).toHaveTextContent(
        'Uprawie brakowało wody w 9 z 10 poprzednich sezonów.',
      );
      expect(screen.getByTestId('excess-seasons')).toHaveTextContent('Nadmiar wody');

      const calendar = screen.getByTestId('risk-calendar');
      const current = calendar.querySelector('tr[data-current]');

      expect(calendar.querySelectorAll('td[data-status="excess"]').length).toBeGreaterThan(0);
      expect(current?.querySelectorAll('td[data-status="ok"]')).toHaveLength(3);
      expect(within(calendar).getByText('nadmiar wody', { selector: 'li' })).toBeInTheDocument();
    });

    it('gleba z sasiedztwa: zdanie w karcie oceny z odlegloscia', () => {
      renderReport(FOREST_REPORT);

      expect(screen.getByTestId('verdict-basis')).toHaveTextContent('oddalonego o ok. 250 m');
    });

    it('gleba z pola i prog dla jej kategorii: bez dodatkowego zdania w karcie, opis w szczegolach', () => {
      renderReport(FIELD_REPORT);

      expect(screen.queryByTestId('verdict-basis')).not.toBeInTheDocument();
      expect(screen.getByText(t('verdict.verdictBasis.soil_category'))).toBeInTheDocument();
    });
  });

  it('brak zrodla (satelita missing) nie psuje raportu: wszystkie sekcje i nazwany brak', () => {
    renderReport({
      ...FIELD_REPORT,
      assessment: { ...FIELD_REPORT.assessment, vegetation: null },
      sources: FIELD_REPORT.sources.map((source) =>
        source.id === 'vegetation' ? { ...source, status: 'missing' as const } : source,
      ),
      limitations: [...FIELD_REPORT.limitations, 'vegetation_missing'],
    });

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7);
    expect(screen.getByTestId('report').querySelector('[data-source="vegetation"]')).toHaveAttribute(
      'data-status',
      'missing',
    );
    expect(screen.getByText(t('sources.limitationItems.vegetation_missing'))).toBeInTheDocument();
  });
});

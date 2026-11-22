import type { AppHref } from '@/lib/routes';
import type { WaterReport } from '@app/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl, translator } from '@/test/render-intl';

import { DROUGHT_REPORT } from '../../fixtures/drought-report';
import { FIELD_REPORT } from '../../fixtures/field-report';
import { FOREST_REPORT } from '../../fixtures/forest-report';
import { HEAT_REPORT } from '../../fixtures/heat-report';
import { LOW_CONFIDENCE_REPORT } from '../../fixtures/low-confidence-report';
import { MEADOW_REPORT } from '../../fixtures/meadow-report';
import { AUTUMN_REPORT } from '../../fixtures/autumn-report';
import { SAMPLE_REPORT } from '../../fixtures/sample-report';
import { WEATHER_REPORT } from '../../fixtures/weather-report';
import type { DetailsState } from '../full-analysis';
import { ReportView } from './report-view';

const t = translator('report');
const CHANGE = '/analiza' as AppHref;
const MAP = '/' as AppHref;
const OPEN: DetailsState = {
  open: true,
  closedHref: '/raport' as AppHref,
  openHref: '/raport?widok=szczegoly' as AppHref,
};

function renderReport(
  report: WaterReport = SAMPLE_REPORT,
  grasslandHref?: AppHref,
  details: DetailsState = OPEN,
) {
  // mapa pola pobiera kafle hydrografii przez TanStack Query (w jsdom bez sieci - warstwa "niedostepna")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return renderWithIntl(
    <QueryClientProvider client={client}>
      <ReportView
        report={report}
        changeHref={CHANGE}
        mapHref={MAP}
        grasslandHref={grasslandHref}
        details={details}
      />
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

    const headings = [...document.querySelectorAll('[data-report-section] h2')].map(
      (heading) => heading.textContent,
    );

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
    expect(
      within(document.getElementById('nawadnianie') as HTMLElement).getByText(
        t('irrigation.advisablePast.yes'),
      ),
    ).toBeInTheDocument();
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
    ['laka z nadmiarem wody i zaglebieniami (silnik)', MEADOW_REPORT],
    ['susza (silnik)', DROUGHT_REPORT],
    ['niska pewnosc', LOW_CONFIDENCE_REPORT],
    ['pogodynka 0.8.0 (susza)', WEATHER_REPORT],
    ['pogodynka 0.8.0 (poza sezonem, prognoza)', AUTUMN_REPORT],
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
      // silnik 0.5.0: gleba kategorii I (lzejszy koniec zakresu) - w 2018 dwa okresy z susza przed data analizy
      expect(current?.querySelectorAll('td[data-status="ok"]')).toHaveLength(1);
      expect(current?.querySelectorAll('td[data-status="drought"]')).toHaveLength(2);
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

    expect(document.querySelectorAll('[data-report-section] h2')).toHaveLength(7);
    expect(screen.getByTestId('report').querySelector('[data-source="vegetation"]')).toHaveAttribute(
      'data-status',
      'missing',
    );
    expect(
      within(document.getElementById('zrodla') as HTMLElement).getByText(
        t('sources.limitationItems.vegetation_missing'),
      ),
    ).toBeInTheDocument();
    // to samo ograniczenie rolnik widzi w "Czego ta ocena nie wie"
    expect(screen.getByTestId('known-limits')).toHaveTextContent(
      t('sources.limitationItems.vegetation_missing'),
    );
  });

  describe('miejsca na polu', () => {
    it('szkic ma miejsca z numerami, lista obok ma zdania z serwera, co zrobic i skad sa miejsca', () => {
      renderReport(FIELD_REPORT);

      const list = screen.getByTestId('zone-list');
      const items = within(list).getAllByRole('button');

      // 4 miejsca; "pozostala czesc pola" (17,9 ha) to tlo bez numeru
      expect(items).toHaveLength(4);
      expect(items[0]).toHaveTextContent(
        'Miejsce 1: Suchsze miejsce, w zachodniej części pola, przy rowie, ok. 0,5 ha',
      );
      // co z tym zrobic: zalecenia przypiete do miejsca, a bez nich - obejrzec na polu
      expect(within(items[0] as HTMLElement).getByTestId('zone-action')).toHaveTextContent(/^Co zrobić: /);
      expect(within(items[3] as HTMLElement).getByTestId('zone-action')).toHaveTextContent(
        'Osobnego zalecenia',
      );
      expect(within(list).getByTestId('zone-list-basis')).toHaveTextContent(
        'jednego zdjęcia satelitarnego (najmniej zachmurzonego z okresu 17 maja 2018 – 15 czerwca 2018)',
      );
      expect(screen.getAllByTestId('field-sketch-zone-number').map((badge) => badge.textContent)).toEqual([
        '1',
        '2',
        '3',
        '4',
      ]);
      expect(screen.getByTestId('field-sketch-legend')).toHaveTextContent('Kropki – miejsce suchsze');
      expect(screen.getByTestId('field-sketch-legend')).toHaveTextContent('Fale – tu zbiera się woda');
    });

    it('zalecenie dla miejsca ma jego numer; fokus na zaleceniu wyroznia miejsce na szkicu i odwrotnie', () => {
      renderReport(FIELD_REPORT);

      const retention = within(document.getElementById('retencja') as HTMLElement);
      const trees = retention.getByText(t('recommendations.measures.field_margin_trees.name')).closest('li');

      expect(trees).toHaveTextContent(
        'Dotyczy miejsca 1: suchsze miejsce, w zachodniej części pola, przy rowie, ok. 0,5 ha',
      );
      // zastawka na rowie dotyczy reszty pola - bez numeru
      expect(
        retention.getByText(t('recommendations.measures.ditch_weir.name')).closest('li'),
      ).toHaveTextContent(t('recommendations.zoneRest'));
      expect(screen.queryByTestId('field-sketch-zone-active')).not.toBeInTheDocument();

      fireEvent.focus(
        within(trees as HTMLElement).getByRole('button', { name: 'Pokaż miejsce 1 na szkicu' }),
      );

      expect(screen.getByTestId('field-sketch-zone-active')).toBeInTheDocument();

      fireEvent.blur(within(trees as HTMLElement).getByRole('button', { name: 'Pokaż miejsce 1 na szkicu' }));
      fireEvent.click(screen.getAllByTestId('field-sketch-zone-number')[0] as Element);

      expect(trees).toHaveClass('ring-2');
    });

    it('zaglebienie bez odplywu ma wlasny wzor w legendzie', () => {
      renderReport(MEADOW_REPORT);

      expect(within(screen.getByTestId('zone-list')).getAllByRole('button')).toHaveLength(4);
      expect(screen.getByTestId('field-sketch-legend')).toHaveTextContent('Kreski – zagłębienie bez odpływu');
    });

    it.each([
      ['field_too_small', FOREST_REPORT, 'satelita widzi kwadraty 10 × 10 m'],
      [
        'uniform',
        {
          ...FIELD_REPORT,
          zones: {
            layout: 'zones',
            cellSizeM: 10,
            cells: 168,
            reason: 'uniform',
            zones: [{ ...FIELD_REPORT.zones?.zones.at(-1), id: 'zone-1', areaHa: FIELD_REPORT.field.areaHa }],
          },
        } as WaterReport,
        'nie widać miejsc wyraźnie suchszych',
      ],
      ['brak mapy stref', { ...FIELD_REPORT, zones: null }, 'zabrakło zdjęcia satelitarnego'],
    ])('bez miejsc (%s): jedno zdanie z powodem, bez numerow na szkicu', (_, report, text) => {
      renderReport(report);

      expect(screen.getByTestId('zone-list-empty')).toHaveTextContent(text);
      expect(screen.queryByTestId('zone-list')).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('field-sketch-zone-number')).toHaveLength(0);
    });
  });

  describe('nowe pola oceny (silnik 0.5.0)', () => {
    it('niedobor wody w 60 dniach jezykiem rolnika i zakres kategorii gleby w szczegolach', () => {
      renderReport(FIELD_REPORT);

      expect(screen.getByTestId('verdict').parentElement).toHaveTextContent(
        'Rośliny dostały o 32% mniej wody, niż potrzebowały, w ostatnich 60 dniach.',
      );
      expect(screen.getByTestId('soil-range')).toHaveTextContent(
        'Model gleby wskazuje kategorię od I do III; do progu suszy bierzemy lżejszą (I).',
      );
    });

    it('liczby miejsc dla doradcy: NDMI wzgledem pola, wysokosc, row, pojemnosc zaglebienia', () => {
      renderReport(MEADOW_REPORT);

      const measures = screen.getByTestId('zone-measures');

      expect(measures).toHaveTextContent('Siatka 10 m');
      expect(measures).toHaveTextContent('pojemność zagłębienia ok. 5301 m³');
      expect(measures).toHaveTextContent('NDMI');
    });
  });

  describe('upal (miary hot_days_*)', () => {
    const heat: WaterReport = {
      ...FIELD_REPORT,
      causes: FIELD_REPORT.causes.map((cause) =>
        cause.id === 'high_evaporative_demand'
          ? {
              ...cause,
              evidence: [
                ...cause.evidence,
                { metric: 'hot_days_14d', value: 9, unit: 'days', source: 'meteo' },
                { metric: 'hot_days_30d', value: 12, reference: 4, unit: 'days', source: 'meteo' },
                { metric: 'hot_days_30d_normal', value: 4, unit: 'days', source: 'meteo' },
              ],
            }
          : cause,
      ),
    };

    it('zdanie o upale w karcie oceny, poziom bez zmian; miary nazwane slowami', () => {
      const { container } = renderReport(heat);

      expect(screen.getByTestId('verdict-heat')).toHaveTextContent(
        'Od 14 dni było 9 dni upału powyżej 30°C (zwykle ok. 2) – rośliny tracą wodę szybciej niż zwykle.',
      );
      expect(screen.getByTestId('verdict')).toHaveAttribute('data-level', FIELD_REPORT.assessment.level);

      const cause = container.querySelector('[data-cause="high_evaporative_demand"]');

      expect(cause).toHaveTextContent('Dni z upałem powyżej 30°C w ostatnich 14 dniach: 9 dni');
      expect(cause).toHaveTextContent('zwykle o tej porze: 4 dni');
      expect(cause).not.toHaveTextContent(t('evidence.unknownMetric'));
    });

    it('prawdziwy silnik: upal w 30 dniach, uwaga o siatce pogody w szczegolach przyczyny raz', () => {
      const { container } = renderReport(HEAT_REPORT);
      const cause = container.querySelector('[data-cause="high_evaporative_demand"]');

      expect(screen.getByTestId('verdict-heat')).toHaveTextContent(
        'W ostatnich 30 dniach było 6 dni upału powyżej 30°C (zwykle ok. 1)',
      );
      expect(cause).toHaveTextContent('Dni z upałem powyżej 30°C w ostatnich 30 dniach: 6 dni');
      expect(cause).toHaveTextContent('zwykle o tej porze: 1,1 dni');
      // ta sama uwaga przy 14 i 30 dniach - raz; inna przy normie
      expect(within(cause as HTMLElement).getAllByText(/komórka ok\. 50 km/)).toHaveLength(1);
      expect(cause).toHaveTextContent('Średnio w tych samych 30 dniach w latach 2009–2018');
    });

    it('miary upalu przy samej ocenie: w szczegolach oceny', () => {
      renderReport({
        ...HEAT_REPORT,
        assessment: {
          ...HEAT_REPORT.assessment,
          evidence: [
            { metric: 'hot_days_14d', value: 7, unit: 'days', source: 'meteo', note: 'Siatka ok. 50 km.' },
          ],
        },
      });

      expect(screen.getByTestId('verdict-evidence')).toHaveTextContent(
        'Dni z upałem powyżej 30°C w ostatnich 14 dniach: 7 dni',
      );
      expect(screen.getByTestId('verdict-evidence')).toHaveTextContent('Siatka ok. 50 km.');
    });

    it('bez miar upalu nie ma zdania', () => {
      renderReport(FIELD_REPORT);

      expect(screen.queryByTestId('verdict-heat')).not.toBeInTheDocument();
    });
  });

  describe('otoczenie pola', () => {
    const protectedReport: WaterReport = {
      ...HEAT_REPORT,
      surroundings: HEAT_REPORT.surroundings && {
        ...HEAT_REPORT.surroundings,
        protectedAreas: [
          { kind: 'national_park', name: 'Biebrzański Park Narodowy' },
          { kind: 'natura2000', name: 'Dolina Biebrzy' },
          { kind: 'natura2000', name: 'Ostoja Biebrzańska' },
          { kind: 'nature_reserve', name: 'Stawy Milickie' },
        ],
      },
    };

    it('obszar chroniony: ramka u gory z nazwami obszarow i zdaniem o uzgodnieniach', () => {
      renderReport(protectedReport);

      expect(screen.getByTestId('protected-area-notice')).toHaveTextContent(
        'Pole leży w obszarze chronionym: Biebrzański Park Narodowy; rezerwat przyrody Stawy Milickie; ' +
          'Natura 2000: Dolina Biebrzy i Ostoja Biebrzańska.',
      );
      expect(screen.getByTestId('protected-area-notice')).toHaveTextContent(
        'Oczko wodne, zastawka i zmiana stosunków wodnych wymagają tu uzgodnień.',
      );
    });

    it('poza obszarami chronionymi i bez otoczenia: bez ramki i bez karty', () => {
      const { unmount } = renderReport(HEAT_REPORT);

      expect(screen.queryByTestId('protected-area-notice')).not.toBeInTheDocument();
      unmount();
      renderReport(FIELD_REPORT);
      expect(screen.queryByTestId('surroundings-card')).not.toBeInTheDocument();
    });

    it('karta otoczenia: drzewa przy granicy, las, jaz; wiersze bez obiektu znikaja', () => {
      renderReport(HEAT_REPORT);
      const card = screen.getByTestId('surroundings-card');

      expect(card).toHaveTextContent('Drzewa przy granicy');
      expect(card).toHaveTextContent('rosną przy 0 m z 1900 m granicy pola – pole otwarte na wiatr');
      expect(card).toHaveTextContent('jaz, 347 m od pola');
      expect(card.querySelector('[data-row="spring"]')).toBeNull();
      expect(card.querySelector('[data-row="lowland"]')).toBeNull();
    });

    it('dopiski serwera pod zaleceniem jako lista "Zanim zaczniesz"', () => {
      const { container } = renderReport(HEAT_REPORT);
      const weir = container.querySelector('[data-measure="ditch_weir"]');
      const notes = weir?.querySelector('[data-testid="recommendation-notes"]');

      expect(notes).toHaveTextContent('Zanim zaczniesz');
      expect(notes?.querySelectorAll('li')).toHaveLength(2);
      expect(notes).toHaveTextContent('347 m od pola jest jaz');
    });

    it('nowe miary otoczenia nazwane slowami; granica z drzewami jako "0 m z 1900 m"', () => {
      const { container } = renderReport(HEAT_REPORT);
      const weir = container.querySelector('[data-measure="ditch_weir"]');

      expect(weir).toHaveTextContent('Odległość do najbliższego jazu, zapory albo śluzy: 347 m');
      expect(container.querySelector('[data-cause="high_evaporative_demand"]')).toHaveTextContent(
        'Granica pola, przy której rosną drzewa: 0 m z 1900 m',
      );
      expect(container).not.toHaveTextContent(t('evidence.unknownMetric'));
    });
  });

  describe('nadmiar wody', () => {
    it('sekcja 3 "Skad nadmiar wody" z deszczem na tle lat, zaglebieniami i rowami; bez zdania o niedoborze', () => {
      const { container } = renderReport(MEADOW_REPORT);
      const causes = container.querySelector('#przyczyny');

      expect(causes).toHaveTextContent('Skąd nadmiar wody');
      expect(causes).not.toHaveTextContent('Dlaczego brakuje wody');
      expect(causes).not.toHaveTextContent(t('causes.none'));
      expect(screen.getByTestId('excess-causes')).toHaveTextContent(
        'W ostatnich 30 dniach spadło 167 l/m² deszczu – zwykle o tej porze ok. 42 l/m², czyli ok. 4 razy więcej. ' +
          'To najbardziej mokry taki okres z 11 lat (bieżący i 10 poprzednich).',
      );
      expect(container.querySelector('[data-fact="balance"]')).toHaveTextContent(
        'zostało ok. 97 l/m² wody więcej',
      );
      expect(container.querySelector('[data-fact="zones"]')).toHaveTextContent(
        'Na polu są 2 zagłębienia bez odpływu, razem na ok. 8200 m³ wody.',
      );
      expect(container.querySelector('[data-fact="ditches"]')).toHaveTextContent('sprawdź, czy są drożne');
    });

    it('historia: rok analizy podpisany jako biezacy, miejsce okresu "z 11 lat (biezacy i 10 poprzednich)"', () => {
      const { container } = renderReport(MEADOW_REPORT);
      const history = container.querySelector('#historia');

      expect(history).toHaveTextContent(
        'to najbardziej mokry taki okres z 11 lat (bieżący i 10 poprzednich).',
      );
      expect(history).toHaveTextContent('Kalendarz suszy: bieżący rok na tle 10 poprzednich');
      expect(history?.querySelector('tr[data-current] th')).toHaveTextContent('2017bieżący');
      expect(history?.querySelector('[data-season="2017"]')).toHaveTextContent('bieżący20 wrz');
    });

    it('nawadnianie: jedno zdanie "nie nawadniaj"; retencja nie obiecuje zatrzymywania; bez dni niedoboru w ocenie', () => {
      const { container } = renderReport(MEADOW_REPORT);

      expect(screen.getByTestId('irrigation-excess')).toHaveTextContent(
        'Wtedy nie było potrzeby nawadniać – w glebie było za dużo wody.',
      );
      expect(container.querySelector('#nawadnianie')).not.toHaveTextContent(t('irrigation.first'));
      expect(container.querySelector('#retencja')).toHaveTextContent('Woda na polu i wokół niego');
      expect(container.querySelector('#retencja')).toHaveTextContent('Teraz wody jest za dużo');
      expect(screen.getByTestId('verdict-section-facts')).not.toHaveTextContent(t('verdict.stress'));
    });
  });

  describe('pogodynka wody (silnik 0.8.0)', () => {
    const CLOSED: DetailsState = { ...OPEN, open: false };

    it('jedna strona: werdykt ze skala, zbiornik, odliczanie, rachunek wody, 10 lat, pierwszy krok; szczegoly zwiniete', () => {
      renderReport(WEATHER_REPORT, undefined, CLOSED);

      expect(screen.getByTestId('report-details')).toHaveClass('hidden');
      expect(screen.getByTestId('show-details')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('show-details')).toHaveTextContent('Pokaż szczegóły');
      expect(screen.getByTestId('verdict-word')).toHaveTextContent('Sucho');
      expect(screen.getByTestId('verdict-scale')).toHaveAttribute('data-step', 'dry');
      expect(screen.getByTestId('verdict-number')).toHaveTextContent('Brakuje ok. 114 l/m² wody');
      expect(screen.getByTestId('tank-percent')).toHaveTextContent('4%');
      expect(screen.getByTestId('chart-tank')).toHaveTextContent('Zwykle tego dnia: 24%.');
      expect(screen.getByTestId('chart-countdown')).toHaveTextContent('od 39 dni');
      expect(screen.getByTestId('chart-ledger')).toHaveTextContent('1,8 razy więcej wody');
      expect(screen.getByTestId('chart-ledger')).toHaveTextContent('126');
      expect(screen.getByTestId('chart-seasons')).toHaveTextContent('9 z 10');
      // data historyczna: bez prognozy
      expect(screen.queryByTestId('chart-forecast')).toBeNull();
      expect(screen.getByTestId('first-step')).toHaveTextContent('Zastawka na rowie');
      expect(screen.getByTestId('first-step-badge')).toHaveTextContent('Najpierw zgłoś do Wód Polskich');
      expect(screen.getByTestId('simple-causes')).toHaveTextContent('ok. 31%');
    });

    it('szczegoly: deszcz dzien po dniu, satelita z pominietymi zdjeciami, udzial przyczyn', () => {
      renderReport(WEATHER_REPORT);

      expect(screen.getByTestId('report-details')).not.toHaveClass('hidden');
      expect(screen.getByTestId('show-details')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('show-details')).toHaveTextContent('Zwiń szczegóły');
      expect(screen.getByTestId('chart-rain-use')).toHaveTextContent('W ostatnich 60 dniach spadło');
      expect(screen.getByTestId('chart-vegetation')).toHaveTextContent('pominięte przez chmury: 4');
      expect(screen.getByTestId('cause-shares')).toHaveTextContent('31%');

      const numbers = screen.getByTestId('key-numbers');

      expect(numbers.querySelector('[data-number="balance"]')).toHaveTextContent(
        'próg suszy dla gleby kat. I',
      );
      expect(numbers.querySelector('[data-number="rain"]')).toHaveTextContent('53% normy');
      expect(numbers.querySelector('[data-number="dry"]')).toHaveTextContent('9 dni');
      expect(numbers.querySelector('[data-number="heat"]')).toHaveTextContent('zwykle ok. 1,1');
    });

    it('poza sezonem: prognoza 7 dni, zbiornik bez progu, bez odliczania', () => {
      renderReport(AUTUMN_REPORT, undefined, CLOSED);

      expect(screen.getByTestId('verdict-word')).toHaveTextContent(t('verdict.levels.out_of_season'));
      expect(screen.queryByTestId('verdict-scale')).toBeNull();
      expect(screen.getByTestId('chart-tank')).toHaveTextContent('Uprawa teraz nie rośnie');
      expect(screen.queryByTestId('chart-countdown')).toBeNull();
      expect(screen.getByTestId('chart-forecast').querySelectorAll('li')).toHaveLength(7);
      expect(screen.getByTestId('chart-forecast')).toHaveTextContent('MET Norway');
    });

    it('stary raport (0.7.0): zbiornik z bilansu strefy korzeni, bez kart nowych pol', () => {
      renderReport(HEAT_REPORT, undefined, CLOSED);

      expect(screen.getByTestId('tank-percent')).toHaveTextContent('4%');
      expect(screen.queryByTestId('chart-countdown')).toBeNull();
      expect(screen.queryByTestId('chart-ledger')).toBeNull();
      expect(screen.queryByTestId('chart-forecast')).toBeNull();
    });
  });
});

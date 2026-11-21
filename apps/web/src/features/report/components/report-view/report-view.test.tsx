import type { AppHref } from '@/lib/routes';
import type { WaterReport } from '@app/contracts';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl, translator } from '@/test/render-intl';

import { DROUGHT_REPORT } from '../../fixtures/drought-report';
import { SAMPLE_REPORT } from '../../fixtures/sample-report';
import { ReportView } from './report-view';

const t = translator('report');
const CHANGE = '/analiza' as AppHref;
const MAP = '/' as AppHref;

function renderReport(report: WaterReport = SAMPLE_REPORT) {
  return renderWithIntl(<ReportView report={report} changeHref={CHANGE} mapHref={MAP} />);
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
});

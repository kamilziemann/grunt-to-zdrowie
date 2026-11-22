import type { ReportPart, WaterReport } from '@app/contracts';
import { CircleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useTranslations } from 'use-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import type { AppHref } from '@/lib/routes';

import { AdvisorNotes } from '../advisor-notes';
import { AnalysisNav } from '../analysis-nav';
import { CauseShares } from '../cause-shares';
import { CausesSection } from '../causes-section';
import { ExcessCauses } from '../excess-causes';
import { FullAnalysis, type DetailsState } from '../full-analysis';
import { HistorySection } from '../history-section';
import { IrrigationSection } from '../irrigation-section';
import { KeyNumbers } from '../key-numbers';
import { LandUseNotice } from '../land-use-notice';
import { PrintFooter, PrintHeader, PrintPageMargins } from '../print-frame';
import { ProtectedAreaNotice } from '../protected-area-notice';
import { RecommendationList } from '../recommendation-list';
import { RainUseChart } from '../rain-use-chart';
import { ReportHeader } from '../report-header';
import { ReportOverview } from '../report-overview';
import { sampleParts } from '../../utils/report-data';
import { reportExtras } from '../../utils/report-extras';
import { ReportSection } from '../report-section';
import { SatellitePrintProvider, SatelliteSection } from '../satellite-section';
import { ShareBar } from '../share-bar';
import { SampleBanner } from '../sample-banner';
import { SourcesSection } from '../sources-section';
import { SurroundingsCard } from '../surroundings-card';
import { VegetationChart } from '../vegetation-chart';
import { VerdictSection } from '../verdict-section';
import { ZoneFocusProvider } from '../zone-focus';
import { ZoneMeasuresDetails } from '../zone-list';

export interface ReportViewProps {
  report: WaterReport;
  changeHref: AppHref;
  mapHref: AppHref;
  /** ten sam raport z uprawa "laka lub pastwisko" - podpowiedz, gdy ewidencja mowi o samych lakach */
  grasslandHref?: AppHref;
  /** raport otwarty z zapisu (krotki link): adres z parametrami, pod ktorym policzy sie od nowa */
  recomputeHref?: AppHref;
  /** szczegoly rozwiniete albo zwiniete - z adresu (`widok=szczegoly`) */
  details: DetailsState;
}

/** Na czas wydruku otwiera wszystkie szczegoly (PDF dla doradcy ma komplet liczb), potem przywraca stan. */
function useOpenDetailsForPrint(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = [...(root.current?.querySelectorAll('details:not([open])') ?? [])].filter(
        (element): element is HTMLDetailsElement => element instanceof HTMLDetailsElement,
      );

      for (const details of opened) details.open = true;
    };
    const after = () => {
      for (const details of opened) details.open = false;
      opened = [];
    };

    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);

    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [root]);
}

/**
 * Raport wodny "Pogodynka wody" jako jedna strona: najpierw werdykt ze skala, karta "Twoje pole", woda teraz
 * i w tym tygodniu, 10 lat i dlaczego, co zrobic najpierw, czego ocena nie wie; na koncu zwiniete szczegoly - pelna
 * analiza w kolejnosci z zadania (ocena -> historia -> przyczyny -> retencja -> agrotechnika -> nawadnianie ->
 * zrodla). Wydruk A4 ma zawsze calosc: strona 1 = infografika, dalej pelna analiza i miejsce na notatki doradcy.
 * Ramki ostrzegawcze (grunt nierolny, obszar chroniony, dane przykladowe, braki) stoja na gorze.
 */
export function ReportView({
  report,
  changeHref,
  mapHref,
  grasslandHref,
  recomputeHref,
  details,
}: ReportViewProps) {
  const t = useTranslations('report');
  const root = useRef<HTMLElement>(null);
  // bez `sampleParts` caly raport jest przykladowy - mowi o tym baner, znaczniki przy kazdej sekcji bylyby szumem
  const samples = report.meta.sampleParts ? sampleParts(report) : new Set<ReportPart>();
  // zalecenia liczy juz silnik z danych; przykladowe strefy (meta.sampleParts: zones) nie czynia ich przykladowymi -
  // inaczej raport podwazalby wlasne zalecenia. O przykladowych strefach mowi baner na gorze.
  const sampleRecommendations = samples.has('recommendations');
  // nadmiar wody: sekcja 3 mowi, skad woda, a sekcja 4 nie obiecuje jej zatrzymywania
  const excess = report.assessment.level === 'excess';
  const extras = reportExtras(report);
  const tSources = useTranslations('report.sources.categories');
  // brakujace zrodla slowami ("Prognoza pogody, Zdjecia satelitarne"), bez powtorzen (dwa wpisy rowow)
  const missingSources = [
    ...new Set(
      report.sources.filter((source) => source.status === 'missing').map((source) => tSources(source.id)),
    ),
  ];
  const sections = useMemo(
    () => [
      { id: 'ocena', title: t('sections.verdict') },
      { id: 'historia', title: t('sections.history') },
      { id: 'przyczyny', title: t(excess ? 'sections.causesExcess' : 'sections.causes') },
      { id: 'retencja', title: t(excess ? 'sections.retentionExcess' : 'sections.retention') },
      { id: 'agrotechnika', title: t('sections.agrotech') },
      { id: 'nawadnianie', title: t('sections.irrigation') },
      { id: 'zrodla', title: t('sections.sources') },
    ],
    [t, excess],
  );
  const title = (index: number) => sections[index]?.title ?? '';

  useOpenDetailsForPrint(root);

  return (
    <ZoneFocusProvider>
      <SatellitePrintProvider report={report}>
        <article
          ref={root}
          className="report flex flex-col gap-section pb-24 sm:pb-0 print:block print:space-y-6 print:pb-0"
          data-testid="report"
        >
          <PrintPageMargins report={report} />
          <PrintHeader report={report} />
          <ReportHeader
            report={report}
            changeHref={changeHref}
            mapHref={mapHref}
            recomputeHref={recomputeHref}
          />
          <LandUseNotice
            landUse={report.landUse}
            grasslandHref={grasslandHref}
            mapHref={mapHref}
            unknown={report.limitations.includes('land_use_unknown')}
          />
          <ProtectedAreaNotice areas={report.surroundings?.protectedAreas} />
          <SampleBanner report={report} />
          {report.meta.status !== 'complete' && (
            <Alert variant="warning" className="text-base" data-testid="report-status">
              <CircleAlert aria-hidden="true" />
              <AlertDescription className="flex flex-col gap-1 text-base text-foreground">
                <span>{t(`status.${report.meta.status}`)}</span>
                {missingSources.length > 0 && (
                  <span data-testid="report-status-missing">
                    {t('status.missing', { sources: missingSources.join(', ') })}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          <ReportOverview report={report} detailsHref={details.openHref} />
          <FullAnalysis state={details}>
            <h2 className="text-3xl leading-tight font-bold print:text-2xl">{t('view.fullTitle')}</h2>
            <KeyNumbers report={report} />
            <AnalysisNav items={sections} />
            <ReportSection id="ocena" number={1} title={title(0)} sample={samples.has('assessment')}>
              <VerdictSection report={report} />
              {(extras.dailySeries || extras.vegetationSeries) && (
                <div className="grid gap-4 xl:grid-cols-2 print:grid-cols-1">
                  <RainUseChart report={report} />
                  <VegetationChart report={report} />
                </div>
              )}
              <SatelliteSection report={report} />
            </ReportSection>
            <ReportSection id="historia" number={2} title={title(1)} sample={samples.has('history')}>
              <HistorySection report={report} />
            </ReportSection>
            <ReportSection id="przyczyny" number={3} title={title(2)} sample={samples.has('causes')}>
              {excess ? <ExcessCauses report={report} /> : null}
              {excess && report.causes.length === 0 ? null : <CauseShares report={report} />}
              {excess && report.causes.length === 0 ? null : <CausesSection causes={report.causes} />}
            </ReportSection>
            <ReportSection id="retencja" number={4} title={title(3)} sample={sampleRecommendations}>
              <p className="text-base text-muted-foreground print:hidden">{t('fieldMap.above')}</p>
              <SurroundingsCard surroundings={report.surroundings} />
              <ZoneMeasuresDetails report={report} />
              <RecommendationList
                category="retention"
                recommendations={report.recommendations.retention}
                report={report}
              />
            </ReportSection>
            <ReportSection id="agrotechnika" number={5} title={title(4)} sample={sampleRecommendations}>
              <RecommendationList
                category="agrotech"
                recommendations={report.recommendations.agrotech}
                report={report}
              />
            </ReportSection>
            <ReportSection id="nawadnianie" number={6} title={title(5)} sample={sampleRecommendations}>
              <IrrigationSection report={report} />
            </ReportSection>
            <ReportSection id="zrodla" number={7} title={title(6)}>
              <SourcesSection report={report} />
            </ReportSection>
          </FullAnalysis>
          <AdvisorNotes />
          <PrintFooter report={report} />
          <ShareBar report={report} />
        </article>
      </SatellitePrintProvider>
    </ZoneFocusProvider>
  );
}

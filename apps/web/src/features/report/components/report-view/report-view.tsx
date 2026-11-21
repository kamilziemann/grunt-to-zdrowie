import type { ReportPart, WaterReport } from '@app/contracts';
import { CircleAlert } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { useTranslations } from 'use-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import type { AppHref } from '@/lib/routes';

import { CausesSection } from '../causes-section';
import { FieldMap } from '../field-map';
import { HistorySection } from '../history-section';
import { IrrigationSection } from '../irrigation-section';
import { LandUseNotice } from '../land-use-notice';
import { PrintFooter, PrintHeader } from '../print-frame';
import { RecommendationList } from '../recommendation-list';
import { ReportHeader } from '../report-header';
import { ditchInFieldM, sampleParts } from '../../utils/report-data';
import { ReportSection } from '../report-section';
import { SampleBanner } from '../sample-banner';
import { SourcesSection } from '../sources-section';
import { VerdictSection } from '../verdict-section';

export interface ReportViewProps {
  report: WaterReport;
  changeHref: AppHref;
  mapHref: AppHref;
  /** ten sam raport z uprawa "laka lub pastwisko" - podpowiedz, gdy ewidencja mowi o samych lakach */
  grasslandHref?: AppHref;
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
 * Raport wodny w kolejnosci wymaganej w zadaniu: ocena -> historia 10 sezonow -> przyczyny -> retencja ->
 * agrotechnika -> nawadnianie (ostatnie z zalecen) -> zrodla, daty, ograniczenia i pewnosc. Ekran i wydruk A4
 * maja te sama kolejnosc; grunt nierolny wg ewidencji, dane przykladowe i braki danych sa oznaczone na gorze.
 */
export function ReportView({ report, changeHref, mapHref, grasslandHref }: ReportViewProps) {
  const t = useTranslations('report');
  const root = useRef<HTMLElement>(null);
  // bez `sampleParts` caly raport jest przykladowy - mowi o tym baner, znaczniki przy kazdej sekcji bylyby szumem
  const samples = report.meta.sampleParts ? sampleParts(report) : new Set<ReportPart>();
  // zalecenia liczy juz silnik z danych; przykladowe strefy (meta.sampleParts: zones) nie czynia ich przykladowymi -
  // inaczej raport podwazalby wlasne zalecenia. O przykladowych strefach mowi baner na gorze.
  const sampleRecommendations = samples.has('recommendations');

  useOpenDetailsForPrint(root);

  return (
    <article ref={root} className="report flex flex-col gap-section print:gap-6" data-testid="report">
      <PrintHeader report={report} />
      <ReportHeader report={report} changeHref={changeHref} mapHref={mapHref} />
      <LandUseNotice landUse={report.landUse} grasslandHref={grasslandHref} mapHref={mapHref} />
      <SampleBanner report={report} />
      {report.meta.status !== 'complete' && (
        <Alert variant="warning" className="text-base" data-testid="report-status">
          <CircleAlert aria-hidden="true" />
          <AlertDescription className="text-sm text-foreground">
            {t(`status.${report.meta.status}`)}
          </AlertDescription>
        </Alert>
      )}
      <ReportSection id="ocena" number={1} title={t('sections.verdict')} sample={samples.has('assessment')}>
        <VerdictSection report={report} />
      </ReportSection>
      <ReportSection id="historia" number={2} title={t('sections.history')} sample={samples.has('history')}>
        <HistorySection report={report} />
      </ReportSection>
      <ReportSection id="przyczyny" number={3} title={t('sections.causes')} sample={samples.has('causes')}>
        <CausesSection causes={report.causes} />
      </ReportSection>
      <ReportSection id="retencja" number={4} title={t('sections.retention')} sample={sampleRecommendations}>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">{t('fieldMap.title')}</h3>
          <FieldMap field={report.field} ditchInFieldM={ditchInFieldM(report)} />
        </div>
        <RecommendationList
          category="retention"
          recommendations={report.recommendations.retention}
          report={report}
        />
      </ReportSection>
      <ReportSection
        id="agrotechnika"
        number={5}
        title={t('sections.agrotech')}
        sample={sampleRecommendations}
      >
        <RecommendationList
          category="agrotech"
          recommendations={report.recommendations.agrotech}
          report={report}
        />
      </ReportSection>
      <ReportSection
        id="nawadnianie"
        number={6}
        title={t('sections.irrigation')}
        sample={sampleRecommendations}
      >
        <IrrigationSection report={report} />
      </ReportSection>
      <ReportSection id="zrodla" number={7} title={t('sections.sources')}>
        <SourcesSection report={report} />
      </ReportSection>
      <PrintFooter report={report} />
    </article>
  );
}

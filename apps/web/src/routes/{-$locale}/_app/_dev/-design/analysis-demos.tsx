// Komponenty analizy i raportu w katalogu designu: wybor uprawy (na zywo), postep, blad analizy oraz czesci raportu
// na przykladowym raporcie (te same dane co testy i e2e).
import {
  HTTP_STATUS_BY_CODE,
  PROBLEM_CODES,
  problemType,
  type CropId,
  type ProblemDetails,
} from '@app/contracts';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { useTranslations } from 'use-intl';

import { AnalysisFailure, AnalysisProgress, CropPicker } from '@/features/analysis';
import { RiskCalendar, SAMPLE_REPORT, SampleBanner, VerdictSection } from '@/features/report';
import { routes } from '@/lib/routes';

const UPSTREAM_PROBLEM: ProblemDetails = {
  type: problemType(PROBLEM_CODES.UPSTREAM_FAILED),
  title: PROBLEM_CODES.UPSTREAM_FAILED,
  status: HTTP_STATUS_BY_CODE[PROBLEM_CODES.UPSTREAM_FAILED],
  code: PROBLEM_CODES.UPSTREAM_FAILED,
};

function Demo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h3>
      {children}
    </div>
  );
}

const noop = () => undefined;

export function AnalysisDemos() {
  const t = useTranslations('design.analysis');
  const [cropId, setCropId] = useState<CropId | null>('winter_wheat');
  const chooseCrop = useCallback((next: CropId) => setCropId(next), []);

  return (
    <div className="flex flex-col gap-8">
      <Demo label={t('cropPicker')}>
        <CropPicker name="design-crop" value={cropId} onChange={chooseCrop} />
      </Demo>
      <Demo label={t('progress')}>
        <AnalysisProgress />
      </Demo>
      <Demo label={t('failure')}>
        <AnalysisFailure problem={UPSTREAM_PROBLEM} onRetry={noop} changeHref={routes.analysis()} />
      </Demo>
      <Demo label={t('sampleBanner')}>
        <SampleBanner report={SAMPLE_REPORT} />
      </Demo>
      <Demo label={t('verdict')}>
        <VerdictSection report={SAMPLE_REPORT} />
      </Demo>
      <Demo label={t('calendar')}>
        <RiskCalendar calendar={SAMPLE_REPORT.history.calendar} />
      </Demo>
    </div>
  );
}

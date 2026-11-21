import type { WaterReport } from '@app/contracts';
import { FlaskConical } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { isSampleReport, sampleSources } from '../../utils/report-data';

/**
 * Ostrzezenie o danych przykladowych: raport z atrap (albo z atrapami czesci zrodel) nie moze wygladac jak wynik
 * dla dzialki. Nazywa zrodla-atrapy; na wydruku zostaje (PDF trafia do doradcy).
 */
export function SampleBanner({ report }: { report: WaterReport }) {
  const t = useTranslations('report.sample');
  const tSources = useTranslations('report.sources.categories');
  const format = useFormatter();

  if (!isSampleReport(report)) return null;
  const samples = sampleSources(report);
  const sources =
    samples.length === 0 || samples.length === report.sources.length
      ? t('allSources')
      : format.list(
          samples.map((source) => tSources(source.id).toLowerCase()),
          { type: 'conjunction' },
        );

  return (
    <Alert
      variant="warning"
      className="border-2 border-warning text-base print:break-inside-avoid"
      data-testid="sample-banner"
    >
      <FlaskConical aria-hidden="true" />
      <AlertTitle className="line-clamp-none text-base font-semibold">{t('title')}</AlertTitle>
      <AlertDescription className="text-sm text-foreground">{t('description', { sources })}</AlertDescription>
    </Alert>
  );
}

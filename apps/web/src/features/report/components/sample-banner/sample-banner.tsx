import type { WaterReport } from '@app/contracts';
import { FlaskConical } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { needsSampleBanner, sampleParts, sampleSources } from '../../utils/report-data';

/**
 * Ostrzezenie o danych przykladowych: raport z atrap (albo z atrapami czesci zrodel) nie moze wygladac jak wynik
 * dla dzialki. Nazywa zrodla-atrapy i czesci liczone regulami przykladowymi; na wydruku zostaje (PDF trafia do
 * doradcy). Gdy zrodla sa prawdziwe, a przykladowe sa tylko reguly, wystarcza znacznik przy tych czesciach.
 */
export function SampleBanner({ report }: { report: WaterReport }) {
  const t = useTranslations('report.sample');
  const tSources = useTranslations('report.sources.categories');
  const format = useFormatter();

  if (!needsSampleBanner(report)) return null;
  const samples = sampleSources(report);
  const parts = [...sampleParts(report)];
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
      <AlertDescription className="flex flex-col gap-1 text-sm text-foreground">
        <span>{t('description', { sources })}</span>
        {report.meta.sampleParts && parts.length > 0 && (
          <span>
            {t('parts', {
              parts: format.list(
                parts.map((part) => t(`partNames.${part}`)),
                { type: 'conjunction' },
              ),
            })}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}

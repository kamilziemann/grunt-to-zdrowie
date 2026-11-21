import type { WaterReport } from '@app/contracts';
import { FlaskConical } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils/cn';

import { sampleParts, sampleScope, sampleSources } from '../../utils/report-data';

/**
 * Ostrzezenie o danych przykladowych. Raport w calosci z atrap (albo z atrapa pogody, na ktorej stoi ocena) dostaje
 * mocny baner "nie podejmuj decyzji"; jedno czy dwa przykladowe zrodla - spokojniejszy, ktory mowi, ze reszta jest
 * prawdziwa i na co wplywa atrapa. Na wydruku zostaje (PDF trafia do doradcy). Gdy zrodla sa prawdziwe, a
 * przykladowe sa tylko reguly, wystarcza znacznik przy tych czesciach.
 */
export function SampleBanner({ report }: { report: WaterReport }) {
  const t = useTranslations('report.sample');
  const tSources = useTranslations('report.sources.categories');
  const format = useFormatter();
  const scope = sampleScope(report);

  if (!scope) return null;
  const samples = sampleSources(report);
  const parts = [...sampleParts(report)];
  const list = (items: string[]) => format.list(items, { type: 'conjunction' });
  const sources =
    samples.length === 0 || samples.length === report.sources.length
      ? t('allSources')
      : list(samples.map((source) => tSources(source.id).toLowerCase()));
  const partsNote = report.meta.sampleParts && parts.length > 0 && (
    <span>{t('parts', { parts: list(parts.map((part) => t(`partNames.${part}`))) })}</span>
  );

  return (
    <Alert
      variant="warning"
      className={cn('text-base print:break-inside-avoid', scope === 'all' ? 'border-2 border-warning' : '')}
      data-scope={scope}
      data-testid="sample-banner"
    >
      <FlaskConical aria-hidden="true" />
      <AlertTitle className="line-clamp-none text-base font-semibold">
        {scope === 'all' ? t('title') : t('someTitle', { count: samples.length, sources })}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-1 text-sm text-foreground">
        <span>
          {scope === 'all'
            ? t('description', { sources })
            : t('someDescription', { impacts: list(samples.map((source) => t(`impacts.${source.id}`))) })}
        </span>
        {partsNote}
      </AlertDescription>
    </Alert>
  );
}

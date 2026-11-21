import type { Evidence } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { REPORT_METRICS, type ReportMetric } from '../../utils/report-labels';

/** Liczby, na ktorych opiera sie wniosek: miara, wartosc, odniesienie i zrodlo. Nieznana miara = jej identyfikator. */
export function EvidenceList({ evidence }: { evidence: readonly Evidence[] }) {
  const t = useTranslations('report');
  const format = useFormatter();
  const number = (value: number) => format.number(value, { maximumFractionDigits: 2 });

  return (
    <ul className="flex flex-col gap-1.5">
      {evidence.map((item) => (
        <li key={`${item.metric}:${item.source}:${item.value}`} className="flex flex-col">
          <span>
            {t('evidence.value', {
              metric: isKnownMetric(item.metric) ? t(`evidence.metrics.${item.metric}`) : item.metric,
              value: number(item.value),
              unit: item.unit,
            })}
          </span>
          <span className="text-muted-foreground">
            {item.reference === undefined
              ? null
              : `${t('evidence.reference', { reference: number(item.reference), unit: item.unit })}; `}
            {t('evidence.source', { source: t(`sources.categories.${item.source}`) })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function isKnownMetric(metric: string): metric is ReportMetric {
  return (REPORT_METRICS as readonly string[]).includes(metric);
}

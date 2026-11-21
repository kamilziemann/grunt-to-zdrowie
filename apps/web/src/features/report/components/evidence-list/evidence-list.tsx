import type { Evidence } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { evidenceDisplay, isKnownMetric } from '../../utils/report-labels';

/**
 * Liczby, na ktorych opiera sie wniosek: miara, wartosc, odniesienie i zrodlo. Nieznana miara albo jednostka nie
 * trafia na ekran jako identyfikator - zostaje ogolna nazwa i sama liczba.
 */
export function EvidenceList({ evidence }: { evidence: readonly Evidence[] }) {
  const t = useTranslations('report');
  const format = useFormatter();
  const withUnit = (value: number, unit: string) => {
    const shown = evidenceDisplay(value, unit);

    return t(`evidence.units.${shown.unit}`, {
      value: format.number(shown.value, { maximumFractionDigits: shown.unit === 'percent' ? 0 : 1 }),
    });
  };

  return (
    <ul className="flex flex-col gap-1.5">
      {evidence.map((item) => (
        <li key={`${item.metric}:${item.source}:${item.value}`} className="flex flex-col">
          <span>
            {t('evidence.value', {
              metric: isKnownMetric(item.metric)
                ? t(`evidence.metrics.${item.metric}`)
                : t('evidence.unknownMetric'),
              value: withUnit(item.value, item.unit),
            })}
          </span>
          <span className="text-muted-foreground">
            {item.reference === undefined
              ? null
              : `${t('evidence.reference', { reference: withUnit(item.reference, item.unit) })}; `}
            {t('evidence.source', { source: t(`sources.categories.${item.source}`) })}
          </span>
        </li>
      ))}
    </ul>
  );
}

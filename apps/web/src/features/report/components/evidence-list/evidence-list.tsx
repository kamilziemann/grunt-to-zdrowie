import type { Evidence } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { romanCategory } from '../../utils/report-data';
import {
  evidenceDisplay,
  HEAT_METRICS,
  isKnownMetric,
  referenceRole,
  romanSoilClass,
} from '../../utils/report-labels';

/** Promien szukania obiektow wokol pola, gdy dowod go nie podaje (tak liczy silnik). */
const DEFAULT_RADIUS_M = 500;

/**
 * Liczby, na ktorych opiera sie wniosek: miara, wartosc, odniesienie, zrodlo i uwaga silnika (np. o siatce pogody;
 * ta sama uwaga przy kolejnych miarach raz). Nieznana miara albo jednostka nie
 * trafia na ekran jako identyfikator - zostaje ogolna nazwa i sama liczba. Liczba obiektow niesie promien w nazwie
 * ("Mokradla w promieniu 500 m: 2"), sezony - z ilu sezonow ("3 z 10 sezonow").
 */
export function EvidenceList({ evidence }: { evidence: readonly Evidence[] }) {
  const t = useTranslations('report');
  const format = useFormatter();
  const number = (value: number, digits: number) => format.number(value, { maximumFractionDigits: digits });
  const withUnit = (item: Evidence, value: number) => {
    const shown = evidenceDisplay(value, item.unit);

    switch (shown.unit) {
      case 'category':
        return t('evidence.units.category', {
          roman: romanCategory(shown.value),
          name: t(`verdict.soilNames.${String(shown.value)}` as 'verdict.soilNames.1'),
        });
      case 'seasons':
        return item.reference === undefined
          ? t('evidence.units.seasons', { value: shown.value })
          : t('evidence.units.seasonsOf', { value: shown.value, total: item.reference });
      case 'index':
        return t('evidence.units.index', { value: number(shown.value, 2) });
      case 'soilClass':
        return t('evidence.units.soilClass', { roman: romanSoilClass(shown.value) });
      default:
        return t(`evidence.units.${shown.unit}`, {
          value: number(shown.value, ['percent', 'count', 'm2', 'm3'].includes(shown.unit) ? 0 : 1),
        });
    }
  };

  return (
    <ul className="flex flex-col gap-1.5">
      {evidence.map((item, index) => {
        const shown = evidenceDisplay(item.value, item.unit);
        const role = referenceRole(shown.unit, item.metric);
        const radius = role === 'radius' ? (item.reference ?? DEFAULT_RADIUS_M) : DEFAULT_RADIUS_M;
        // "0 m z 1900 m" - odniesienie to calosc (granica pola), nie prog
        const value =
          role === 'total' && shown.unit === 'm' && item.reference !== undefined
            ? t('evidence.units.mOf', { value: number(shown.value, 0), total: number(item.reference, 0) })
            : withUnit(item, item.value);

        return (
          <li key={`${item.metric}:${item.source}:${item.value}`} className="flex flex-col">
            <span>
              {t('evidence.value', {
                metric: isKnownMetric(item.metric)
                  ? t(`evidence.metrics.${item.metric}`, { radius: number(radius, 0) })
                  : t('evidence.unknownMetric'),
                value,
              })}
            </span>
            <span className="text-muted-foreground">
              {item.reference === undefined || role !== 'reference'
                ? null
                : `${t(
                    HEAT_METRICS.includes(item.metric) ? 'evidence.referenceNormal' : 'evidence.reference',
                    {
                      reference: withUnit(item, item.reference),
                    },
                  )}; `}
              {t('evidence.source', { source: t(`sources.categories.${item.source}`) })}
            </span>
            {item.note && item.note !== evidence[index - 1]?.note && (
              <span className="text-muted-foreground" data-testid="evidence-note">
                {item.note}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

import type { Cause } from '@app/contracts';
import { useTranslations } from 'use-intl';

import { byWeight, percentOf } from '../../utils/report-data';
import { causeShare } from '../../utils/report-extras';
import { EvidenceList } from '../evidence-list';

/**
 * Sekcja 3 - przyczyny niedoboru od najwiekszego wplywu: tytul i zdanie dla rolnika, udzial w wyjasnieniu (pasek
 * i procent - ten sam, co na pasku udzialow nad lista; suma 100%) oraz liczby, na ktorych opiera sie wniosek.
 */
export function CausesSection({ causes }: { causes: readonly Cause[] }) {
  const t = useTranslations('report.causes');
  const sorted = byWeight(causes);

  if (sorted.length === 0) return <p className="text-base text-muted-foreground">{t('none')}</p>;

  return (
    // na wydruku blok, nie flex: Chrome trzyma wtedy naglowek i zdanie wstepu przy pierwszej karcie
    <div className="flex flex-col gap-3 print:block print:space-y-3">
      <p className="text-sm text-muted-foreground print:break-after-avoid">{t('intro')}</p>
      <ol className="flex flex-col gap-3 print:block print:space-y-3">
        {sorted.map((cause) => {
          const percent = percentOf(causeShare(cause, causes) ?? cause.weight);

          return (
            <li
              key={cause.id}
              className="flex flex-col gap-2 rounded-lg border bg-card p-4 print:break-inside-avoid"
              data-cause={cause.id}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-lg font-semibold">{t(`items.${cause.id}.title`)}</h3>
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  {t('weight', { percent })}
                </span>
              </div>
              <progress
                aria-hidden="true"
                value={percent}
                max={100}
                className="h-1.5 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-data-orange [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-data-orange"
              />
              <p className="text-base">{t(`items.${cause.id}.description`)}</p>
              <details className="text-sm">
                <summary className="min-h-11 cursor-pointer py-2.5 font-medium text-primary print:min-h-0 print:py-1">
                  {t('evidence')}
                </summary>
                <EvidenceList evidence={cause.evidence} />
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

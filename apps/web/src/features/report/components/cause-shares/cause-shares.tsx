import type { WaterReport } from '@app/contracts';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { byWeight, percentOf } from '../../utils/report-data';
import { causeShare } from '../../utils/report-extras';

/** Kolejne odcinki: kolor i wzor (ukosne paski, kropki) - na wydruku cz.-b. odcinki roznia sie wzorem. */
const SEGMENTS = [
  'fill-data-orange-dark',
  'fill-data-orange',
  'fill-data-sand',
  'fill-data-blue-light',
  'fill-water',
  'fill-muted-foreground',
  'fill-border',
];

/**
 * Udzial przyczyn jednym paskiem (suma 100%) i lista z procentami - szacunek wagi argumentu, nie pomiar, ile wody
 * zabrala dana przyczyna (zdanie pod paskiem). Bez udzialow (wszystkie wagi 0) komponent znika.
 */
export function CauseShares({ report }: { report: WaterReport }) {
  const t = useTranslations('report.viz.shares');
  const tItems = useTranslations('report.causes.items');
  const causes = byWeight(report.causes)
    .map((cause) => ({ cause, share: causeShare(cause, report.causes) }))
    .filter(
      (item): item is { cause: typeof item.cause; share: number } => item.share !== null && item.share > 0,
    );

  if (causes.length === 0) return null;
  // poczatek kazdego odcinka paska = suma udzialow poprzednich
  const starts = causes.map((_, index) =>
    causes.slice(0, index).reduce((sum, item) => sum + item.share * 100, 0),
  );

  return (
    <figure
      className="flex flex-col gap-3 rounded-2xl border p-4 print:break-inside-avoid"
      data-testid="cause-shares"
    >
      <figcaption className="text-lg font-semibold">{t('title')}</figcaption>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="h-8 w-full overflow-hidden rounded-lg"
      >
        <defs>
          <pattern
            id="share-hatch"
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="3" className="stroke-background" strokeWidth="0.8" opacity="0.6" />
          </pattern>
        </defs>
        {causes.map((item, index) => {
          const x = starts[index] ?? 0;

          return (
            <g key={item.cause.id}>
              <rect
                x={x}
                y="0"
                width={item.share * 100}
                height="10"
                className={SEGMENTS[index] ?? SEGMENTS[0]}
              />
              {index % 2 === 1 && (
                <rect x={x} y="0" width={item.share * 100} height="10" fill="url(#share-hatch)" />
              )}
              <line
                x1={x}
                x2={x}
                y1="0"
                y2="10"
                className="stroke-card"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>
      <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {causes.map((item, index) => (
          <li
            key={item.cause.id}
            className="flex items-center gap-2 text-base"
            data-share-cause={item.cause.id}
          >
            <svg aria-hidden="true" viewBox="0 0 10 10" className="size-4 shrink-0 rounded-sm">
              <rect width="10" height="10" className={cn(SEGMENTS[index] ?? SEGMENTS[0])} />
              {index % 2 === 1 && <rect width="10" height="10" fill="url(#share-hatch)" />}
            </svg>
            <span className="min-w-0 flex-1">{tItems(`${item.cause.id}.title`)}</span>
            <span className="font-semibold tabular-nums">
              {t('percent', { percent: percentOf(item.share) })}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{t('note')}</p>
    </figure>
  );
}

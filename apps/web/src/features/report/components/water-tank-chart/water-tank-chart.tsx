import type { WaterReport } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { waterTank } from '../../utils/report-extras';
import { ChartCard } from '../chart-card';

/**
 * "Ile wody maja teraz rosliny?" - zbiornik wody w glebie: woda dostepna dla roslin w procentach pelnego zapasu,
 * linia przerywana = zwykle tego dnia (mediana lat tla), linia ciagla z ukosnym wzorem ponizej = prog, ponizej
 * ktorego rosliny cierpia. Bez bilansu strefy korzeni karta znika.
 */
export function WaterTankChart({ report }: { report: WaterReport }) {
  const t = useTranslations('report.viz.tank');
  const format = useFormatter();
  const tank = waterTank(report);

  if (!tank) return null;
  const number = (value: number) => format.number(value, { maximumFractionDigits: 0 });
  const stressed = tank.stressBelowPct !== undefined && tank.availablePct < tank.stressBelowPct;
  const level = 100 - tank.availablePct;
  const answer = !tank.growing
    ? t('answerResting', { percent: tank.availablePct })
    : stressed
      ? t('answerStressed', { percent: tank.availablePct })
      : t('answerOk', { percent: tank.availablePct });

  return (
    <ChartCard
      title={t('title')}
      answer={
        tank.typicalPct === undefined ? answer : `${answer} ${t('typical', { percent: tank.typicalPct })}`
      }
      source={t('source')}
      description={t('description', {
        percent: tank.availablePct,
        mm: number(tank.availableMm),
        capacity: number(tank.capacityMm),
      })}
      data-testid="chart-tank"
    >
      <div className="flex items-stretch gap-5">
        <div className="relative h-48 w-24 shrink-0 overflow-hidden rounded-b-3xl rounded-t-lg border-2 border-foreground/70 bg-muted">
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            <defs>
              <pattern
                id="tank-stress"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" className="fill-muted" />
                <line x1="0" y1="0" x2="0" y2="6" className="stroke-data-orange" strokeWidth="2" />
              </pattern>
            </defs>
            {tank.stressBelowPct !== undefined && (
              <rect
                x="0"
                y={100 - tank.stressBelowPct}
                width="100"
                height={tank.stressBelowPct}
                fill="url(#tank-stress)"
                opacity="0.5"
              />
            )}
            <rect x="0" y={level} width="100" height={tank.availablePct} className="fill-water" />
            {tank.typicalPct !== undefined && (
              <line
                x1="0"
                x2="100"
                y1={100 - tank.typicalPct}
                y2={100 - tank.typicalPct}
                className="stroke-foreground"
                strokeWidth="2.5"
                strokeDasharray="7 5"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {tank.stressBelowPct !== undefined && (
              <line
                x1="0"
                x2="100"
                y1={100 - tank.stressBelowPct}
                y2={100 - tank.stressBelowPct}
                className="stroke-data-orange-strong"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>
        <dl className="flex min-w-0 flex-col justify-center gap-3 text-base">
          <div className="flex flex-col">
            <dt className="text-muted-foreground">{t('now')}</dt>
            <dd className="text-4xl leading-none font-bold tabular-nums" data-testid="tank-percent">
              {t('percent', { percent: tank.availablePct })}
            </dd>
            <dd className="text-muted-foreground">
              {t('mm', { mm: number(tank.availableMm), capacity: number(tank.capacityMm) })}
            </dd>
          </div>
          {tank.typicalPct !== undefined && (
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="w-6 shrink-0 border-t-[3px] border-dashed border-foreground"
              />
              <dt className="sr-only">{t('typicalLabel')}</dt>
              <dd>{t('typicalLegend', { percent: tank.typicalPct })}</dd>
            </div>
          )}
          {tank.stressBelowPct !== undefined && (
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="w-6 shrink-0 border-t-[3px] border-data-orange-strong" />
              <dt className="sr-only">{t('stressLabel')}</dt>
              <dd>{t('stressLegend', { percent: tank.stressBelowPct })}</dd>
            </div>
          )}
        </dl>
      </div>
    </ChartCard>
  );
}

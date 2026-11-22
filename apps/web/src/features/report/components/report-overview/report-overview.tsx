import type { WaterReport } from '@app/contracts';
import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Link } from '@/lib/navigation';
import { withHash, type AppHref } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

import { ditchInFieldM, fieldZones } from '../../utils/report-data';
import { reportExtras, waterTank } from '../../utils/report-extras';
import { FieldMap } from '../field-map';
import { FirstStep } from '../first-step';
import { ForecastWeek } from '../forecast-week';
import { KnownLimits } from '../known-limits';
import { SeasonBars } from '../season-bars';
import { ShortAnalysis } from '../short-analysis';
import { SimpleCauses } from '../simple-causes';
import { StressCountdown } from '../stress-countdown';
import { WaterLedgerChart } from '../water-ledger-chart';
import { WaterTankChart } from '../water-tank-chart';

export interface ReportOverviewProps {
  report: WaterReport;
  /** pelna analiza (widok szczegolowy) - link "Pokaz pelna analize" i "Wszystkie zalecenia" */
  detailedHref: AppHref;
  detailed: boolean;
}

/**
 * Widok prosty ("Pogodynka wody"): werdykt ze skala i mapa pola na gorze (komputer: ciemny panel z krotka analiza
 * obok duzego szkicu), potem woda teraz i w tym tygodniu, 10 lat i "dlaczego", "zrob najpierw" i "czego ocena nie
 * wie". Klocek bez danych znika; gdy w sekcji wody nie ma zadnego - jedno zdanie dlaczego. To samo jest pierwsza
 * strona wydruku.
 */
export function ReportOverview({ report, detailedHref, detailed }: ReportOverviewProps) {
  const t = useTranslations('report.simple');
  const zones = useMemo(() => fieldZones(report), [report]);
  const extras = reportExtras(report);
  // ile kart wody sie pokaze (pozostale znikaja same) - przy trzech jeden rzad na komputerze, bez sieroty
  const waterCards = [
    waterTank(report) !== null,
    extras.waterNow?.growing === true,
    extras.forecast !== undefined,
    extras.waterLedger !== undefined,
  ].filter(Boolean).length;
  const hasWater = waterCards > 0;

  return (
    <div className="flex flex-col gap-8 print:block print:space-y-4" data-testid="report-overview">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start print:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] print:gap-3">
        <ShortAnalysis report={report} />
        <section
          aria-labelledby="pole-title"
          className="flex flex-col gap-3 rounded-3xl border bg-card p-4 shadow-card sm:p-5 print:break-inside-avoid print:rounded-lg print:p-3 print:shadow-none"
        >
          <h2 id="pole-title" className="text-xl font-semibold">
            {t('field')}
          </h2>
          <FieldMap field={report.field} ditchInFieldM={ditchInFieldM(report)} zones={zones} wide />
        </section>
      </div>

      <section aria-labelledby="woda-title" className="flex flex-col gap-4 print:space-y-3">
        <h2 id="woda-title" className="text-2xl font-semibold print:break-after-avoid print:text-xl">
          {t('waterTitle')}
        </h2>
        {hasWater ? (
          <div
            className={cn(
              'grid gap-4 print:gap-3',
              waterCards > 1 && 'md:grid-cols-2 print:grid-cols-2',
              waterCards >= 3 && 'lg:grid-cols-3 print:grid-cols-3',
            )}
          >
            <WaterTankChart report={report} />
            <StressCountdown report={report} />
            <ForecastWeek report={report} />
            <WaterLedgerChart report={report} />
          </div>
        ) : (
          <p className="text-lg" data-testid="water-empty">
            {t('waterEmpty')}
          </p>
        )}
      </section>

      <section aria-labelledby="lata-title" className="flex flex-col gap-4 print:block print:space-y-3">
        <h2 id="lata-title" className="text-2xl font-semibold print:break-after-avoid print:text-xl">
          {t('historyTitle')}
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] print:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] print:gap-3">
          <SeasonBars report={report} />
          <SimpleCauses report={report} />
        </div>
      </section>

      <section
        aria-labelledby="co-robic-title"
        className="flex flex-col gap-4 print:block print:space-y-3 print:break-inside-avoid"
      >
        <h2 id="co-robic-title" className="text-2xl font-semibold print:break-after-avoid print:text-xl">
          {t('todoTitle')}
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] print:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] print:gap-3">
          <FirstStep report={report} allHref={withHash(detailedHref, 'retencja')} />
          <KnownLimits report={report} />
        </div>
      </section>

      {!detailed && (
        <Link
          href={withHash(detailedHref, 'analiza')}
          className="flex min-h-16 items-center justify-between gap-4 rounded-2xl bg-muted px-6 py-4 text-lg font-semibold text-foreground hover:bg-muted/70 print:hidden"
          data-testid="show-details"
        >
          <span className="flex flex-col">
            {t('showDetails')}
            <span className="text-base font-normal text-muted-foreground">{t('showDetailsNote')}</span>
          </span>
          <ArrowRight aria-hidden="true" className="size-6 shrink-0" />
        </Link>
      )}
    </div>
  );
}

import type { WaterReport } from '@app/contracts';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { withHash, type AppHref } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

import { ditchInFieldM, fieldZones } from '../../utils/report-data';
import { reportExtras, waterTank } from '../../utils/report-extras';
import { orderedRecommendations } from '../../utils/report-summary';
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
import { imageryRequest } from '../satellite-section';
import { ZoneList } from '../zone-list';

/** Dwie kolumny 3:2 (wykres albo pierwszy krok obok krotszego klocka). */
const TWO_COLUMNS =
  'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] print:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]';

export interface ReportOverviewProps {
  report: WaterReport;
  /** raport z rozwinietymi szczegolami - link "Wszystkie zalecenia" (do sekcji retencji) */
  detailsHref: AppHref;
}

/**
 * Pierwsza czesc raportu ("Pogodynka wody"): werdykt ze skala i krotka analiza, karta "Twoje pole" na cala szerokosc
 * (obraz pola w czterech trybach, miejsca na polu i objasnienia), potem woda teraz i w tym tygodniu, 10 lat
 * i "dlaczego", "zrob najpierw" i "czego ocena nie wie". Klocek bez danych znika; gdy w sekcji wody nie ma zadnego - jedno zdanie dlaczego. To samo jest pierwsza
 * strona wydruku.
 */
export function ReportOverview({ report, detailsHref }: ReportOverviewProps) {
  const t = useTranslations('report.simple');
  const zones = useMemo(() => fieldZones(report), [report]);
  const imagery = imageryRequest(report);
  const extras = reportExtras(report);
  // ile kart wody sie pokaze (pozostale znikaja same) - przy trzech jeden rzad na komputerze, bez sieroty
  const waterCards = [
    waterTank(report) !== null,
    extras.waterNow?.growing === true,
    extras.forecast !== undefined,
    extras.waterLedger !== undefined,
  ].filter(Boolean).length;
  const hasWater = waterCards > 0;
  // klocek bez danych znika - wtedy jedna kolumna zamiast pustej polowy rzedu (np. nadmiar wody bez zalecen)
  const hasCauses = report.causes.length > 0;
  const hasFirstStep = orderedRecommendations(report).length > 0;

  return (
    <div className="flex flex-col gap-8 print:block print:space-y-4" data-testid="report-overview">
      <ShortAnalysis report={report} />
      <FieldMap
        field={report.field}
        ditchInFieldM={ditchInFieldM(report)}
        zones={zones}
        imageryParcels={imagery?.dzialki ?? null}
        imageryDate={report.meta.analysisDate}
      >
        <ZoneList report={report} />
      </FieldMap>

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
        <div className={cn('grid gap-4 print:gap-3', hasCauses && TWO_COLUMNS)}>
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
        <div className={cn('grid gap-4 print:gap-3', hasFirstStep ? TWO_COLUMNS : 'max-w-3xl')}>
          <FirstStep report={report} allHref={withHash(detailsHref, 'retencja')} />
          <KnownLimits report={report} />
        </div>
      </section>
    </div>
  );
}

import type { IrrigationAdvice, WaterReport } from '@app/contracts';
import { Droplet } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { isPastAnalysis, volumeM3 } from '../../utils/report-data';

const ADVICE_STYLES: Record<IrrigationAdvice['advisable'], string> = {
  no: 'border-border',
  consider: 'border-water/50',
  yes: 'border-water',
};

/**
 * Sekcja 6 (ostatnia z zalecen) - nawadnianie: zawsze po retencji i agrotechnice. `netDepthMm` to laczny niedobor
 * do pelnego zapasu (w l/m2 i m3 na cale pole), nie jedna dawka - kontrakt nie rozbija go na podlania, wiec ekran
 * mowi to wprost. Dla dnia z przeszlosci zdanie w czasie przeszlym; brak oceny (null) = zdanie, dlaczego.
 */
export function IrrigationSection({ report }: { report: WaterReport }) {
  const t = useTranslations('report.irrigation');
  const format = useFormatter();
  const number = (value: number) => format.number(value, { maximumFractionDigits: 0 });
  const irrigation = report.recommendations.irrigation;

  if (!irrigation) return <p className="text-base text-muted-foreground">{t('none')}</p>;
  const past = isPastAnalysis(report);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t('first')}</p>
      <div
        className={cn(
          'flex flex-col gap-2 rounded-lg border-2 bg-card p-4 print:break-inside-avoid',
          ADVICE_STYLES[irrigation.advisable],
        )}
        data-advisable={irrigation.advisable}
      >
        <p className="flex items-center gap-2 text-lg font-semibold">
          <Droplet aria-hidden="true" className="size-5 text-water" />
          {past ? t(`advisablePast.${irrigation.advisable}`) : t(`advisable.${irrigation.advisable}`)}
        </p>
        {irrigation.advisable !== 'no' && irrigation.netDepthMm !== null && (
          <>
            <p className="text-base" data-testid="irrigation-deficit">
              {t('deficit', {
                mm: number(irrigation.netDepthMm),
                volume: format.number(volumeM3(irrigation.netDepthMm, report.field.areaHa)),
              })}
              {irrigation.withinDays === null ? null : ` ${t('within', { days: irrigation.withinDays })}`}
            </p>
            <p className="text-sm text-muted-foreground">{t('deficitNote')}</p>
          </>
        )}
        {irrigation.forecastPrecipMm === null ? (
          past ? null : (
            <p className="text-sm text-muted-foreground">{t('noForecast')}</p>
          )
        ) : (
          <p className="text-sm">
            {t('forecast', { mm: format.number(irrigation.forecastPrecipMm, { maximumFractionDigits: 1 }) })}
          </p>
        )}
      </div>
    </div>
  );
}

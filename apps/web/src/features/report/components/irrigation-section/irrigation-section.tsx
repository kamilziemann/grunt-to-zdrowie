import type { IrrigationAdvice } from '@app/contracts';
import { Droplet } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { volumeM3 } from '../../utils/report-data';

const ADVICE_STYLES: Record<IrrigationAdvice['advisable'], string> = {
  no: 'border-border',
  consider: 'border-water/50',
  yes: 'border-water',
};

/**
 * Sekcja 6 (ostatnia z zalecen) - nawadnianie: zawsze po retencji i agrotechnice, z dawka w l/m2 i m3 na cale pole,
 * terminem i prognoza deszczu, gdy sa dane. Brak oceny (null) = zdanie wprost, dlaczego.
 */
export function IrrigationSection({
  irrigation,
  areaHa,
}: {
  irrigation: IrrigationAdvice | null;
  areaHa: number;
}) {
  const t = useTranslations('report.irrigation');
  const format = useFormatter();
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });

  if (!irrigation) return <p className="text-base text-muted-foreground">{t('none')}</p>;

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
          {t(`advisable.${irrigation.advisable}`)}
        </p>
        {irrigation.advisable !== 'no' && irrigation.netDepthMm !== null && (
          <p className="text-base">
            {t('dose', {
              mm: number(irrigation.netDepthMm),
              volume: format.number(volumeM3(irrigation.netDepthMm, areaHa)),
            })}
            {irrigation.withinDays === null ? null : ` ${t('within', { days: irrigation.withinDays })}`}
          </p>
        )}
        {irrigation.forecastPrecipMm === null ? (
          <p className="text-sm text-muted-foreground">{t('noForecast')}</p>
        ) : (
          <p className="text-sm">{t('forecast', { mm: number(irrigation.forecastPrecipMm) })}</p>
        )}
      </div>
    </div>
  );
}

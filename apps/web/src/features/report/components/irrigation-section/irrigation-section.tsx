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
 * Sekcja 6 (ostatnia z zalecen) - nawadnianie: zawsze po retencji i agrotechnice. Plan podlewania z silnika ("4
 * podlania po 30 l/m2 co 6 dni") z woda na cale pole w m3 (jedna dawka i caly plan), pod nim laczny niedobor do
 * pelnego zapasu. Starszy raport bez dawek mowi, ze niedobor to nie jedna dawka. Dla dnia z przeszlosci zdanie
 * w czasie przeszlym; brak oceny (null) = zdanie, dlaczego.
 */
export function IrrigationSection({ report }: { report: WaterReport }) {
  const t = useTranslations('report.irrigation');
  const format = useFormatter();
  const number = (value: number) => format.number(value, { maximumFractionDigits: 0 });
  const irrigation = report.recommendations.irrigation;

  if (!irrigation) return <p className="text-base text-muted-foreground">{t('none')}</p>;
  const past = isPastAnalysis(report);

  // nadmiar wody: jedno zdanie zamiast "nawadnianie rozwaz po dzialaniach wyzej"
  if (report.assessment.level === 'excess' && irrigation.advisable === 'no') {
    return (
      <p
        className="flex items-center gap-2 rounded-lg border-2 bg-card p-4 text-lg font-semibold"
        data-testid="irrigation-excess"
      >
        <Droplet aria-hidden="true" className="size-5 text-water" />
        {t(past ? 'excessPast' : 'excess')}
      </p>
    );
  }

  const plan =
    irrigation.doses !== undefined && irrigation.doseMm !== undefined
      ? { doses: irrigation.doses, doseMm: irrigation.doseMm, intervalDays: irrigation.intervalDays ?? 0 }
      : null;

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
        {irrigation.advisable !== 'no' && plan && (
          <div className="flex flex-col gap-1" data-testid="irrigation-plan">
            <p className="text-lg font-semibold">
              {t('plan', { doses: plan.doses, dose: number(plan.doseMm), interval: plan.intervalDays })}
            </p>
            <p className="text-base">
              {t('planVolume', {
                dose: format.number(volumeM3(plan.doseMm, report.field.areaHa)),
                total: format.number(volumeM3(plan.doseMm * plan.doses, report.field.areaHa)),
              })}
            </p>
            <p className="text-sm text-muted-foreground">{t('planNote')}</p>
          </div>
        )}
        {irrigation.advisable !== 'no' && irrigation.netDepthMm !== null && (
          <>
            <p className="text-base" data-testid="irrigation-deficit">
              {t('deficit', {
                mm: number(irrigation.netDepthMm),
                volume: format.number(volumeM3(irrigation.netDepthMm, report.field.areaHa)),
              })}
              {/* termin ("najlepiej dzis") ma sens tylko dla dzisiejszej analizy */}
              {irrigation.withinDays === null || past
                ? null
                : ` ${t('within', { days: irrigation.withinDays })}`}
            </p>
            {!plan && <p className="text-sm text-muted-foreground">{t('deficitNote')}</p>}
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

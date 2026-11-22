import type { WaterReport } from '@app/contracts';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Link } from '@/lib/navigation';
import type { AppHref } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

import { isPastAnalysis, volumeM3 } from '../../utils/report-data';
import { orderedRecommendations, stepBadge, type StepBadge } from '../../utils/report-summary';

/** Plakietka mozliwosci: "mozesz od razu" jasna, "najpierw sprawdz / uzgodnij" piaskowa z ramka. */
const BADGE_STYLES: Record<StepBadge, string> = {
  now: 'bg-accent text-accent-foreground print:border print:border-foreground print:bg-transparent print:text-foreground',
  check: 'bg-data-sand text-accent-foreground print:border print:border-foreground print:text-foreground',
  protected: 'bg-data-sand text-accent-foreground print:border print:border-foreground print:text-foreground',
  notification:
    'bg-data-sand text-accent-foreground print:border print:border-foreground print:text-foreground',
  permit: 'bg-data-sand text-accent-foreground print:border print:border-foreground print:text-foreground',
};

/**
 * "Zrob najpierw": pierwsze zalecenie w kolejnosci zatrzymaj wode -> gleba, z plakietka wynikajaca z formalnosci
 * i dopiskow serwera ("najpierw sprawdz na miejscu", "wymaga zgloszenia"), dopiski "Zanim zaczniesz" i nastepne dwa
 * kroki; na koncu podlewanie jednym zdaniem. Ciemna karta (na wydruku jasna z ramka).
 */
export function FirstStep({ report, allHref }: { report: WaterReport; allHref: AppHref }) {
  const t = useTranslations('report.simple.first');
  const tMeasures = useTranslations('report.recommendations.measures');
  const tIrrigation = useTranslations('report.irrigation');
  const [first, ...rest] = orderedRecommendations(report);

  if (!first) return null;
  const badge = stepBadge(first);
  const irrigation = report.recommendations.irrigation;
  const past = isPastAnalysis(report);
  const irrigationText =
    report.assessment.level === 'excess'
      ? tIrrigation(past ? 'excessPast' : 'excess')
      : irrigation
        ? [
            tIrrigation(`${past ? 'advisablePast' : 'advisable'}.${irrigation.advisable}`),
            // termin i rozmiar od razu w karcie "Co robic" - rolnik nie szuka ich w szczegolach
            irrigation.advisable !== 'no' && irrigation.withinDays !== null
              ? tIrrigation(past ? 'withinPast' : 'within', { days: irrigation.withinDays })
              : null,
            irrigation.advisable !== 'no' && irrigation.doses !== undefined && irrigation.doseMm !== undefined
              ? tIrrigation('planShort', {
                  doses: irrigation.doses,
                  dose: irrigation.doseMm,
                  interval: irrigation.intervalDays ?? 0,
                })
              : null,
          ]
            .filter(Boolean)
            .join(' ')
        : null;

  return (
    <section
      aria-labelledby="najpierw-title"
      className="flex flex-col gap-4 surface-panel rounded-2xl p-5 shadow-card print:bg-transparent print:[color-scheme:light] sm:p-6 print:break-inside-avoid print:border-2 print:border-foreground/70 print:p-4 print:shadow-none"
      data-testid="first-step"
      data-first-measure={first.measure}
    >
      <h3 id="najpierw-title" className="text-sm font-bold tracking-wider text-success uppercase">
        {t(report.assessment.level === 'out_of_season' ? 'titleOffSeason' : 'title')}
      </h3>
      <p className="text-2xl leading-tight font-bold text-balance">{tMeasures(`${first.measure}.name`)}</p>
      {badge && (
        <p
          className={cn('w-fit rounded-full px-3 py-1 text-base font-semibold', BADGE_STYLES[badge])}
          data-testid="first-step-badge"
        >
          {t(`badges.${badge}`)}
        </p>
      )}
      <p className="text-lg leading-snug">{tMeasures(`${first.measure}.description`)}</p>
      {first.notes && first.notes.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-current/20 p-3">
          <p className="text-base font-semibold">{t('before')}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
            {first.notes.map((note) => (
              <li key={note.id}>{note.text}</li>
            ))}
          </ul>
        </div>
      )}
      {(rest.length > 0 || irrigationText) && (
        <dl className="flex flex-col gap-1.5 border-t border-current/20 pt-3 text-lg">
          {rest.length > 0 && (
            <div>
              <dt className="inline font-semibold">{t('then')} </dt>
              <dd className="inline">
                {rest
                  .slice(0, 2)
                  .map((item) => tMeasures(`${item.measure}.name`).toLocaleLowerCase('pl'))
                  .join(', ')}
              </dd>
            </div>
          )}
          {irrigationText && (
            <div>
              <dt className="inline font-semibold">{t('irrigation')} </dt>
              <dd className="inline">{irrigationText}</dd>
            </div>
          )}
        </dl>
      )}
      {irrigation && irrigation.advisable !== 'no' && report.assessment.level !== 'excess' && (
        <IrrigationDetails report={report} />
      )}
      <Link
        href={allHref}
        className="inline-flex min-h-12 w-fit items-center gap-2 rounded-full border border-current/40 px-5 text-base font-semibold hover:bg-current/10 print:hidden"
      >
        {t('all', { count: rest.length + 1 })}
        <ArrowRight aria-hidden="true" className="size-5" />
      </Link>
    </section>
  );
}

/**
 * Rozwijane "Szczegoly podlewania" pod krotkim zdaniem w karcie zalecen: ile wody na cale pole, dawka i odstep, ile
 * brakuje do pelnego zapasu, prognoza deszczu i jak podlewac, zeby woda nie uciekla. Na wydruku rozwiniete.
 */
function IrrigationDetails({ report }: { report: WaterReport }) {
  const t = useTranslations('report.simple.first');
  const tIrrigation = useTranslations('report.irrigation');
  const format = useFormatter();
  const irrigation = report.recommendations.irrigation;

  if (!irrigation) return null;
  const number = (value: number) => format.number(value, { maximumFractionDigits: 0 });
  const plan =
    irrigation.doses !== undefined && irrigation.doseMm !== undefined
      ? { doses: irrigation.doses, doseMm: irrigation.doseMm }
      : null;
  const lines = [
    plan
      ? tIrrigation('planVolume', {
          dose: format.number(volumeM3(plan.doseMm, report.field.areaHa)),
          total: format.number(volumeM3(plan.doseMm * plan.doses, report.field.areaHa)),
        })
      : null,
    irrigation.netDepthMm === null
      ? null
      : tIrrigation('deficit', {
          mm: number(irrigation.netDepthMm),
          volume: format.number(volumeM3(irrigation.netDepthMm, report.field.areaHa)),
        }),
    plan ? tIrrigation('planNote') : tIrrigation('deficitNote'),
    irrigation.forecastPrecipMm === null
      ? null
      : tIrrigation('forecast', {
          mm: format.number(irrigation.forecastPrecipMm, { maximumFractionDigits: 1 }),
        }),
    t('irrigationTiming'),
    t('irrigationCheck'),
  ].filter((line): line is string => line !== null);

  return (
    <details
      className="group/irrigation rounded-xl border border-current/20"
      data-testid="first-step-irrigation"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
        {t('irrigationMore')}
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 transition-transform group-open/irrigation:rotate-180 print:hidden"
        />
      </summary>
      <ul className="flex list-disc flex-col gap-1.5 px-4 pb-4 pl-9 text-base">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

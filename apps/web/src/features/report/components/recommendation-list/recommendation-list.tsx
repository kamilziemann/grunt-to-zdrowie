import type { Recommendation, WaterReport } from '@app/contracts';
import { ClipboardCheck, Hammer, ListChecks, MapPin } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { byPriority, fieldZones, zoneOf } from '../../utils/report-data';
import { EvidenceList } from '../evidence-list';
import { useZoneFocus } from '../zone-focus';
import { useZoneDescription, ZoneButton, ZoneNumber } from '../zone-list';

type PriorityKey = 'p1' | 'p2' | 'p3';

/** Wyroznienie priorytetu 1 ("zacznij od tego"); klasy jako literaly. */
const PRIORITY_STYLES: Record<PriorityKey, string> = {
  p1: 'bg-primary text-primary-foreground',
  p2: 'bg-secondary text-secondary-foreground',
  p3: 'bg-muted text-muted-foreground',
};

/** "Suchsze miejsce..." -> "suchsze miejsce..." (zdanie z serwera wchodzi w srodek zdania). */
function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('pl') + text.slice(1);
}

function priorityKey(priority: number): PriorityKey {
  if (priority <= 1) return 'p1';

  return priority === 2 ? 'p2' : 'p3';
}

export interface RecommendationListProps {
  category: Recommendation['category'];
  recommendations: readonly Recommendation[];
  report: WaterReport;
}

/**
 * Sekcje 4 i 5 - zalecenia (retencja albo agrotechnika) od priorytetu 1: co zrobic, po co, szacowany efekt,
 * naklad pracy, formalnosci wodnoprawne, miejsce na polu i przyczyny, na ktore odpowiada (z liczbami w rozwinieciu).
 * Zalecenie dla miejsca na polu ma jego numer ze szkicu; przycisk "Pokaz na szkicu" (fokus, najechanie, klikniecie)
 * wyroznia to miejsce na szkicu.
 */
export function RecommendationList({ category, recommendations, report }: RecommendationListProps) {
  const t = useTranslations('report.recommendations');
  const tCauses = useTranslations('report.causes');
  const tReport = useTranslations('report');
  const format = useFormatter();
  const sorted = byPriority(recommendations);
  const numbered = new Map(fieldZones(report).map((item) => [item.zone.id, item.number]));
  const describe = useZoneDescription();
  const { active } = useZoneFocus();

  if (sorted.length === 0) {
    const excess = category === 'retention' && report.assessment.level === 'excess';

    return (
      <p className="text-base text-muted-foreground">
        {t(excess ? 'none.retentionExcess' : `none.${category}`)}
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3 print:block print:space-y-3">
      {sorted.map((recommendation) => {
        const zone = zoneOf(report, recommendation.zoneId);
        const number = zone ? numbered.get(zone.id) : undefined;
        const focusZone = number === undefined ? undefined : zone?.id;
        const priority = priorityKey(recommendation.priority);
        const causes = format.list(
          recommendation.causes.map((cause) => tCauses(`items.${cause}.title`).toLowerCase()),
          { type: 'conjunction' },
        );

        return (
          <li
            key={`${recommendation.measure}:${recommendation.zoneId ?? 'field'}`}
            className={cn(
              'flex flex-col gap-3 rounded-lg border bg-card p-4 print:break-inside-avoid',
              recommendation.priority === 1 && 'border-primary/50',
              focusZone && active === focusZone && 'ring-2 ring-(--sketch-highlight)',
            )}
            data-measure={recommendation.measure}
            data-zone={focusZone}
          >
            <div className="flex flex-col gap-1.5">
              <p
                className={cn(
                  'w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold print:border',
                  PRIORITY_STYLES[priority],
                )}
              >
                {t(`priority.${priority}`)}
              </p>
              <h3 className="text-lg font-semibold">{t(`measures.${recommendation.measure}.name`)}</h3>
              <p className="text-base">{t(`measures.${recommendation.measure}.description`)}</p>
              {/* efekt zaokraglony do zera ("ok. 0 l/m2") nic rolnikowi nie mowi */}
              {recommendation.effect && Math.round(recommendation.effect.value * 10) !== 0 && (
                <p className="text-base font-semibold text-water">
                  {t(`effect.${recommendation.effect.kind}`, {
                    value: format.number(recommendation.effect.value, { maximumFractionDigits: 1 }),
                  })}
                </p>
              )}
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li className="flex items-start gap-2">
                <Hammer aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {t('effort', { level: t(`effortLevels.${recommendation.effort}`) })}
              </li>
              <li className="flex items-start gap-2">
                <ClipboardCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {t(`legal.${recommendation.legal}`)}
              </li>
              <li className="flex items-start gap-2">
                {zone && number !== undefined ? (
                  <>
                    <ZoneNumber number={number} active={active === zone.id} />
                    <span className="flex flex-col items-start">
                      <span className="pt-0.5 text-base">
                        {t('zoneNumbered', { number, description: lowerFirst(describe(zone)) })}
                      </span>
                      <ZoneButton
                        zoneId={zone.id}
                        className="min-h-11 py-2.5 font-medium text-primary underline underline-offset-4 print:hidden"
                      >
                        {t('showOnSketch', { number })}
                      </ZoneButton>
                    </span>
                  </>
                ) : (
                  <>
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    {zone?.kind === 'typical' && numbered.size > 0
                      ? t('zoneRest')
                      : zone
                        ? t('zone', {
                            kind: t(`zoneKinds.${zone.kind}`),
                            area: format.number(zone.areaHa, { maximumFractionDigits: 2 }),
                          })
                        : t('wholeField')}
                  </>
                )}
              </li>
            </ul>
            {recommendation.notes && recommendation.notes.length > 0 && (
              <div
                className="flex flex-col gap-1.5 rounded-md border-l-4 border-warning bg-muted/60 py-2 pr-3 pl-3"
                data-testid="recommendation-notes"
              >
                <p className="flex items-center gap-2 text-base font-semibold">
                  <ListChecks aria-hidden="true" className="size-4 shrink-0 text-warning" />
                  {t('notesTitle')}
                </p>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
                  {recommendation.notes.map((note) => (
                    <li key={note.id}>{note.text}</li>
                  ))}
                </ul>
              </div>
            )}
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer py-2.5 font-medium text-primary print:min-h-0 print:py-1">
                {tReport('details')}
              </summary>
              <div className="flex flex-col gap-2">
                <p>{t('answers', { causes })}</p>
                <EvidenceList evidence={recommendation.evidence} />
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

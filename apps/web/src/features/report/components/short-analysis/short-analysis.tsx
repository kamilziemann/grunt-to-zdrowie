import type { WaterReport } from '@app/contracts';
import { CalendarOff, CircleCheck, CircleHelp, CloudSun, Droplets, Sun, type LucideIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Link } from '@/lib/navigation';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

import { byWeight, isoDay, reportSearch, verdictCaveat } from '../../utils/report-data';
import { waterTank } from '../../utils/report-extras';
import {
  drySeasons,
  lastSummerDate,
  orderedRecommendations,
  riskMonthRange,
  scaleStep,
  SCALE_STEPS,
  type ScaleStep,
} from '../../utils/report-summary';

/** Ikona i kolor kroku skali - slowo stoi zawsze obok (nigdy sam kolor). Klasy jako literaly (Tailwind). */
const STEP_STYLES: Record<ScaleStep, { icon: LucideIcon; text: string; fill: string }> = {
  wet: {
    icon: Droplets,
    text: 'text-water',
    fill: 'bg-water',
  },
  good: {
    icon: CircleCheck,
    text: 'text-success',
    fill: 'bg-data-blue-light',
  },
  slightlyDry: {
    icon: CloudSun,
    text: 'text-warning lg:text-data-sand print:text-warning',
    fill: 'bg-data-sand',
  },
  dry: {
    icon: Sun,
    text: 'text-data-orange-strong lg:text-data-orange print:text-data-orange-strong',
    fill: 'bg-data-orange',
  },
  veryDry: {
    icon: Sun,
    text: 'text-data-orange-dark lg:text-data-orange print:text-data-orange-dark',
    fill: 'bg-data-orange-dark',
  },
};

/** Skala pieciu poziomow: aktualny krok wyzszy, z ramka i podpisem pogrubionym; pozostale przygaszone. */
function Scale({ step }: { step: ScaleStep }) {
  const t = useTranslations('report.simple.scale');

  return (
    <div className="flex flex-col gap-1.5" data-testid="verdict-scale" data-step={step}>
      <p className="sr-only">{t('label', { step: t(step) })}</p>
      {/* paski w jednym rzedzie (wysokosc najwyzszego), podpisy od tej samej linii - dwuwierszowy podpis nie podnosi
          paska */}
      <ol aria-hidden="true" className="grid grid-cols-5 items-start gap-1">
        {SCALE_STEPS.map((item) => (
          <li key={item} className="flex min-w-0 flex-col items-stretch gap-1.5">
            <span className="flex h-6 items-center">
              <span
                className={cn(
                  'block w-full rounded-full',
                  STEP_STYLES[item].fill,
                  item === step
                    ? 'h-4 ring-2 ring-current ring-offset-2 ring-offset-card lg:ring-offset-panel print:ring-offset-card'
                    : 'h-2 opacity-45',
                )}
              />
            </span>
            <span
              className={cn(
                'text-center text-sm leading-tight',
                item === step ? 'font-bold' : 'text-muted-foreground',
              )}
            >
              {t(item)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Zdanie z liczba pod slowem werdyktu: brak wody do pelnego zapasu, zapas w procentach albo deszcz na tle lat. */
function useNumberSentence(report: WaterReport): string | null {
  const t = useTranslations('report.simple.verdict');
  const format = useFormatter();
  const tank = waterTank(report);
  const { level, precipitation } = report.assessment;
  const mm = (value: number) => format.number(Math.round(value), { maximumFractionDigits: 0 });

  if (level === 'excess' && precipitation) {
    return t('excess', {
      days: precipitation.days,
      sum: mm(precipitation.sumMm),
      median: mm(precipitation.medianMm),
    });
  }

  if (!tank) return null;

  if (!tank.growing || level === 'out_of_season') return t('resting', { percent: tank.availablePct });

  if (level === 'ok') return t('ok', { percent: tank.availablePct });

  return t('missing', { mm: mm(tank.capacityMm - tank.availableMm), percent: tank.availablePct });
}

/**
 * Werdykt widoku prostego: jedno slowo z ikona, skala od mokro do bardzo sucho, zdanie z liczba i zdanie oceny.
 * Na komputerze ciemny panel na cala szerokosc: werdykt po lewej, krotka analiza w pieciu zdaniach po prawej (teraz,
 * 10 lat, dlaczego, co najpierw, pewnosc); na telefonie jasna karta - te same tresci sa w klockach ponizej. Na wydruku jasny panel z ramka i piecioma zdaniami.
 */
export function ShortAnalysis({ report }: { report: WaterReport }) {
  const t = useTranslations('report.simple');
  const tVerdict = useTranslations('report.verdict');
  const tCauses = useTranslations('report.causes.items');
  const tMeasures = useTranslations('report.recommendations.measures');
  const tSources = useTranslations('report.sources');
  const format = useFormatter();
  const { level, confidence } = report.assessment;
  const step = scaleStep(level);
  const Icon = step ? STEP_STYLES[step].icon : level === 'out_of_season' ? CalendarOff : CircleHelp;
  const numberSentence = useNumberSentence(report);
  const caveat = verdictCaveat(report);
  const seasons = drySeasons(report);
  const range = riskMonthRange(report.history.riskMonths);
  const month = (value: number) =>
    format.dateTime(new Date(Date.UTC(2024, value - 1, 1)), { month: 'long', timeZone: 'UTC' });
  const causes = byWeight(report.causes).slice(0, 2);
  const first = orderedRecommendations(report)[0];
  // poza sezonem: zapas przed wiosna i co zrobic przed wiosna (makieta "listopad"), link do lata tego samego pola
  const offSeason = level === 'out_of_season';
  const summer = lastSummerDate(report);
  const lines: { key: string; label: string; text: string }[] = [
    {
      key: 'now',
      label: t(offSeason ? 'lines.nowOffSeason' : 'lines.now'),
      text: offSeason ? t('offSeason.now') : tVerdict(`sentences.${level}`),
    },
    ...(seasons
      ? [
          {
            key: 'history',
            label: t('lines.history'),
            text:
              range === null
                ? t('lines.historyText', seasons)
                : t('lines.historyMonths', {
                    ...seasons,
                    months:
                      range[0] === range[1] ? month(range[0]) : `${month(range[0])} – ${month(range[1])}`,
                  }),
          },
        ]
      : []),
    ...(causes.length > 0
      ? [
          {
            key: 'why',
            label: t('lines.why'),
            // "Gleba slabo trzyma wode, uprawa jest teraz wrazliwa..." - jedno zdanie
            text: causes
              .map((cause, index) =>
                index === 0 ? tCauses(`${cause.id}.title`) : tCauses(`${cause.id}.title`).toLocaleLowerCase(),
              )
              .join(', '),
          },
        ]
      : []),
    ...(first
      ? [
          {
            key: 'first',
            label: t(offSeason ? 'lines.firstOffSeason' : 'lines.first'),
            text: tMeasures(`${first.measure}.name`),
          },
        ]
      : []),
    {
      key: 'confidence',
      label: t('lines.confidence'),
      text: `${tVerdict(`confidenceLevels.${confidence}`)} – ${tSources(`confidenceExplain.${confidence}`)}`,
    },
  ];

  return (
    <section
      aria-labelledby="ocena-skrot-title"
      className="flex flex-col gap-5 rounded-3xl border bg-card p-5 text-card-foreground shadow-card sm:p-7 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:border-transparent lg:surface-panel print:grid print:grid-cols-2 print:gap-x-4 print:rounded-lg print:[color-scheme:light] print:border-2 print:border-foreground/70 print:bg-card print:p-4 print:text-foreground print:shadow-none"
      data-testid="short-analysis"
      data-level={level}
    >
      <h2 id="ocena-skrot-title" className="sr-only">
        {t('title')}
      </h2>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <Icon
            aria-hidden="true"
            className={cn(
              'size-14 shrink-0 stroke-[1.6] sm:size-16',
              step ? STEP_STYLES[step].text : 'text-muted-foreground',
            )}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-5xl leading-none font-bold tracking-tight" data-testid="verdict-word">
              {step ? t(`scale.${step}`) : tVerdict(`levels.${level}`)}
            </p>
            {numberSentence && (
              <p className="text-lg leading-snug font-medium" data-testid="verdict-number">
                {numberSentence}
              </p>
            )}
          </div>
        </div>
        {step && <Scale step={step} />}
        <p className="text-lg leading-snug lg:hidden print:hidden">
          {offSeason ? t('offSeason.now') : tVerdict(`sentences.${level}`)}
        </p>
        {caveat && (
          <p
            className="rounded-xl border-2 border-warning bg-warning/10 px-3 py-2 text-base font-medium lg:border-data-sand lg:bg-transparent print:border-warning"
            data-testid="verdict-caveat-short"
          >
            {tVerdict('caveat.title')}
          </p>
        )}
        {summer && (
          <Link
            href={routes.report({ ...reportSearch(report), data: summer })}
            className="flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90 print:hidden"
            data-testid="summer-link"
          >
            {t('offSeason.summer', {
              date: format.dateTime(isoDay(summer), {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }),
            })}
          </Link>
        )}
        <p className="text-base text-muted-foreground">
          {t('asOf', {
            date: format.dateTime(isoDay(report.meta.analysisDate), { dateStyle: 'long', timeZone: 'UTC' }),
          })}
        </p>
      </div>
      <dl
        className="flex flex-col gap-3 border-t border-current/15 pt-4 max-lg:hidden lg:border-t-0 lg:border-l lg:pt-1 lg:pl-8 print:flex print:border-t-0 print:border-l print:pt-0 print:pl-4"
        data-testid="short-analysis-lines"
      >
        {lines.map((line) => (
          <div key={line.key} className="flex flex-col gap-0.5" data-line={line.key}>
            <dt className="text-sm font-semibold tracking-wide text-success uppercase">{line.label}</dt>
            <dd className="text-lg leading-snug print:text-base">{line.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

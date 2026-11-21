import type { AssessmentLevel, WaterReport } from '@app/contracts';
import {
  CalendarOff,
  CircleCheck,
  CircleHelp,
  Droplets,
  Eye,
  Sun,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { isoDay, percentOf, soilWater } from '../../utils/report-data';
import { ReportDetails } from '../report-section';

/** Kolor, ikona i slowo dla poziomu - nigdy sam kolor (WCAG 1.4.1). Klasy jako literaly (Tailwind skanuje zrodla). */
const LEVEL_STYLES: Record<AssessmentLevel, { icon: LucideIcon; card: string; badge: string }> = {
  ok: {
    icon: CircleCheck,
    card: 'border-success/50 bg-success/10',
    badge: 'bg-success text-success-foreground',
  },
  watch: { icon: Eye, card: 'border-warning/40 bg-warning/10', badge: 'bg-warning text-warning-foreground' },
  risk: {
    icon: TriangleAlert,
    card: 'border-warning bg-warning/15',
    badge: 'bg-warning text-warning-foreground',
  },
  drought: {
    icon: Sun,
    card: 'border-destructive/60 bg-destructive/10',
    badge: 'bg-destructive text-destructive-foreground',
  },
  excess: { icon: Droplets, card: 'border-water/50 bg-water/10', badge: 'bg-water text-water-foreground' },
  out_of_season: {
    icon: CalendarOff,
    card: 'border-border bg-muted',
    badge: 'bg-foreground text-background',
  },
  unknown: { icon: CircleHelp, card: 'border-border bg-muted', badge: 'bg-foreground text-background' },
};

/**
 * Sekcja 1 - ocena: jedno zdanie jezykiem rolnika z kolorem, ikona i slowem, pod nim kilka liczb (zapas wody w
 * glebie, deszcz na tle lat, dni stresu, rosliny z satelity, pewnosc). Bilans KBW, progi IUNG i wskazniki
 * satelitarne sa w rozwijanych szczegolach.
 */
export function VerdictSection({ report }: { report: WaterReport }) {
  const t = useTranslations('report.verdict');
  const tReport = useTranslations('report');
  const format = useFormatter();
  const { assessment, crop } = report;
  const style = LEVEL_STYLES[assessment.level];
  const Icon = style.icon;
  const number = (value: number, digits = 1) => format.number(value, { maximumFractionDigits: digits });
  const day = (date: string) => format.dateTime(isoDay(date), { dateStyle: 'medium', timeZone: 'UTC' });
  const water = assessment.rootZone ? soilWater(assessment.rootZone) : null;
  const balance = assessment.climaticBalance;
  const vegetation = assessment.vegetation;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border-2 p-5 print:break-inside-avoid sm:p-6',
          style.card,
        )}
        data-level={assessment.level}
        data-testid="verdict"
      >
        <p
          className={cn(
            'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-base font-semibold print:border',
            style.badge,
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
          {t(`levels.${assessment.level}`)}
        </p>
        <p className="text-xl leading-snug font-semibold text-balance sm:text-2xl">
          {t(`sentences.${assessment.level}`)}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="sr-only">{t('facts')}</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          {water && (
            <Fact label={t('soilWater')} value={t('soilWaterValue', { percent: water.percent })}>
              <progress
                aria-hidden="true"
                value={water.percent}
                max={100}
                className="h-2 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-water [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-water"
              />
              {t('soilWaterNote', { left: water.leftMm, total: water.totalMm })}
            </Fact>
          )}
          {assessment.precipitation && (
            <Fact
              label={t('rain', { days: assessment.precipitation.days })}
              value={t('rainValue', { sum: number(assessment.precipitation.sumMm) })}
            >
              {t('rainNote', {
                median: number(assessment.precipitation.medianMm),
                rank: assessment.precipitation.rank,
                years: assessment.precipitation.years,
              })}
            </Fact>
          )}
          {assessment.rootZone && (
            <Fact label={t('stress')} value={t('stressValue', { days: assessment.rootZone.stressDays30 })} />
          )}
          {vegetation && (
            <Fact label={t('plants')} value={t(`interpretation.${vegetation.interpretation}`)} />
          )}
          <Fact label={t('confidence')} value={t(`confidenceLevels.${assessment.confidence}`)} />
        </dl>
      </div>

      <ReportDetails summary={tReport('details')}>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(10rem,auto)_1fr]">
          {balance && (
            <>
              <dt className="font-medium">{t('balance')}</dt>
              <dd className="flex flex-col">
                {balance.balanceMm !== null &&
                balance.precipMm !== null &&
                balance.evapotranspirationMm !== null ? (
                  <span>
                    {t('balanceValue', {
                      balance: number(balance.balanceMm),
                      precip: number(balance.precipMm),
                      et: number(balance.evapotranspirationMm),
                    })}
                  </span>
                ) : (
                  <span>{t(`balanceStatus.${balance.status}`)}</span>
                )}
                {balance.periodNo !== null && (
                  <span className="text-muted-foreground">
                    {t('balancePeriod', {
                      no: balance.periodNo,
                      from: day(balance.periodFrom),
                      to: day(balance.periodTo),
                    })}
                  </span>
                )}
                <span className="text-muted-foreground">{t(`methods.${balance.method}`)}</span>
              </dd>
              <dt className="font-medium">{t('threshold')}</dt>
              <dd className="flex flex-col">
                <span>
                  {balance.thresholdMm !== null && balance.soilCategory !== null
                    ? t('thresholdValue', {
                        threshold: number(balance.thresholdMm),
                        category: balance.soilCategory,
                      })
                    : t('thresholdNone')}
                </span>
                {balance.belowThreshold !== null && (
                  <span className="text-muted-foreground">
                    {balance.belowThreshold ? t('belowThreshold') : t('aboveThreshold')}
                  </span>
                )}
              </dd>
            </>
          )}
          {assessment.rootZone && (
            <>
              <dt className="font-medium">{t('rootZone')}</dt>
              <dd>
                {t('rootZoneValue', {
                  taw: number(assessment.rootZone.totalAvailableMm),
                  raw: number(assessment.rootZone.readilyAvailableMm),
                  depletion: number(assessment.rootZone.depletionMm),
                  ks: number(assessment.rootZone.stressCoefficient, 2),
                })}
              </dd>
            </>
          )}
          <dt className="font-medium">{t('cropStage')}</dt>
          <dd>
            {crop.kc !== null && crop.rootDepthM !== null
              ? t('cropStageValue', {
                  stage: t(`stages.${crop.stage}`),
                  kc: number(crop.kc, 2),
                  depth: number(crop.rootDepthM, 2),
                })
              : t('cropStageNoKc', { stage: t(`stages.${crop.stage}`) })}
          </dd>
          {vegetation && (
            <>
              <dt className="font-medium">{t('vegetation')}</dt>
              <dd>
                {t('vegetationValue', {
                  date: day(vegetation.observedOn),
                  ndvi: optional(vegetation.ndvi, number),
                  ndmi: optional(vegetation.ndmi, number),
                  years: vegetation.baselineYears,
                  ndviAnomaly: optional(vegetation.ndviAnomaly, number),
                  ndmiAnomaly: optional(vegetation.ndmiAnomaly, number),
                  share: percentOf(vegetation.validShare),
                  pixels: vegetation.pixels,
                })}
              </dd>
            </>
          )}
        </dl>
      </ReportDetails>
    </div>
  );
}

function optional(value: number | null, format: (value: number, digits?: number) => string): string {
  return value === null ? '—' : format(value, 2);
}

function Fact({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4 print:break-inside-avoid">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1.5">
        <span className="text-lg font-semibold">{value}</span>
        {children && <span className="flex flex-col gap-1.5 text-sm text-muted-foreground">{children}</span>}
      </dd>
    </div>
  );
}

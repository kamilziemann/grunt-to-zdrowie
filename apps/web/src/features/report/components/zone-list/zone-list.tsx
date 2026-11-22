import type { WaterReport, Zone } from '@app/contracts';
import { useCallback, type ReactNode } from 'react';
import { useFormatter, useLocale, useTranslations } from 'use-intl';

import { APP_TIME_ZONE } from '@/lib/locale';
import { cn } from '@/lib/utils/cn';

import { fieldZones, type NumberedZone } from '../../utils/report-data';
import { orderedRecommendations } from '../../utils/report-summary';
import { ReportDetails } from '../report-section';
import { useZoneFocus } from '../zone-focus';

/** Opis miejsca: gotowe zdanie z serwera (po polsku) albo rodzaj i powierzchnia z tlumaczen. */
export function useZoneDescription(): (zone: Zone) => string {
  const t = useTranslations('report.zones');
  const tKinds = useTranslations('report.recommendations.zoneKinds');
  const format = useFormatter();
  const locale = useLocale();

  return (zone) =>
    locale === 'pl' && zone.description
      ? zone.description
      : t('fallback', {
          kind: tKinds(zone.kind),
          area: format.number(zone.areaHa, { maximumFractionDigits: zone.areaHa < 10 ? 1 : 0 }),
        });
}

/** Numer miejsca w kolku - jak na szkicu. */
export function ZoneNumber({
  number,
  active = false,
  large = false,
}: {
  number: number;
  active?: boolean;
  /** w kolumnie objasnien - wiekszy, jak na obrazie */
  large?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums',
        large ? 'mt-0.5 size-7 text-sm' : 'size-6 text-xs',
        active ? 'bg-(--sketch-highlight) text-card' : 'bg-foreground text-card',
      )}
    >
      {number}
    </span>
  );
}

/**
 * Przycisk miejsca na polu: najechanie albo fokus podglada miejsce na szkicu, klikniecie wybiera je i pokazuje szkic
 * (przewija), drugie klikniecie zdejmuje wybor (`aria-pressed`).
 */
export function ZoneButton({
  zoneId,
  className,
  children,
}: {
  zoneId: string;
  className?: string;
  children: ReactNode;
}) {
  const { preview, reveal, selected } = useZoneFocus();
  const show = useCallback(() => preview(zoneId), [preview, zoneId]);
  const hide = useCallback(() => preview(null), [preview]);
  const open = useCallback(() => reveal(zoneId), [reveal, zoneId]);

  return (
    <button
      type="button"
      aria-pressed={selected === zoneId}
      className={className}
      onClick={open}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      data-zone={zoneId}
    >
      {children}
    </button>
  );
}

/** Co zrobic w miejscu: nazwy zalecen, ktore go dotycza (w kolejnosci raportu), albo null. */
function useZoneActions(report: WaterReport): (zoneId: string) => string | null {
  const tMeasures = useTranslations('report.recommendations.measures');
  const format = useFormatter();
  const recommendations = orderedRecommendations(report);

  return (zoneId) => {
    const names = [
      ...new Set(
        recommendations
          .filter((recommendation) => recommendation.zoneId === zoneId)
          .map((recommendation) => tMeasures(`${recommendation.measure}.name`)),
      ),
    ];

    return names.length > 0 ? format.list(names.slice(0, 2), { type: 'conjunction' }) : null;
  };
}

/**
 * Miejsca na polu w kolumnie objasnien karty "Twoje pole": numer jak na obrazie, co tu jest, co z tym zrobic
 * (zalecenia, ktore dotycza miejsca) i udzial w polu; klikniecie wybiera miejsce na obrazie, drugie odznacza, fokus
 * albo najechanie podglada. Pod lista - skad sa miejsca i ze trzeba je obejrzec na polu. Bez miejsc - jedno zdanie
 * z powodem, bez pustej ramki.
 */
export function ZoneList({ report }: { report: WaterReport }) {
  const t = useTranslations('report.zones');
  const format = useFormatter();
  const describe = useZoneDescription();
  const actions = useZoneActions(report);
  const { active } = useZoneFocus();
  const zones = fieldZones(report);
  const map = report.zones;

  if (zones.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="text-base text-muted-foreground" data-testid="zone-list-empty">
          {t(`reason.${map?.reason ?? 'no_spatial_data'}`)}
        </p>
      </div>
    );
  }

  const day = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { dateStyle: 'long', timeZone: APP_TIME_ZONE });
  const imageText =
    map?.imageFrom && map.imageTo
      ? t('image', { from: day(map.imageFrom), to: day(map.imageTo) })
      : t('imageUnknown');
  const vegetation = map?.basis?.includes('vegetation') ?? false;

  return (
    <div className="flex flex-col gap-2" data-testid="zone-list">
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      <p className="text-base text-muted-foreground print:hidden">{t('hint')}</p>
      <ol className="flex flex-col gap-1" aria-label={t('title')}>
        {zones.map(({ zone, number }: NumberedZone) => {
          const action = actions(zone.id);

          return (
            <li key={zone.id}>
              <ZoneButton
                zoneId={zone.id}
                className={cn(
                  'flex min-h-12 w-full items-start gap-3 rounded-xl px-2 py-2 text-left text-base transition-colors duration-150 hover:bg-muted focus-visible:bg-muted aria-pressed:bg-muted aria-pressed:ring-2 aria-pressed:ring-(--sketch-highlight) print:min-h-0 print:px-0 print:py-0.5',
                  active === zone.id && 'bg-muted',
                )}
              >
                <ZoneNumber number={number} active={active === zone.id} large />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">
                    <span className="sr-only">{t('number', { number })} </span>
                    {describe(zone)}
                  </span>
                  <span data-testid="zone-action">{action ? t('action', { action }) : t('noAction')}</span>
                  {zone.share !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      {t('share', {
                        percent: format.number(zone.share, {
                          style: 'percent',
                          maximumFractionDigits: zone.share < 0.1 ? 1 : 0,
                        }),
                      })}
                    </span>
                  )}
                </span>
              </ZoneButton>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-muted-foreground" data-testid="zone-list-basis">
        {vegetation ? imageText : t('terrainOnly')} {t('verify')}
      </p>
    </div>
  );
}

/** Liczby miejsc dla doradcy w szczegolach (sekcja 4) - lista miejsc jest w karcie "Twoje pole" na gorze. */
export function ZoneMeasuresDetails({ report }: { report: WaterReport }) {
  const t = useTranslations('report.zones');
  const zones = fieldZones(report);

  if (zones.length === 0) return null;

  return (
    <ReportDetails summary={t('measuresTitle')}>
      <ZoneMeasures zones={zones} report={report} />
    </ReportDetails>
  );
}

/** Liczby stref dla doradcy: roznica wilgotnosci i zieleni roslin wzgledem pola, wysokosc, spadek, TWI, row. */
function ZoneMeasures({ zones, report }: { zones: readonly NumberedZone[]; report: WaterReport }) {
  const t = useTranslations('report.zones.measures');
  const format = useFormatter();
  const number = (value: number, digits: number) =>
    format.number(value, { maximumFractionDigits: digits, signDisplay: 'auto' });
  const signed = (value: number) =>
    format.number(value, { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const map = report.zones;

  return (
    <div className="flex flex-col gap-2" data-testid="zone-measures">
      {map && (
        <p>
          {t('grid', {
            size: number(map.cellSizeM, 0),
            cells: number(map.cells, 0),
            basis: format.list(
              (map.basis ?? []).map((item) => t(`basis.${item}`)),
              { type: 'conjunction' },
            ),
          })}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {zones.map(({ zone, number: zoneNumber }) => {
          const parts = [
            zone.ndmiDelta === undefined ? null : t('ndmi', { value: signed(zone.ndmiDelta) }),
            zone.ndviDelta === undefined ? null : t('ndvi', { value: signed(zone.ndviDelta) }),
            zone.elevationM === undefined ? null : t('elevation', { value: number(zone.elevationM, 1) }),
            zone.slopePct === undefined ? null : t('slope', { value: number(zone.slopePct, 1) }),
            zone.wetnessIndex === undefined ? null : t('twi', { value: number(zone.wetnessIndex, 1) }),
            zone.ditchDistanceM === undefined ? null : t('ditch', { value: number(zone.ditchDistanceM, 0) }),
            zone.volumeM3 === undefined ? null : t('volume', { value: number(zone.volumeM3, 0) }),
            zone.fromM === undefined || zone.toM === undefined
              ? null
              : t('segment', { from: number(zone.fromM, 0), to: number(zone.toM, 0) }),
          ].filter((part): part is string => part !== null);

          return (
            <li key={zone.id}>
              {t('item', { number: zoneNumber, measures: parts.join('; ') || t('none') })}
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground">{t('note')}</p>
    </div>
  );
}

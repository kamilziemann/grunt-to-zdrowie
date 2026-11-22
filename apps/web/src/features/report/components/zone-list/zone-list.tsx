import type { WaterReport, Zone } from '@app/contracts';
import { useCallback, type ReactNode } from 'react';
import { useFormatter, useLocale, useTranslations } from 'use-intl';

import { APP_TIME_ZONE } from '@/lib/locale';
import { cn } from '@/lib/utils/cn';

import { fieldZones, type NumberedZone } from '../../utils/report-data';
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
export function ZoneNumber({ number, active = false }: { number: number; active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
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

/**
 * Lista miejsc na polu pod szkicem: numer jak na rysunku, zdanie o miejscu i udzial w polu; fokus albo najechanie
 * wyroznia miejsce na szkicu. Pod lista - skad sa miejsca (jedno zdjecie satelitarne i model terenu ok. 30 m, wiec
 * warto je obejrzec na polu). Bez miejsc - jedno zdanie z powodem, bez pustej ramki.
 */
export function ZoneList({ report }: { report: WaterReport }) {
  const t = useTranslations('report.zones');
  const format = useFormatter();
  const tReport = useTranslations('report');
  const describe = useZoneDescription();
  const { active } = useZoneFocus();
  const zones = fieldZones(report);
  const map = report.zones;

  if (zones.length === 0) {
    return (
      <div className="flex max-w-xl flex-col gap-2">
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
    <div className="flex max-w-xl flex-col gap-2 print:break-inside-avoid" data-testid="zone-list">
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      <ol className="flex flex-col gap-1" aria-label={t('title')}>
        {zones.map(({ zone, number }: NumberedZone) => (
          <li key={zone.id}>
            <ZoneButton
              zoneId={zone.id}
              className={cn(
                'flex min-h-11 w-full items-start gap-3 rounded-md px-2 py-2 text-left text-base transition-colors hover:bg-muted focus-visible:bg-muted print:min-h-0 print:px-0 print:py-0.5',
                active === zone.id && 'bg-muted',
              )}
            >
              <ZoneNumber number={number} active={active === zone.id} />
              <span className="flex flex-col">
                <span>
                  <span className="sr-only">{t('number', { number })} </span>
                  {describe(zone)}
                </span>
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
        ))}
      </ol>
      <p className="text-sm text-muted-foreground" data-testid="zone-list-basis">
        {vegetation ? imageText : t('terrainOnly')} {t('verify')}
      </p>
      <ReportDetails summary={tReport('details')}>
        <ZoneMeasures zones={zones} report={report} />
      </ReportDetails>
    </div>
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

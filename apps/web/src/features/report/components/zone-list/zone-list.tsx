import type { WaterReport, Zone } from '@app/contracts';
import { TriangleAlert } from 'lucide-react';
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

/** Co zrobic w miejscu: zalecenia, ktore go dotycza (w kolejnosci raportu, najwyzej trzy) - nazwa i krotki opis. */
function useZoneActions(report: WaterReport): (zoneId: string) => { name: string; description: string }[] {
  const tMeasures = useTranslations('report.recommendations.measures');
  const recommendations = orderedRecommendations(report);

  return (zoneId) =>
    [
      ...new Set(
        recommendations
          .filter((recommendation) => recommendation.zoneId === zoneId)
          .map((recommendation) => recommendation.measure),
      ),
    ]
      .slice(0, 3)
      .map((measure) => ({
        name: tMeasures(`${measure}.name`),
        description: tMeasures(`${measure}.description`),
      }));
}

/** Row w poblizu miejsca - ten sam prog co w zdaniu serwera ("przy rowie"). */
const NEAR_DITCH_M = 50;
/** Rodzaje miejsc z wlasnym krotkim tytulem; pozostale (odcinek pola) biora tytul z opisu serwera. */
const TITLED_KINDS = new Set<Zone['kind']>(['drying', 'collecting', 'depression', 'flow_path', 'typical']);

/** Pierwsze zdanie opisu serwera (bez zdania ostroznosci dopisywanego po kropce). */
function firstSentence(text: string): string {
  return text.split(/(?<=\.)\s+(?=\p{Lu})/u)[0] ?? text;
}

/**
 * Krotki tytul karty miejsca ("Suchsze miejsce na wzniesieniu przy rowie") z pol strefy; dla odcinkow pola i w
 * jezyku innym niz polski - opis jak dotad. Zdanie ostroznosci serwera ("moze to byc inny uzytek") karta pokazuje
 * osobno, krotko.
 */
function useZoneCard(): (zone: Zone) => { title: string; caveat: boolean } {
  const t = useTranslations('report.zones.card');
  const describe = useZoneDescription();

  return (zone) => {
    const description = zone.description ?? '';
    const caveat = description.includes('inny użytek');

    if (!TITLED_KINDS.has(zone.kind)) return { title: firstSentence(describe(zone)), caveat };

    return {
      title: description.startsWith('Obniżenie na terenie odwadnianym')
        ? t('polder')
        : t('title', {
            kind: zone.kind,
            relief: zone.relief ?? 'flat',
            ditch: zone.ditchDistanceM !== undefined && zone.ditchDistanceM <= NEAR_DITCH_M ? 'yes' : 'no',
          }),
      caveat,
    };
  };
}

/**
 * Miejsca na polu jako karty w prawej kolumnie "Twoje pole": numer jak na obrazie, krotki tytul, gdzie i ile (strona
 * pola, hektary, udzial), zalecenia dla miejsca jako etykiety i - przy bardzo duzej roznicy wilgotnosci roslin -
 * ostrzezenie, ze to moze byc inny uzytek. Klikniecie wybiera miejsce na obrazie, drugie odznacza, fokus albo
 * najechanie podglada. Bez miejsc - jedno zdanie z powodem, bez pustej ramki.
 */
export function ZoneList({ report }: { report: WaterReport }) {
  const t = useTranslations('report.zones');
  const format = useFormatter();
  const card = useZoneCard();
  const actions = useZoneActions(report);
  const { active } = useZoneFocus();
  const zones = fieldZones(report);

  if (zones.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="text-base text-muted-foreground" data-testid="zone-list-empty">
          {t(`reason.${report.zones?.reason ?? 'no_spatial_data'}`)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 print:gap-1" data-testid="zone-list">
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      <p className="sr-only">{t('hint')}</p>
      <ol className="flex flex-col gap-3 print:gap-1" aria-label={t('title')}>
        {zones.map(({ zone, number }: NumberedZone) => {
          const [main, ...more] = actions(zone.id);
          // dlaczego to miejsce jest wyroznione - jedno zdanie, zeby sama nazwa zabiegu nie wisiala bez kontekstu
          const why = t(`card.why.${zone.kind}`, {
            volume:
              zone.volumeM3 === undefined ? '' : format.number(zone.volumeM3, { maximumFractionDigits: 0 }),
            hasVolume: zone.volumeM3 === undefined ? 'no' : 'yes',
          });
          const { title, caveat } = card(zone);
          const meta = [
            zone.position ? t(`card.positions.${zone.position}`) : null,
            t('card.area', {
              area: format.number(zone.areaHa, { maximumFractionDigits: zone.areaHa < 0.1 ? 2 : 1 }),
            }),
            zone.share === undefined
              ? null
              : t('share', {
                  percent: format.number(zone.share, {
                    style: 'percent',
                    maximumFractionDigits: zone.share < 0.1 ? 1 : 0,
                  }),
                }),
          ].filter((part): part is string => part !== null);

          return (
            <li key={zone.id}>
              <ZoneButton
                zoneId={zone.id}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border-2 border-border bg-card p-4 text-left text-base transition-colors duration-150 hover:bg-muted focus-visible:bg-muted aria-pressed:border-(--sketch-highlight) print:rounded-none print:border-0 print:p-0 print:py-0.5',
                  active === zone.id && 'bg-muted',
                )}
              >
                <ZoneNumber number={number} active={active === zone.id} large />
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-lg leading-snug font-semibold print:text-base">
                    <span className="sr-only">{t('number', { number })} </span>
                    {title}
                  </span>
                  <span className="text-muted-foreground">{meta.join(' · ')}</span>
                  <span className="text-base">{why}</span>
                  <span className="flex flex-col gap-1.5" data-testid="zone-action">
                    {main ? (
                      <>
                        <span className="text-base">
                          <span className="font-semibold">{t('card.actions')} </span>
                          <span className="font-semibold">{main.name}</span>
                          {' – '}
                          {main.description}
                        </span>
                        {more.length > 0 && (
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm text-muted-foreground">{t('card.also')}</span>
                            {more.map((item) => (
                              <span
                                key={item.name}
                                className="rounded-full border border-secondary-border bg-secondary px-2.5 py-0.5 text-sm font-medium text-secondary-foreground print:border-0 print:bg-transparent print:px-0"
                              >
                                {item.name}
                              </span>
                            ))}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t('card.noAction')}</span>
                    )}
                  </span>
                  {caveat && (
                    <span className="flex items-start gap-1.5 text-sm font-medium text-warning">
                      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      {t('card.caveat')}
                    </span>
                  )}
                </span>
              </ZoneButton>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Skad sa miejsca na polu i na ile im ufac - do zwinietego "Skad te dane" pod karta "Twoje pole": z jakiego zdjecia
 * i modelu terenu, ze to podpowiedz do obejrzenia na polu, i pelne zdanie o ostrzezeniu "inny uzytek".
 */
export function ZoneBasis({ report }: { report: WaterReport }) {
  const t = useTranslations('report.zones');
  const format = useFormatter();
  const zones = fieldZones(report);
  const map = report.zones;

  if (zones.length === 0) return null;

  const day = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { dateStyle: 'long', timeZone: APP_TIME_ZONE });
  const imageText =
    map?.imageFrom && map.imageTo
      ? t('image', { from: day(map.imageFrom), to: day(map.imageTo) })
      : t('imageUnknown');
  const vegetation = map?.basis?.includes('vegetation') ?? false;
  const caveat = zones.some(({ zone }) => zone.description?.includes('inny użytek'));

  return (
    <div className="flex flex-col gap-2" data-testid="zone-list-basis">
      <p>
        {vegetation ? imageText : t('terrainOnly')} {t('verify')}
      </p>
      {caveat && <p>{t('card.caveatLong')}</p>}
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

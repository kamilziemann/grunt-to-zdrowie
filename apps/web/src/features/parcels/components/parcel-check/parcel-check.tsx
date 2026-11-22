import { serializeParcelSelection, type Parcel, type ParcelGeometry } from '@app/contracts';
import { Map as MapIcon, PencilRuler, RotateCw, Scissors, TriangleAlert } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { geometryAreaHa, outerRing, ringBbox } from '@/lib/field-geometry';
import { Link } from '@/lib/navigation';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

import { useMapLabels } from '../../hooks/use-map-labels';
import { useMapLayers } from '../../hooks/use-map-layers';
import { useSelectedParcels, type SelectedParcel } from '../../hooks/use-selected-parcels';
import { nonFarmKinds } from '../../utils/land-use';
import { BasemapSwitch } from '../basemap-switch';
import { ParcelMap, type Basemap, type MapFocus, type MapPadding, type MapParcel } from '../parcel-map';
import { ParcelOutline } from '../parcel-outline';
import { useAreaFormatter } from '../parcel-preview';
import { StepsHeader } from '../steps-header';

export interface ParcelCheckProps {
  ids: readonly string[];
  /** wlasny obszar (czesc dzialki albo obrys) - analizowany zamiast calych dzialek */
  area?: { geometry: ParcelGeometry; kind: 'part' | 'drawn' } | null;
  /**
   * Formularz uprawy i dnia (feature "analysis") opakowujacy opis dzialki - dzieki temu przycisk "Analizuj" jest
   * przyklejony do dolu calego panelu od pierwszego ekranu. Wolany tylko, gdy jest co analizowac.
   */
  renderForm?: (summary: ReactNode) => ReactNode;
}

/** Te same miary co na mapie dzialek: panel 25 rem od `lg`, margines dojazdu 56 px. */
const DESKTOP_QUERY = '(min-width: 64rem)';
const PANEL_WIDTH_REM = 25;
const MAP_MARGIN_PX = 56;

/** Dojazd do dzialki: na komputerze lewa strona mapy jest pod panelem, wiec dzialka staje w odslonietej czesci. */
function checkMapPadding(): MapPadding {
  const base = { top: MAP_MARGIN_PX + 24, right: MAP_MARGIN_PX, bottom: MAP_MARGIN_PX, left: MAP_MARGIN_PX };

  if (typeof window === 'undefined' || !window.matchMedia(DESKTOP_QUERY).matches) {
    return { top: 64, right: 24, bottom: 24, left: 24 };
  }

  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  return { ...base, left: PANEL_WIDTH_REM * rem + MAP_MARGIN_PX };
}

function unionBbox(parcels: readonly Parcel[]): MapFocus['bbox'] | null {
  const [first, ...rest] = parcels;

  if (!first) return null;

  return rest.reduce<MapFocus['bbox']>(
    (box, parcel) => [
      Math.min(box[0], parcel.bbox[0]),
      Math.min(box[1], parcel.bbox[1]),
      Math.max(box[2], parcel.bbox[2]),
      Math.max(box[3], parcel.bbox[3]),
    ],
    first.bbox,
  );
}

/** Dzialki dalej od siebie niz tyle (km) to raczej osobne pola - jeden wynik usrednialby pogode i glebe. */
const FAR_APART_KM = 3;

/** Najwieksza odleglosc miedzy srodkami dzialek (km, przyblizenie rownoleznikowe - wystarczy do ostrzezenia). */
function spreadKm(parcels: readonly Parcel[]): number {
  let max = 0;

  for (const a of parcels) {
    for (const b of parcels) {
      const dLat = (a.centroid[1] - b.centroid[1]) * 111.32;
      const dLng = (a.centroid[0] - b.centroid[0]) * 111.32 * Math.cos((a.centroid[1] * Math.PI) / 180);

      max = Math.max(max, Math.hypot(dLat, dLng));
    }
  }

  return max;
}

/** Opis jednej dzialki: numer, obreb, gmina, powiat, powierzchnia i uzytek z ewidencji (gdy zrodlo go podaje). */
function ParcelFacts({ parcel }: { parcel: Parcel }) {
  const t = useTranslations('parcels.check');
  const formatArea = useAreaFormatter();
  const rows = [
    [t('region'), parcel.region],
    [t('commune'), parcel.commune],
    // etykieta juz mowi "Powiat" - zrodlo oddaje "powiat mogilenski"
    [t('county'), parcel.county.replace(/^powiat\s+/i, '')],
    [t('area'), t('areaValue', { area: formatArea(parcel.areaHa) })],
    [
      t('registryArea'),
      parcel.registryAreaHa ? t('areaValue', { area: formatArea(parcel.registryAreaHa) }) : '',
    ],
    [t('landUse'), parcel.landUse?.join(', ') ?? ''],
  ].filter(([, value]) => value !== '');

  return (
    <section
      aria-label={t('parcel', { number: parcel.number })}
      className="flex flex-col gap-3 rounded-xl border p-4"
      data-testid="parcel-facts"
    >
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-medium">{t('parcel', { number: parcel.number })}</span>
        <span className="text-sm break-all text-muted-foreground">{t('idLabel', { id: parcel.id })}</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        {t('areaNote')} {t('source', { source: parcel.source })}
      </p>
    </section>
  );
}

/** Dzialka, ktorej nie udalo sie wczytac: brak w ewidencji albo GUGiK nie odpowiada - zawsze z wyjsciem dalej. */
function ParcelProblem({ item }: { item: SelectedParcel }) {
  const t = useTranslations('parcels.check');
  const tCommon = useTranslations('common');
  const missing = item.state === 'missing';

  return (
    <section
      aria-labelledby={`problem-${item.id}`}
      className="flex flex-col gap-3 rounded-xl border border-warning/50 p-4"
      data-testid="parcel-problem"
    >
      <h2 id={`problem-${item.id}`} className="flex items-start gap-2 text-xl font-medium">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-warning" />
        {t(missing ? 'missingTitle' : 'failedTitle')}
      </h2>
      <p>{t(missing ? 'missingText' : 'failedText')}</p>
      <p className="text-sm break-all text-muted-foreground">{item.id}</p>
      <div className="flex flex-wrap gap-2">
        {missing ? (
          <Button asChild variant="accent">
            <Link href={routes.home()}>{t('fixNumber')}</Link>
          </Button>
        ) : (
          <Button variant="accent" onClick={item.retry}>
            <RotateCw aria-hidden="true" />
            {tCommon('tryAgain')}
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href={routes.map()}>
            <MapIcon aria-hidden="true" />
            {t('showMap')}
          </Link>
        </Button>
      </div>
    </section>
  );
}

/**
 * Krok "Czy to Twoja dzialka?" wg makiety A-sprawdz: ciemny panel z opisem dzialki, "To nie ta dzialka", pytanie
 * "Uprawiasz cala dzialke?" (czesc pokazuje sie na mapie) i formularz uprawy i dnia; obok mapa ze zdjeciem lotniczym
 * (na telefonie nad panelem). Panel przewija sie sam, przycisk "Analizuj dzialke" jest przyklejony do jego dolu.
 */
export function ParcelCheck({ ids, area = null, renderForm }: ParcelCheckProps) {
  const t = useTranslations('parcels.check');
  const formatArea = useAreaFormatter();
  const mapLabels = useMapLabels('static');
  const selected = useSelectedParcels(ids);
  // podklad wspolny z mapa dzialek, gdy uzytkownik go wybral; inaczej zdjecie lotnicze (latwiej poznac swoje pole)
  const { layers, update: updateLayers } = useMapLayers();
  const basemap: Basemap = layers.basemapChosen ? layers.basemap : 'ortho';
  const dzialki = serializeParcelSelection(ids);
  const single = ids.length === 1 ? selected.items[0] : undefined;
  const areaParcel = useMemo(
    (): MapParcel | null => (area ? { id: 'own-area', number: '', geometry: area.geometry } : null),
    [area],
  );
  const mapSelected = useMemo(
    () => (areaParcel ? [areaParcel] : selected.parcels),
    [areaParcel, selected.parcels],
  );
  const focus = useMemo((): MapFocus | null => {
    const ring = area ? outerRing(area.geometry) : null;

    // miekko: z mapy wchodzimy z tym samym kadrem (jesli widac w nim pole), z numeru - od razu na dzialce
    if (ring)
      return { bbox: ringBbox(ring), key: `area:${ring.length}:${ring[0]?.join(',') ?? ''}`, soft: true };

    const box = selected.settled ? unionBbox(selected.parcels) : null;

    return box ? { bbox: box, key: `check:${ids.join(',')}`, soft: true } : null;
  }, [area, ids, selected.parcels, selected.settled]);
  const outlineGeometries = useMemo(() => mapSelected.map((parcel) => parcel.geometry), [mapSelected]);
  const outline = useMemo(() => <ParcelOutline geometries={outlineGeometries} />, [outlineGeometries]);
  const nonFarm = single?.parcel && !area ? nonFarmKinds(single.parcel.landUse) : [];
  const farApartKm = !area && selected.parcels.length > 1 ? spreadKm(selected.parcels) : 0;
  const ready = area !== null || selected.parcels.length > 0;
  const splitHref = useMemo(() => routes.map({ dzialki, rysuj: 'podziel' }), [dzialki]);
  const changeAreaHref = useMemo(
    () => routes.map({ dzialki, rysuj: area?.kind === 'drawn' ? 'rysuj' : 'podziel' }),
    [dzialki, area?.kind],
  );
  const title = area ? t('titleArea') : ids.length > 1 ? t('titleMany') : t('title');

  const summary = (
    <div className="flex flex-col gap-6">
      <StepsHeader current="check" />
      <h1 className="text-3xl font-medium tracking-tight">{title}</h1>

      {area && (
        <section
          aria-labelledby="own-area-title"
          className="flex flex-col gap-3 rounded-xl border p-4"
          data-testid="own-area"
        >
          <h2 id="own-area-title" className="flex items-center gap-2 text-xl font-medium">
            <PencilRuler aria-hidden="true" className="size-5 shrink-0" />
            {t('areaCard.title', { area: formatArea(geometryAreaHa(area.geometry)) })}
          </h2>
          <p className="text-muted-foreground">
            {area.kind === 'part' && selected.parcels.length > 0
              ? t('areaCard.part', {
                  numbers: selected.parcels.map((parcel) => parcel.number).join(', '),
                })
              : t('areaCard.drawn')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={changeAreaHref}>{t('areaCard.change')}</Link>
            </Button>
            {ids.length > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href={routes.analysis(dzialki)}>{t('areaCard.whole')}</Link>
              </Button>
            )}
          </div>
        </section>
      )}

      {!area &&
        selected.items.map((item) =>
          item.parcel ? (
            <ParcelFacts key={item.id} parcel={item.parcel} />
          ) : item.state === 'loading' ? (
            <output key={item.id} aria-label={t('loading', { id: item.id })} className="flex flex-col gap-2">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </output>
          ) : (
            <ParcelProblem key={item.id} item={item} />
          ),
        )}

      {!area && ids.length > 1 && selected.parcels.length > 0 && (
        <p className="text-lg font-medium">{t('total', { area: formatArea(selected.totalAreaHa) })}</p>
      )}

      {nonFarm.length > 0 && (
        <section
          aria-labelledby="non-farm-title"
          className="flex flex-col gap-2 rounded-xl border border-warning/50 bg-warning/10 p-4"
          data-testid="non-farm"
        >
          <h2 id="non-farm-title" className="flex items-start gap-2 text-lg font-medium">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            {t('nonFarmTitle')}
          </h2>
          <p>{t('nonFarmText', { kinds: nonFarm.map((kind) => t(`landKinds.${kind}`)).join(', ') })}</p>
        </section>
      )}

      {farApartKm > FAR_APART_KM && (
        <section
          aria-labelledby="far-apart-title"
          className="flex flex-col gap-2 rounded-xl border border-warning/50 bg-warning/10 p-4"
          data-testid="far-apart"
        >
          <h2 id="far-apart-title" className="flex items-start gap-2 text-lg font-medium">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            {t('farApartTitle', { km: Math.round(farApartKm) })}
          </h2>
          <p>{t('farApartText')}</p>
        </section>
      )}

      {ready && !area && (
        // wroc na mape z ta sama lista - tam zmienisz, dodasz albo usuniesz dzialke
        <Button asChild variant="outline" size="lg">
          <Link href={routes.parcels(dzialki)}>{t('notThis')}</Link>
        </Button>
      )}

      {ready && !area && single && (
        <section aria-labelledby="whole-title" className="flex flex-col gap-3" data-testid="whole-parcel">
          <h2 id="whole-title" className="text-lg font-medium">
            {t('whole.question')}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <span
              aria-current="true"
              className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-primary bg-accent px-4 text-center font-semibold text-accent-foreground"
            >
              {t('whole.yes')}
            </span>
            <Link
              href={splitHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-input px-4 text-center font-medium hover:border-foreground"
            >
              <Scissors aria-hidden="true" className="size-5 shrink-0" />
              {t('whole.part')}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">{t('whole.partHint')}</p>
        </section>
      )}

      {ready && !area && (
        <Link
          href={routes.parcels(dzialki)}
          className={cn('inline-flex min-h-11 w-fit items-center font-medium underline underline-offset-4')}
        >
          {ids.length > 1 ? t('manyEdit') : t('whole.many')}
        </Link>
      )}
    </div>
  );

  if (ids.length === 0 && !area) {
    return (
      <div className="mx-auto w-full max-w-page px-gutter py-10">
        <EmptyState titleAs="h1" icon={MapIcon} title={t('emptyTitle')} description={t('emptyText')}>
          <Button asChild size="xl">
            <Link href={routes.home()}>{t('emptyHome')}</Link>
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link href={routes.map()}>{t('showMap')}</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  // Uklad jak na mapie dzialek (decyzja wlasciciela 2026-11-22: jeden styl obu krokow): komputer - mapa na calym
  // ekranie i bialy plywajacy panel po lewej; telefon - pasek mapy u gory i panel pod nim.
  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:block">
      <div className="relative h-[32dvh] shrink-0 lg:absolute lg:inset-0 lg:h-auto" data-testid="check-map">
        <ParcelMap
          selected={mapSelected}
          preview={areaParcel ? (selected.parcels[0] ?? null) : null}
          focus={focus}
          basemap={basemap}
          interactive={false}
          labels={mapLabels}
          placeholder={outline}
          getPadding={checkMapPadding}
          awaitFocus={!area && !selected.settled}
        />
        <BasemapSwitch
          value={basemap}
          onChange={updateLayers}
          className="absolute top-3 left-3 z-10 lg:left-106"
        />
        <p className="absolute bottom-3 left-106 z-10 max-w-80 rounded-lg border bg-card px-3 py-2 text-sm shadow-md max-lg:hidden">
          {t('mapNote')}
        </p>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card text-card-foreground max-lg:border-t lg:absolute lg:top-3 lg:bottom-3 lg:left-3 lg:z-10 lg:w-100 lg:rounded-xl lg:border lg:shadow-lg"
        data-testid="check-panel"
        // nowy adres = panel od gory (router.tsx), a nie przewiniecie z poprzedniej wizyty
        data-scroll-reset
      >
        <div className="px-4 pt-4 sm:px-5 lg:px-4">{ready && renderForm ? renderForm(summary) : summary}</div>
      </div>
    </div>
  );
}

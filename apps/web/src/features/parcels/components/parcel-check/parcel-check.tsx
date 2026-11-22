import { serializeParcelSelection, type Parcel, type ParcelGeometry } from '@app/contracts';
import { Map as MapIcon, PencilRuler, RotateCw, Scissors, TriangleAlert } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { geometryAreaHa, outerRing, ringBbox } from '@/lib/field-geometry';
import { Link } from '@/lib/navigation';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

import { useMapLabels } from '../../hooks/use-map-labels';
import { useSelectedParcels, type SelectedParcel } from '../../hooks/use-selected-parcels';
import { nonFarmKinds } from '../../utils/land-use';
import { ParcelMap, type Basemap, type MapFocus, type MapParcel } from '../parcel-map';
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

const BASEMAPS: readonly Basemap[] = ['ortho', 'map'];

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

/** Opis jednej dzialki: numer, obreb, gmina, powiat, powierzchnia i uzytek z ewidencji (gdy zrodlo go podaje). */
function ParcelFacts({ parcel }: { parcel: Parcel }) {
  const t = useTranslations('parcels.check');
  const formatArea = useAreaFormatter();
  const rows = [
    [t('region'), parcel.region],
    [t('commune'), parcel.commune],
    [t('county'), parcel.county],
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
  const [basemap, setBasemap] = useState<Basemap>('ortho');
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

    if (ring) return { bbox: ringBbox(ring), key: `area:${ring.length}:${ring[0]?.join(',') ?? ''}` };

    const box = selected.settled ? unionBbox(selected.parcels) : null;

    return box ? { bbox: box, key: `check:${ids.join(',')}` } : null;
  }, [area, ids, selected.parcels, selected.settled]);
  const outlineGeometries = useMemo(() => mapSelected.map((parcel) => parcel.geometry), [mapSelected]);
  const outline = useMemo(() => <ParcelOutline geometries={outlineGeometries} />, [outlineGeometries]);
  const chooseBasemap = useCallback((next: Basemap) => setBasemap(next), []);
  const nonFarm = single?.parcel && !area ? nonFarmKinds(single.parcel.landUse) : [];
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

      {ready && !area && (
        <Button asChild variant="outline" size="lg">
          <Link href={routes.home()}>{t('notThis')}</Link>
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
              className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-accent bg-accent px-4 text-center font-semibold text-accent-foreground"
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

  return (
    <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,31rem)_1fr]">
      <div className="relative h-[32dvh] shrink-0 md:order-2 md:h-full" data-testid="check-map">
        <ParcelMap
          selected={mapSelected}
          preview={areaParcel ? (selected.parcels[0] ?? null) : null}
          focus={focus}
          basemap={basemap}
          interactive={false}
          labels={mapLabels}
          placeholder={outline}
        />
        <fieldset className="absolute top-3 left-3 z-10 flex gap-1 rounded-full border border-input bg-card p-1 shadow-md">
          <legend className="sr-only">{t('basemap.label')}</legend>
          {BASEMAPS.map((option) => (
            <BasemapOption key={option} option={option} current={basemap} onChoose={chooseBasemap} />
          ))}
        </fieldset>
        <p className="absolute right-3 bottom-8 z-10 max-w-80 rounded-xl border bg-card px-3 py-2 text-sm max-md:hidden">
          {t('mapNote')}
        </p>
      </div>

      <div className="surface-panel relative min-h-0 flex-1 overflow-y-auto overscroll-contain md:order-1">
        <div className="px-5 pt-5 md:px-7 md:pt-7">{ready && renderForm ? renderForm(summary) : summary}</div>
      </div>
    </div>
  );
}

function BasemapOption({
  option,
  current,
  onChoose,
}: {
  option: Basemap;
  current: Basemap;
  onChoose: (option: Basemap) => void;
}) {
  const t = useTranslations('parcels.check.basemap');
  const choose = useCallback(() => onChoose(option), [onChoose, option]);
  const active = option === current;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={choose}
      className={cn(
        'h-11 rounded-full px-4 text-base transition-colors max-md:px-3 max-md:text-sm',
        active ? 'bg-primary font-medium text-primary-foreground' : 'hover:bg-muted',
      )}
    >
      {t(option)}
    </button>
  );
}

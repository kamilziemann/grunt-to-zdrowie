import type { FieldArea, HydroFeature, HydroTile } from '@app/contracts';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { PenLine, Satellite } from 'lucide-react';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { hydroTileQuery } from '@/features/parcels';
import { buildFieldSketch, SKETCH_RADIUS_M } from '@/lib/field-sketch';
import { hydroTiles, hydroWithin, latestImport, nearestHydro, type NearestHydro } from '@/lib/hydro-map';
import { APP_TIME_ZONE } from '@/lib/locale';
import { cn } from '@/lib/utils/cn';

import { FieldSketch, SketchLegend } from '../field-sketch';

/** Promien okolicy pola - ten sam, w ktorym silnik szuka rowow, wod i mokradel. */
const RADIUS_M = 500;
/** Najmniejszy zapas wokol pola na mapie: male pole nie moze byc kropka na zdjeciu. */
const MIN_MARGIN_M = 120;

// MapLibre (ok. 250 KB gzip) dopiero po kliknieciu: osobny chunk poza budzetem JS strony raportu
const FieldMapCanvas = lazy(() =>
  import('./field-map-canvas').then((module) => ({ default: module.FieldMapCanvas })),
);

/** Prostokat pola poszerzony o `marginM` metrow. */
function expand(
  [west, south, east, north]: FieldArea['bbox'],
  marginM: number,
): [number, number, number, number] {
  const dLat = marginM / 110_540;
  const dLng = marginM / (111_320 * Math.cos((((south + north) / 2) * Math.PI) / 180));

  return [west - dLng, south - dLat, east + dLng, north + dLat];
}

type HydroState = 'loading' | 'ready' | 'unavailable';

/** Stan kafli jednym obiektem; TanStack Query zwraca ten sam obiekt, dopoki wyniki sie nie zmienia. */
function combineTiles(results: UseQueryResult<HydroTile>[]): { state: HydroState; tiles: HydroTile[] } {
  const state: HydroState = results.some((result) => result.isError)
    ? 'unavailable'
    : results.every((result) => result.isSuccess)
      ? 'ready'
      : 'loading';

  return {
    state,
    tiles: state === 'ready' ? results.flatMap((result) => (result.data ? [result.data] : [])) : [],
  };
}

/** Numer dzialki z opisu pola ("349/1 · Gmina") - podpis na szkicu. */
function fieldNumber(label: string): string {
  return label.split(' · ')[0] ?? label;
}

export interface FieldMapProps {
  field: FieldArea;
  /** dlugosc rowow w polu z raportu (m) - szkic podaje te sama liczbe co przyczyny */
  ditchInFieldM?: number | null;
}

/**
 * "Woda wokol pola": domyslnie szkic w skali (SVG - pole, rowy, cieki, wody i mokradla w promieniu 250 m, wyrozniony
 * fakt, legenda, zrodla); ten szkic idzie na wydruk. Mapa na zdjeciu lotniczym (MapLibre, osobny chunk) laduje sie
 * dopiero po kliknieciu "Pokaz na zdjeciu lotniczym". Pod spodem zdania o najblizszym rowie i cieku w 500 m.
 */
export function FieldMap({ field, ditchInFieldM = null }: FieldMapProps) {
  const t = useTranslations('report.fieldMap');
  const format = useFormatter();
  const [aerial, setAerial] = useState(false);
  const [failed, setFailed] = useState(false);
  const search = useMemo(() => expand(field.bbox, RADIUS_M), [field.bbox]);
  const tiles = useMemo(() => hydroTiles(...search), [search]);
  const { state, tiles: loaded } = useQueries({
    queries: tiles.map((tile) => hydroTileQuery(tile.x, tile.y)),
    combine: combineTiles,
  });
  const hydro = useMemo(() => summarize(field, loaded), [field, loaded]);
  const sketch = useMemo(
    () => buildFieldSketch(field.geometry, field.centroid, hydro.features, { ditchInFieldM }),
    [field, hydro, ditchInFieldM],
  );
  const fail = useCallback(() => setFailed(true), []);
  const toggleAerial = useCallback(() => setAerial((value) => !value), []);
  const fallback = useMemo(() => <MapPlaceholder text={t('loading')} />, [t]);
  const view = useMemo(() => {
    const reach = hydro.nearest.ditch?.distanceM ?? hydro.nearest.watercourse?.distanceM ?? 0;

    return expand(field.bbox, Math.min(RADIUS_M, Math.max(MIN_MARGIN_M, reach + 60)));
  }, [field.bbox, hydro]);
  const importedAt = latestImport(loaded);
  const meters = (value: number) => format.number(Math.round(value), { maximumFractionDigits: 0 });
  const distance = (item: NearestHydro) =>
    item.distanceM < 1 ? t('touches') : t('distance', { meters: meters(item.distanceM) });
  const fieldName = t(`sketch.field.${field.kind}`, { number: fieldNumber(field.label) });
  const fact = sketch.fact;
  // zdanie faktu na szkicu: row przez pole albo najblizszy row lub ciek
  const factText = !fact
    ? null
    : fact.kind === 'ditch_through'
      ? fact.alongEdge
        ? t('sketch.ditchAlongEdge', { meters: meters(fact.lengthM) })
        : t('sketch.ditchThrough', { meters: meters(fact.lengthM) })
      : fact.kind === 'nearest_ditch'
        ? t('sketch.nearestDitch', { meters: meters(fact.distanceM) })
        : fact.name
          ? t('sketch.nearestNamed', { name: fact.name, meters: meters(fact.distanceM) })
          : t('sketch.nearestWatercourse', { meters: meters(fact.distanceM) });
  const date = importedAt
    ? format.dateTime(new Date(importedAt), { dateStyle: 'medium', timeZone: APP_TIME_ZONE })
    : null;

  return (
    <figure
      className="flex flex-col gap-3 print:break-inside-avoid"
      data-testid="field-map"
      data-hydro={state}
    >
      <div className={cn('flex max-w-xl flex-col gap-3', aerial && 'hidden print:flex')}>
        <div className="w-full max-w-xl overflow-hidden rounded-lg border">
          <FieldSketch
            model={sketch}
            fieldName={fieldName}
            factText={state === 'ready' ? factText : null}
            label={[t('sketch.label', { field: fieldName, radius: SKETCH_RADIUS_M }), factText]
              .filter(Boolean)
              .join(' ')}
          />
        </div>
        <SketchLegend model={sketch} />
      </div>
      {aerial && (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted sm:aspect-[16/9] print:hidden">
          {failed ? (
            <MapPlaceholder text={t('failed')} />
          ) : (
            <Suspense fallback={fallback}>
              <FieldMapCanvas
                field={field.geometry}
                bbox={view}
                features={hydro.features}
                nearest={hydro.highlighted}
                onFailed={fail}
              />
            </Suspense>
          )}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className="self-start print:hidden"
        onClick={toggleAerial}
        data-testid="field-map-toggle"
      >
        {aerial ? <PenLine aria-hidden="true" /> : <Satellite aria-hidden="true" />}
        {aerial ? t('showSketch') : t('showAerial')}
      </Button>
      <figcaption className="flex flex-col gap-1 text-sm">
        {state === 'loading' && <span className="text-muted-foreground">{t('sketch.loading')}</span>}
        {state === 'ready' && (
          <span className="flex flex-col gap-0.5" data-testid="field-map-nearest">
            <span>
              {aerial && hydro.nearest.ditch && <Swatch />}
              {hydro.nearest.ditch
                ? t('nearestDitch', { distance: distance(hydro.nearest.ditch) })
                : t('noDitch', { radius: RADIUS_M })}
            </span>
            <span>
              {aerial && (hydro.nearest.named ?? hydro.nearest.watercourse) && <Swatch />}
              {hydro.nearest.named
                ? t('nearestNamed', {
                    name: hydro.nearest.named.feature.name ?? '',
                    kind: t(`kinds.${hydro.nearest.named.feature.kind}`),
                    distance: distance(hydro.nearest.named),
                  })
                : hydro.nearest.watercourse
                  ? t('nearestWatercourse', {
                      kind: t(`kinds.${hydro.nearest.watercourse.feature.kind}`),
                      distance: distance(hydro.nearest.watercourse),
                    })
                  : t('noWatercourse', { radius: RADIUS_M })}
            </span>
            {sketch.groups.length === 0 && <span>{t('sketch.noWater', { radius: SKETCH_RADIUS_M })}</span>}
          </span>
        )}
        {state === 'unavailable' && <span>{t('sketch.unavailable')}</span>}
        <span className="text-muted-foreground">
          {aerial ? (
            <>
              {date ? t('sourcesDated', { date }) : t('sources')}
              {hydro.highlighted.length > 0 ? ` ${t('highlight')}` : ''}
            </>
          ) : date ? (
            t('sketch.sourcesDated', { date, radius: SKETCH_RADIUS_M })
          ) : (
            t('sketch.sources', { radius: SKETCH_RADIUS_M })
          )}
        </span>
      </figcaption>
    </figure>
  );
}

function summarize(field: FieldArea, tiles: readonly { features: readonly HydroFeature[] }[]) {
  const features = hydroWithin(
    field.geometry,
    tiles.flatMap((tile) => tile.features),
    RADIUS_M,
  );
  const nearest = nearestHydro(field.geometry, features, RADIUS_M);
  const highlighted = [nearest.ditch, nearest.named ?? nearest.watercourse].flatMap((item) =>
    item ? [item.feature] : [],
  );

  return { features, nearest, highlighted };
}

function Swatch() {
  return (
    <span
      aria-hidden="true"
      className="mr-2 inline-block h-1 w-4 rounded-full bg-(--map-highlight) align-middle"
    />
  );
}

function MapPlaceholder({ text }: { text: string }) {
  return (
    <output className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground print:hidden">
      {text}
    </output>
  );
}

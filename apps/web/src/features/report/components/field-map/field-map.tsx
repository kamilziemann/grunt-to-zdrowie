import type { FieldArea, HydroFeature, HydroTile } from '@app/contracts';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { hydroTileQuery } from '@/features/parcels';
import { hydroTiles, hydroWithin, latestImport, nearestHydro, type NearestHydro } from '@/lib/hydro-map';
import { APP_TIME_ZONE } from '@/lib/locale';
import { cn } from '@/lib/utils/cn';

/** Promien okolicy pola - ten sam, w ktorym silnik szuka rowow, wod i mokradel. */
const RADIUS_M = 500;
/** Najmniejszy zapas wokol pola na mapie: male pole nie moze byc kropka na zdjeciu. */
const MIN_MARGIN_M = 120;

// MapLibre (ok. 250 KB gzip) tylko na zadanie: osobny chunk poza budzetem JS strony raportu
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

/** Mapa laduje sie, gdy przegladarka ma chwile (wydruk zwykle przychodzi pozniej), a nie od razu z raportem. */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    // Safari nie ma requestIdleCallback - wtedy krotkie opoznienie
    if (typeof window.requestIdleCallback !== 'function') {
      const timer = setTimeout(() => setIdle(true), 300);

      return () => clearTimeout(timer);
    }

    const id = window.requestIdleCallback(() => setIdle(true), { timeout: 2000 });

    return () => window.cancelIdleCallback(id);
  }, []);

  return idle;
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

/**
 * Mapa pola w raporcie: obrys na zdjeciu lotniczym, rowy i cieki w promieniu 500 m (BDOT10k), najblizszy row i ciek
 * wyroznione, pod spodem zdanie z nazwa i odlegloscia oraz zrodla. Plotno MapLibre laduje sie leniwie; na wydruku
 * zastepuje je obraz. Gdy warstwa hydrografii nie odpowiada - sam obrys pola i spokojna informacja.
 */
export function FieldMap({ field }: { field: FieldArea }) {
  const t = useTranslations('report.fieldMap');
  const format = useFormatter();
  const idle = useIdle();
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const search = useMemo(() => expand(field.bbox, RADIUS_M), [field.bbox]);
  const tiles = useMemo(() => hydroTiles(...search), [search]);
  const { state, tiles: loaded } = useQueries({
    queries: tiles.map((tile) => hydroTileQuery(tile.x, tile.y)),
    combine: combineTiles,
  });
  const hydro = useMemo(() => summarize(field, loaded), [field, loaded]);
  const fail = useCallback(() => setFailed(true), []);
  const fallback = useMemo(() => <MapPlaceholder text={t('loading')} />, [t]);
  const view = useMemo(() => {
    const reach = hydro.nearest.ditch?.distanceM ?? hydro.nearest.watercourse?.distanceM ?? 0;

    return expand(field.bbox, Math.min(RADIUS_M, Math.max(MIN_MARGIN_M, reach + 60)));
  }, [field.bbox, hydro]);
  const importedAt = latestImport(loaded);
  const meters = (value: number) => format.number(Math.round(value), { maximumFractionDigits: 0 });
  const distance = (item: NearestHydro) =>
    item.distanceM < 1 ? t('touches') : t('distance', { meters: meters(item.distanceM) });

  return (
    <figure
      className="flex flex-col gap-2 print:break-inside-avoid"
      data-testid="field-map"
      data-hydro={state}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted sm:aspect-[16/9] print:aspect-[16/9]">
        {idle && !failed ? (
          <Suspense fallback={fallback}>
            <div className={cn('size-full', snapshot && 'print:hidden')}>
              <FieldMapCanvas
                field={field.geometry}
                bbox={view}
                features={hydro.features}
                nearest={hydro.highlighted}
                onSnapshot={setSnapshot}
                onFailed={fail}
              />
            </div>
          </Suspense>
        ) : (
          <MapPlaceholder text={failed ? t('failed') : t('loading')} />
        )}
        {snapshot && (
          <img
            src={snapshot}
            alt=""
            aria-hidden="true"
            className="hidden size-full object-cover print:block"
          />
        )}
      </div>
      <figcaption className="flex flex-col gap-1 text-sm">
        <span className="sr-only">{t('label', { field: field.label })}</span>
        {state === 'ready' && (
          <span className="flex flex-col gap-0.5" data-testid="field-map-nearest">
            <span>
              {hydro.nearest.ditch && <Swatch />}
              {hydro.nearest.ditch
                ? t('nearestDitch', { distance: distance(hydro.nearest.ditch) })
                : t('noDitch', { radius: RADIUS_M })}
            </span>
            <span>
              {(hydro.nearest.named ?? hydro.nearest.watercourse) && <Swatch />}
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
          </span>
        )}
        {state === 'unavailable' && <span>{t('unavailable')}</span>}
        <span className="text-muted-foreground">
          {importedAt
            ? t('sourcesDated', {
                date: format.dateTime(new Date(importedAt), { dateStyle: 'medium', timeZone: APP_TIME_ZONE }),
              })
            : t('sources')}
          {hydro.highlighted.length > 0 ? ` ${t('highlight')}` : ''}
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

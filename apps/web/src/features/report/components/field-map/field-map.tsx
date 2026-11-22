import type { ContextFeature, ContextTile, FieldArea, HydroFeature, HydroTile } from '@app/contracts';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { PenLine, Satellite, ZoomIn, ZoomOut } from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { hydroTileQuery } from '@/features/parcels';
import { buildFieldSketch, fetchContextTile, SKETCH_RADIUS_M } from '@/lib/field-sketch';
import {
  hydroTiles,
  hydroWithin,
  latestImport,
  namedWaterLabel,
  nearestHydro,
  type NearestHydro,
} from '@/lib/hydro-map';
import { APP_TIME_ZONE } from '@/lib/locale';
import { cn } from '@/lib/utils/cn';

import type { NumberedZone } from '../../utils/report-data';
import { FieldSketch, SketchLegend, ZoneKindLegend } from '../field-sketch';
import { useZoneFocus } from '../zone-focus';
import type { FieldMapLayers } from './field-map-canvas';

/** Promien okolicy pola - ten sam, w ktorym silnik szuka rowow, wod i mokradel. */
const RADIUS_M = 500;
/** Najmniejszy zapas wokol pola na mapie: male pole nie moze byc kropka na zdjeciu. */
const MIN_MARGIN_M = 120;

// MapLibre (ok. 250 KB gzip) dopiero po wyborze zdjecia lotniczego: osobny chunk poza budzetem JS strony raportu
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
type MapMode = 'sketch' | 'aerial';

/** Zapamietany wybor "Szkic / Zdjecie lotnicze" (ten sam dla kazdego raportu w tej przegladarce). */
const MODE_STORAGE_KEY = 'gtz-field-map-mode';

/**
 * Wybor widoku jako maly magazyn dla `useSyncExternalStore`: na serwerze i przy hydratacji zawsze szkic (ten sam
 * HTML dla kazdego), potem wartosc z `localStorage`; bez dostepu do pamieci wybor zyje do przeladowania strony.
 */
let modeMemory: MapMode | null = null;
const modeListeners = new Set<() => void>();

function subscribeMode(listener: () => void) {
  modeListeners.add(listener);

  return () => {
    modeListeners.delete(listener);
  };
}

function readMode(): MapMode {
  try {
    const value = window.localStorage.getItem(MODE_STORAGE_KEY);

    if (value === 'aerial' || value === 'sketch') return value;
  } catch {
    // tryb prywatny albo zablokowana pamiec - zostaje wybor z tej wizyty
  }

  return modeMemory ?? 'sketch';
}

function serverMode(): MapMode {
  return 'sketch';
}

function chooseMode(mode: MapMode) {
  modeMemory = mode;

  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // jak wyzej - przelacznik dziala dalej, tylko bez zapamietania
  }

  for (const listener of modeListeners) listener();
}

const ALL_LAYERS: FieldMapLayers = { photo: true, water: true, zones: true };

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

const CONTEXT_LAYERS = ['cover', 'waterworks'] as const;
const NO_CONTEXT: readonly ContextFeature[] = [];

/** Otoczenie pola z kafli, ktore juz przyszly; blad albo brak bazy = szkic bez tej warstwy (to tylko tlo). */
function combineContext(results: UseQueryResult<ContextTile>[]): readonly ContextFeature[] {
  const features = results.flatMap((result) => result.data?.features ?? []);

  return features.length > 0 ? features : NO_CONTEXT;
}

/** Numer dzialki z opisu pola ("349/1 · Gmina") - podpis na szkicu. */
function fieldNumber(label: string): string {
  return label.split(' · ')[0] ?? label;
}

export interface FieldMapProps {
  field: FieldArea;
  /** dlugosc rowow w polu z raportu (m) - szkic podaje te sama liczbe co przyczyny */
  ditchInFieldM?: number | null;
  /** miejsca na polu z numerami (strefy inne niz tlo) - na szkicu wzorem, na zdjeciu lotniczym obrysem */
  zones?: readonly NumberedZone[];
  /** szkic na cala szerokosc kontenera (raport: mapa obok krotkiej analizy) zamiast do 36 rem */
  wide?: boolean;
}

const NO_ZONES: readonly NumberedZone[] = [];
/** Zapas wokol pola na zdjeciu, gdy sa miejsca na polu: pole wypelnia mape, a numery i wzory sa czytelne. */
const ZONES_MARGIN_M = 40;
/** Ile poziomow przyblizenia ponad kadr calego pola (kazdy 2x). */
const MAX_ZOOM_STEP = 3;
/** Okolica szkicu pola z miejscami: blizej, zeby miejsca byly czytelne (rowy i cieki w 500 m opisuja zdania nizej). */
const ZONES_RADIUS_M = 100;

/**
 * "Woda wokol pola": szkic w skali (SVG - pole, rowy, cieki, wody i mokradla w promieniu 250 m, 100 m gdy sa miejsca
 * na polu; wyrozniony fakt, legenda, zrodla) albo mapa na zdjeciu lotniczym (MapLibre, osobny chunk ladowany dopiero
 * po wyborze). Wybor dwiema pigulkami "Szkic / Zdjecie lotnicze", zapamietany w przegladarce. Na mapie warstwy
 * "Zdjecie lotnicze", "Rowy i cieki" i "Miejsca na polu" (te same wzory i numery co na szkicu, wlaczone od razu);
 * klikniecie miejsca na szkicu albo mapie wyroznia jego zalecenia, drugie klikniecie, Escape albo klikniecie w tlo
 * zdejmuje wyroznienie. Na wydruk idzie zawsze szkic. Pod spodem zdania o najblizszym rowie i cieku w 500 m.
 */
export function FieldMap({ field, ditchInFieldM = null, zones = NO_ZONES, wide = false }: FieldMapProps) {
  const t = useTranslations('report.fieldMap');
  const format = useFormatter();
  const tLayers = useTranslations('report.fieldMap.layers');
  const mode = useSyncExternalStore(subscribeMode, readMode, serverMode);
  const [layers, setLayers] = useState<FieldMapLayers>(ALL_LAYERS);
  const [failed, setFailed] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const zoomIn = useCallback(() => setZoomStep((value) => Math.min(MAX_ZOOM_STEP, value + 1)), []);
  const zoomOut = useCallback(() => setZoomStep((value) => Math.max(0, value - 1)), []);
  const aerial = mode === 'aerial';

  const search = useMemo(() => expand(field.bbox, RADIUS_M), [field.bbox]);
  const tiles = useMemo(() => hydroTiles(...search), [search]);
  const { state, tiles: loaded } = useQueries({
    queries: tiles.map((tile) => hydroTileQuery(tile.x, tile.y)),
    combine: combineTiles,
  });
  const hydro = useMemo(() => summarize(field, loaded), [field, loaded]);
  const zoneShapes = useMemo(() => zones.map((item) => item.zone), [zones]);
  const zoneMarks = useMemo(
    () => zones.map(({ zone, number }) => ({ id: zone.id, kind: zone.kind, number })),
    [zones],
  );
  const radius = zoneShapes.length > 0 ? ZONES_RADIUS_M : SKETCH_RADIUS_M;
  // kafle otoczenia tylko w zasiegu szkicu (z zapasem na proporcje rysunku)
  const contextTiles = useMemo(() => hydroTiles(...expand(field.bbox, radius * 1.6)), [field.bbox, radius]);
  const context = useQueries({
    queries: contextTiles.flatMap((tile) =>
      CONTEXT_LAYERS.map((layer) => ({
        queryKey: ['context-tile', layer, tile.x, tile.y] as const,
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchContextTile(layer, tile.x, tile.y, signal),
        staleTime: Infinity,
        retry: false,
      })),
    ),
    combine: combineContext,
  });
  const zoneKinds = useMemo(() => zoneMarks.map((zone) => zone.kind), [zoneMarks]);
  const sketch = useMemo(
    () =>
      buildFieldSketch(field.geometry, field.centroid, hydro.features, {
        ditchInFieldM,
        zones: zoneShapes,
        radiusM: radius,
        context,
      }),
    [field, hydro, ditchInFieldM, zoneShapes, radius, context],
  );
  const { active, selected, toggle, clear, sketchRef } = useZoneFocus();
  const fail = useCallback(() => setFailed(true), []);
  const showSketch = useCallback(() => chooseMode('sketch'), []);
  const showAerial = useCallback(() => chooseMode('aerial'), []);
  const switchLayer = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const key = event.currentTarget.name;
    const on = event.currentTarget.checked;

    if (key === 'photo' || key === 'water' || key === 'zones')
      setLayers((value) => ({ ...value, [key]: on }));
  }, []);
  const fallback = useMemo(() => <MapPlaceholder text={t('loading')} />, [t]);
  const hasZones = zoneMarks.length > 0;
  // z miejscami na polu kadr ciasno na pole (miejsca maja po kilkadziesiat metrow), bez nich - do najblizszego rowu
  const view = useMemo(() => {
    const reach = hydro.nearest.ditch?.distanceM ?? hydro.nearest.watercourse?.distanceM ?? 0;

    return expand(
      field.bbox,
      hasZones ? ZONES_MARGIN_M : Math.min(RADIUS_M, Math.max(MIN_MARGIN_M, reach + 60)),
    );
  }, [field.bbox, hydro, hasZones]);
  const importedAt = latestImport(loaded);
  const meters = (value: number) => format.number(Math.round(value), { maximumFractionDigits: 0 });
  const distance = (item: NearestHydro) =>
    item.distanceM < 1 ? t('touches') : t('distance', { meters: meters(item.distanceM) });
  const fieldName = t(`sketch.field.${field.kind}`, { number: fieldNumber(field.label) });
  const fact = sketch.fact;
  // jedna tabliczka na wszystkie rowy w polu: przy kilku liczba rowow i laczna dlugosc
  const ditchText = (count: number, alongEdge: boolean, length: string) =>
    count > 1
      ? t(alongEdge ? 'sketch.ditchesAlongEdge' : 'sketch.ditchesThrough', { count, meters: length })
      : t(alongEdge ? 'sketch.ditchAlongEdge' : 'sketch.ditchThrough', { meters: length });
  // zdanie faktu na szkicu: row przez pole albo najblizszy row lub ciek
  const factText = !fact
    ? null
    : fact.kind === 'ditch_through'
      ? ditchText(fact.ditches, fact.alongEdge, meters(fact.lengthM))
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
      ref={sketchRef}
      className="flex scroll-mt-4 flex-col gap-3 print:break-inside-avoid"
      data-testid="field-map"
      data-hydro={state}
      data-mode={mode}
    >
      <fieldset
        className={cn('grid grid-cols-2 gap-1 rounded-full bg-muted p-1 print:hidden', !wide && 'max-w-xl')}
        data-testid="field-map-mode"
      >
        <legend className="sr-only">{t('modeLabel')}</legend>
        <ModeButton pressed={!aerial} onClick={showSketch} icon="sketch" label={t('showSketch')} />
        <ModeButton pressed={aerial} onClick={showAerial} icon="aerial" label={t('showAerial')} />
      </fieldset>
      <div className={cn('flex flex-col gap-3', !wide && 'max-w-xl', aerial && 'hidden print:flex')}>
        <div className={cn('w-full overflow-hidden rounded-lg border', !wide && 'max-w-xl')}>
          <FieldSketch
            model={sketch}
            fieldName={fieldName}
            factText={state === 'ready' ? factText : null}
            label={[t('sketch.label', { field: fieldName, radius }), factText].filter(Boolean).join(' ')}
            zones={zoneMarks}
            activeZone={active}
            selectedZone={selected}
            onZoneSelect={toggle}
            onBackgroundSelect={clear}
          />
        </div>
        <SketchLegend model={sketch} zoneKinds={zoneKinds} />
      </div>
      {aerial && (
        <div className="flex flex-col gap-3 print:hidden">
          <fieldset className="flex flex-wrap gap-2" data-testid="field-map-layers">
            <legend className="sr-only">{tLayers('label')}</legend>
            <LayerSwitch
              name="photo"
              checked={layers.photo}
              onChange={switchLayer}
              label={tLayers('photo')}
            />
            <LayerSwitch
              name="water"
              checked={layers.water}
              onChange={switchLayer}
              label={tLayers('water')}
            />
            {hasZones && (
              <LayerSwitch
                name="zones"
                checked={layers.zones}
                onChange={switchLayer}
                label={tLayers('zones')}
              />
            )}
          </fieldset>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted sm:aspect-[16/9]">
            {failed ? (
              <MapPlaceholder text={t('failed')} />
            ) : (
              <Suspense fallback={fallback}>
                <FieldMapCanvas
                  field={field.geometry}
                  bbox={view}
                  features={hydro.features}
                  nearest={hydro.highlighted}
                  zones={zoneMarks}
                  zoneShapes={zoneShapes}
                  activeZone={active}
                  layers={layers}
                  zoomStep={zoomStep}
                  onZoneToggle={toggle}
                  onZoneClear={clear}
                  onFailed={fail}
                />
              </Suspense>
            )}
          </div>
          {!failed && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={zoomIn}
                disabled={zoomStep >= MAX_ZOOM_STEP}
              >
                <ZoomIn aria-hidden="true" />
                {t('zoomIn')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={zoomOut} disabled={zoomStep === 0}>
                <ZoomOut aria-hidden="true" />
                {t('zoomOut')}
              </Button>
            </div>
          )}
          {layers.zones && <ZoneKindLegend kinds={zoneKinds} />}
          {hasZones && layers.zones && (
            <p className="text-sm text-muted-foreground">{tLayers('zonesHint')}</p>
          )}
        </div>
      )}
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
                    label: namedWaterLabel(
                      t(`kinds.${hydro.nearest.named.feature.kind}`),
                      hydro.nearest.named.feature.name ?? '',
                    ),
                    distance: distance(hydro.nearest.named),
                  })
                : hydro.nearest.watercourse
                  ? t('nearestWatercourse', {
                      kind: t(`kinds.${hydro.nearest.watercourse.feature.kind}`),
                      distance: distance(hydro.nearest.watercourse),
                    })
                  : t('noWatercourse', { radius: RADIUS_M })}
            </span>
            {sketch.groups.length === 0 && <span>{t('sketch.noWater', { radius })}</span>}
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
            t('sketch.sourcesDated', { date, radius })
          ) : (
            t('sketch.sources', { radius })
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

function ModeButton({
  pressed,
  onClick,
  icon,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  icon: 'sketch' | 'aerial';
  label: string;
}) {
  const Icon = icon === 'sketch' ? PenLine : Satellite;

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex min-h-12 items-center justify-center gap-2 rounded-full px-3 text-base font-semibold whitespace-nowrap sm:px-4 transition-colors duration-150',
        pressed ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
      data-testid={`field-map-mode-${icon}`}
    >
      <Icon aria-hidden="true" className="hidden size-5 shrink-0 sm:block" />
      {label}
    </button>
  );
}

/** Przelacznik warstwy mapy: pigulka z polem wyboru (dziala klawiatura, czytnik slyszy stan). */
function LayerSwitch({
  name,
  checked,
  onChange,
  label,
}: {
  name: keyof FieldMapLayers;
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  label: string;
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-3 text-sm font-medium transition-colors duration-150 has-focus-visible:ring-3 has-focus-visible:ring-ring',
        checked
          ? 'border-secondary-border bg-secondary text-secondary-foreground'
          : 'border-input text-muted-foreground',
      )}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-4 accent-current"
        data-testid={`field-map-layer-${name}`}
      />
      {label}
    </label>
  );
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

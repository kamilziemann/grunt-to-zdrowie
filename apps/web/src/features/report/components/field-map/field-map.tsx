import type { ContextFeature, ContextTile, FieldArea, HydroFeature, HydroTile } from '@app/contracts';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { Droplets, PenLine, Plane, Sprout, ZoomIn, ZoomOut, type LucideIcon } from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
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
import { chooseFieldMode, FIELD_MODES, useFieldMode, type FieldMode } from './field-mode';
import { SatelliteImage, SatelliteNotes, useSatelliteLayer } from './field-satellite';

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
  /** miejsca na polu z numerami (strefy inne niz tlo) - na szkicu wzorem, na zdjeciach obrysem i numerem */
  zones?: readonly NumberedZone[];
  /** dzialki do obrazu z satelity (posortowane, po przecinku); null = wlasny obrys bez dzialek */
  imageryParcels?: string | null;
  /** dzien analizy - obraz z satelity z najczystszego zdjecia z 30 dni przed nim */
  imageryDate?: string;
  /** lista miejsc na polu w kolumnie objasnien (pod objasnieniami obrazu satelitarnego) */
  children?: ReactNode;
}

const NO_ZONES: readonly NumberedZone[] = [];
/** Kotwica dawnego bloku "Pole z satelity" - teraz karta z trybami satelitarnymi. */
const SATELLITE_ANCHOR = 'satelita';
/** Zapas wokol pola na zdjeciu, gdy sa miejsca na polu: pole wypelnia mape, a numery i wzory sa czytelne. */
const ZONES_MARGIN_M = 40;
/** Ile poziomow przyblizenia ponad kadr calego pola (kazdy 2x). */
const MAX_ZOOM_STEP = 3;
/** Okolica szkicu pola z miejscami: blizej, zeby miejsca byly czytelne (rowy i cieki w 500 m opisuja zdania nizej). */
const ZONES_RADIUS_M = 100;

/**
 * Karta "Twoje pole" na cala szerokosc: po lewej duzy obraz pola, po prawej kolumna objasnien. Tryb obrazu wybieraja
 * cztery pigulki (wybor zapamietany w przegladarce): "Szkic" (domyslny - "Woda na polu i wokol niego" w skali, SVG:
 * pole, rowy, cieki, wody i otoczenie, miejsca na polu wzorem), "Zdjecie lotnicze" (MapLibre, osobny chunk ladowany
 * dopiero po wyborze; warstwy, przyblizenie), "Kondycja roslin" i "Woda w roslinach" (obraz z satelity z dnia
 * analizy, pobierany dopiero po wyborze). Kolumna objasnien: przy satelicie skala slowami, data i zastrzezenia; potem
 * miejsca na polu (`children`), znaki szkicu, zdania o najblizszym rowie i cieku oraz zrodla. Klikniecie miejsca na
 * obrazie albo liscie wyroznia je wszedzie (`zone-focus`), drugie klikniecie, Escape albo tlo zdejmuje wyroznienie.
 * Na wydruk idzie zawsze szkic z objasnieniami szkicu (obrazy z satelity drukuje blok "Pole z satelity").
 */
export function FieldMap({
  field,
  ditchInFieldM = null,
  zones = NO_ZONES,
  imageryParcels = null,
  imageryDate = '',
  children,
}: FieldMapProps) {
  const t = useTranslations('report.fieldMap');
  const tSimple = useTranslations('report.simple');
  const format = useFormatter();
  const tLayers = useTranslations('report.fieldMap.layers');
  const mode = useFieldMode();
  const [layers, setLayers] = useState<FieldMapLayers>(ALL_LAYERS);
  const [failed, setFailed] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const zoomIn = useCallback(() => setZoomStep((value) => Math.min(MAX_ZOOM_STEP, value + 1)), []);
  const zoomOut = useCallback(() => setZoomStep((value) => Math.max(0, value - 1)), []);
  const aerial = mode === 'aerial';
  const sketchMode = mode === 'sketch';
  const layer = mode === 'condition' || mode === 'moisture' ? mode : null;
  const imageryTarget = useMemo(
    () => ({ parcels: imageryParcels, date: imageryDate }),
    [imageryParcels, imageryDate],
  );
  const satellite = useSatelliteLayer(imageryTarget, layer);

  // stare linki do bloku "Pole z satelity" (`#satelita`) otwieraja karte w trybie "Kondycja roslin"
  useEffect(() => {
    if (window.location.hash !== `#${SATELLITE_ANCHOR}`) return;
    chooseFieldMode('condition');
    document.getElementById(SATELLITE_ANCHOR)?.scrollIntoView({ block: 'start' });
  }, []);

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
      CONTEXT_LAYERS.map((layerName) => ({
        queryKey: ['context-tile', layerName, tile.x, tile.y] as const,
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchContextTile(layerName, tile.x, tile.y, signal),
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
    <section
      id={SATELLITE_ANCHOR}
      aria-labelledby="pole-title"
      className="flex scroll-mt-24 flex-col gap-5 rounded-3xl border bg-card p-4 shadow-card sm:p-6 print:gap-3 print:rounded-lg print:p-3 print:shadow-none"
      data-testid="field-map"
      data-hydro={state}
      data-mode={mode}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="pole-title" className="text-2xl font-semibold print:text-xl">
            {tSimple('field')}
          </h2>
          <p className="text-base text-muted-foreground">
            <span className="print:hidden">{t(`modes.${mode}.subtitle`)}</span>
            <span className="hidden print:inline">{t('modes.sketch.subtitle')}</span>
          </p>
        </div>
        <fieldset
          className="grid grid-cols-2 gap-1 rounded-3xl bg-muted p-1 lg:grid-cols-4 lg:rounded-full print:hidden"
          data-testid="field-map-mode"
        >
          <legend className="sr-only">{t('modeLabel')}</legend>
          {FIELD_MODES.map((item) => (
            <ModeButton key={item} mode={item} pressed={mode === item} label={t(`modes.${item}.label`)} />
          ))}
        </fieldset>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] lg:items-start print:grid-cols-2 print:gap-4">
        <div
          ref={sketchRef}
          className="flex min-w-0 scroll-mt-4 flex-col gap-3 lg:sticky lg:top-24 print:static"
        >
          <div
            className={cn(
              'w-full overflow-hidden rounded-2xl border print:break-inside-avoid print:rounded-lg',
              !sketchMode && 'hidden print:block',
            )}
          >
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
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border bg-muted lg:aspect-[5/4]">
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
                    size="lg"
                    onClick={zoomIn}
                    disabled={zoomStep >= MAX_ZOOM_STEP}
                  >
                    <ZoomIn aria-hidden="true" />
                    {t('zoomIn')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={zoomOut}
                    disabled={zoomStep === 0}
                  >
                    <ZoomOut aria-hidden="true" />
                    {t('zoomOut')}
                  </Button>
                </div>
              )}
            </div>
          )}
          {layer && (
            <div className="print:hidden">
              <SatelliteImage
                layer={layer}
                state={satellite.state}
                field={field}
                zones={zones}
                date={imageryDate}
                onRetry={satellite.retry}
              />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6 print:gap-3" data-testid="field-map-aside">
          {layer && <SatelliteNotes layer={layer} state={satellite.state} />}
          {children}
          <div className={cn('flex flex-col gap-2', !sketchMode && 'hidden print:flex')}>
            <h3 className="text-lg font-semibold">{t('signsTitle')}</h3>
            <SketchLegend model={sketch} zoneKinds={zoneKinds} />
          </div>
          {aerial && layers.zones && <ZoneKindLegend kinds={zoneKinds} />}
          <div className="flex flex-col gap-1 text-base">
            {state === 'loading' && <p className="text-muted-foreground">{t('sketch.loading')}</p>}
            {state === 'ready' && (
              <div className="flex flex-col gap-1" data-testid="field-map-nearest">
                <p>
                  {aerial && hydro.nearest.ditch && <Swatch />}
                  {hydro.nearest.ditch
                    ? t('nearestDitch', { distance: distance(hydro.nearest.ditch) })
                    : t('noDitch', { radius: RADIUS_M })}
                </p>
                <p>
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
                </p>
                {sketch.groups.length === 0 && <p>{t('sketch.noWater', { radius })}</p>}
              </div>
            )}
            {state === 'unavailable' && <p>{t('sketch.unavailable')}</p>}
            <p className="text-sm text-muted-foreground">
              {aerial ? (
                <span className="print:hidden">
                  {date ? t('sourcesDated', { date }) : t('sources')}
                  {hydro.highlighted.length > 0 ? ` ${t('highlight')}` : ''}
                </span>
              ) : null}
              <span className={cn(!sketchMode && 'hidden print:inline')}>
                {date ? t('sketch.sourcesDated', { date, radius }) : t('sketch.sources', { radius })}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
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

const MODE_ICONS: Record<FieldMode, LucideIcon> = {
  sketch: PenLine,
  aerial: Plane,
  condition: Sprout,
  moisture: Droplets,
};

function ModeButton({ mode, pressed, label }: { mode: FieldMode; pressed: boolean; label: string }) {
  const Icon = MODE_ICONS[mode];
  const choose = useCallback(() => chooseFieldMode(mode), [mode]);

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={choose}
      className={cn(
        'flex min-h-12 items-center justify-center gap-2 rounded-full px-3 text-base leading-tight font-semibold transition-colors duration-150 sm:px-4',
        pressed ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
      data-testid={`field-map-mode-${mode}`}
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

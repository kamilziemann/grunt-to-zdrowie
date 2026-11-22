import type { ContextFeature, ContextTile, FieldArea, HydroFeature, HydroTile } from '@app/contracts';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { Droplets, Minus, PenLine, Plane, Plus, Sprout, type LucideIcon } from 'lucide-react';
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
import { ReportDetails } from '../report-section';
import { useZoneFocus } from '../zone-focus';
import type { FieldMapLayers } from './field-map-canvas';
import { chooseFieldMode, FIELD_MODES, useFieldMode, type FieldMode } from './field-mode';
import { SatelliteImage, SatelliteNotes, useSatelliteLayer } from './field-satellite';

/** Polowka przycisku "+"/"-" w rogu zdjecia pola (48 x 48 px, jak na mapie dzialek). */
const ZOOM_BUTTON =
  'flex size-12 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset disabled:opacity-40 [@media(hover:hover)]:hover:bg-muted';

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
  /** lista miejsc na polu - prawa kolumna karty */
  children?: ReactNode;
  /** skad sa miejsca na polu i jak dokladne - trafia do zwinietego "Skad te dane" pod karta */
  notes?: ReactNode;
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
 * Karta "Twoje pole" na cala szerokosc. U gory cztery pigulki trybu obrazu (wybor zapamietany w przegladarce): "Szkic"
 * (domyslny - "Woda na polu i wokol niego" w skali, SVG), "Zdjecie lotnicze" (MapLibre, osobny chunk ladowany dopiero
 * po wyborze), "Kondycja roslin" i "Woda w roslinach" (obraz z satelity z dnia analizy, pobierany dopiero po wyborze).
 * Po lewej obraz, a pod nim legenda aktywnego trybu (znaki szkicu / warstwy zdjecia / skala satelity) - trzymaja sie
 * ekranu przy przewijaniu; po prawej miejsca na polu jako karty (`children`). Pod spodem kafle z faktami o otoczeniu
 * (rowy przez pole, najblizszy row, najblizszy ciek) i zwiniete "Skad te dane" (`notes` + zrodla). Klikniecie miejsca
 * na obrazie albo karcie wyroznia je wszedzie (`zone-focus`), drugie klikniecie, Escape albo tlo zdejmuje wyroznienie.
 * Na wydruk idzie zawsze szkic z legenda szkicu (obrazy z satelity drukuje blok "Pole z satelity").
 */
export function FieldMap({
  field,
  ditchInFieldM = null,
  zones = NO_ZONES,
  imageryParcels = null,
  imageryDate = '',
  children,
  notes = null,
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

  // fakty o otoczeniu pola jako kafle pod karta: rowy przez pole, najblizszy row, najblizszy ciek
  const factDistance = (item: NearestHydro) => (item.distanceM < 1 ? t('facts.touches') : distance(item));
  const facts: FieldFact[] = [];

  if (state === 'ready') {
    if (fact?.kind === 'ditch_through') {
      facts.push({
        key: 'through',
        label: t(fact.alongEdge ? 'facts.ditchAlongEdge' : 'facts.ditchThrough'),
        value:
          fact.ditches > 1
            ? t('facts.ditchCount', { count: fact.ditches, meters: meters(fact.lengthM) })
            : t('facts.meters', { meters: meters(fact.lengthM) }),
        marked: false,
      });
    }

    facts.push({
      key: 'ditch',
      label: t('facts.nearestDitch'),
      value: hydro.nearest.ditch ? factDistance(hydro.nearest.ditch) : t('facts.none', { radius: RADIUS_M }),
      marked: aerial && hydro.nearest.ditch !== null,
    });

    const named = hydro.nearest.named;
    const course = hydro.nearest.watercourse;

    facts.push(
      named
        ? {
            key: 'watercourse',
            label: namedWaterLabel(t(`kinds.${named.feature.kind}`), named.feature.name ?? ''),
            value: factDistance(named),
            marked: aerial,
          }
        : course
          ? {
              key: 'watercourse',
              label: t('facts.watercourse', { kind: t(`kinds.${course.feature.kind}`) }),
              value: factDistance(course),
              marked: aerial,
            }
          : {
              key: 'watercourse',
              label: t('facts.watercourses'),
              value: t('facts.none', { radius: RADIUS_M }),
              marked: false,
            },
    );
  }

  // podpis z data zdjecia tylko w trybie satelitarnym (zapytanie trzyma ostatni obraz takze po zmianie trybu)
  const scene = layer && satellite.state.kind === 'ready' ? satellite.state.data.sceneDate : null;

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
          className="grid grid-cols-2 gap-1 rounded-3xl bg-muted p-1 lg:flex lg:w-fit lg:rounded-full print:hidden"
          data-testid="field-map-mode"
        >
          <legend className="sr-only">{t('modeLabel')}</legend>
          {FIELD_MODES.map((item) => (
            <ModeButton key={item} mode={item} pressed={mode === item} label={t(`modes.${item}.label`)} />
          ))}
        </fieldset>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:items-start print:grid-cols-2 print:gap-4">
        {/* obraz z legenda aktywnego trybu trzyma sie ekranu, gdy lista miejsc obok jest dluzsza */}
        <div
          ref={sketchRef}
          className="flex min-w-0 scroll-mt-4 flex-col gap-4 lg:sticky lg:top-24 print:static print:gap-2"
        >
          <figure className="flex flex-col gap-2">
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
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border bg-muted lg:aspect-[5/4] print:hidden">
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
                {!failed && (
                  // przyblizanie jak na zwyklej mapie: "+" i "-" w rogu obrazu (decyzja wlasciciela 2026-11-22)
                  <div className="absolute top-3 right-3 z-10 flex w-12 flex-col divide-y overflow-hidden rounded-lg border bg-card text-card-foreground shadow-md">
                    <button
                      type="button"
                      aria-label={t('zoomIn')}
                      title={t('zoomIn')}
                      onClick={zoomIn}
                      disabled={zoomStep >= MAX_ZOOM_STEP}
                      className={ZOOM_BUTTON}
                    >
                      <Plus aria-hidden="true" className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('zoomOut')}
                      title={t('zoomOut')}
                      onClick={zoomOut}
                      disabled={zoomStep === 0}
                      className={ZOOM_BUTTON}
                    >
                      <Minus aria-hidden="true" className="size-5" />
                    </button>
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
            {scene && (
              <figcaption className="px-1 text-sm text-muted-foreground print:hidden">
                {t('caption', {
                  field: fieldName,
                  date: format.dateTime(new Date(`${scene}T12:00:00Z`), {
                    dateStyle: 'long',
                    timeZone: APP_TIME_ZONE,
                  }),
                })}
              </figcaption>
            )}
          </figure>
          {/* legenda aktywnego trybu pod obrazem; prawa kolumna zostaje dla miejsc na polu */}
          <div
            className="flex flex-col gap-4 rounded-2xl border p-4 print:gap-2 print:border-0 print:p-0"
            data-testid="field-map-notes"
          >
            {layer && <SatelliteNotes layer={layer} state={satellite.state} />}
            <div className={cn('flex flex-col gap-2', !sketchMode && 'hidden print:flex')}>
              <h3 className="text-lg font-semibold">{t('signsTitle')}</h3>
              <SketchLegend model={sketch} zoneKinds={zoneKinds} />
            </div>
            {aerial && (
              <div className="flex flex-col gap-3 print:hidden">
                <h3 className="text-lg font-semibold">{tLayers('label')}</h3>
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
                {layers.zones && <ZoneKindLegend kinds={zoneKinds} />}
              </div>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6 print:gap-3" data-testid="field-map-aside">
          {children}
        </div>
      </div>
      {state === 'loading' && <p className="text-base text-muted-foreground">{t('sketch.loading')}</p>}
      {state === 'unavailable' && <p className="text-base">{t('sketch.unavailable')}</p>}
      {facts.length > 0 && (
        <dl
          className={cn(
            'grid gap-3 print:grid-cols-3 print:gap-2',
            facts.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
          )}
          data-testid="field-map-nearest"
        >
          {facts.map((item) => (
            <div
              key={item.key}
              className="flex flex-col gap-0.5 rounded-2xl border px-4 py-3 print:rounded-lg print:px-2 print:py-1"
            >
              <dt className="text-base text-muted-foreground">
                {item.marked && <Swatch />}
                {item.label}
              </dt>
              <dd className="text-xl font-semibold first-letter:uppercase print:text-base">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {state === 'ready' && sketch.groups.length === 0 && (
        <p className="text-base">{t('sketch.noWater', { radius })}</p>
      )}
      <ReportDetails summary={t('sourcesTitle')}>
        {notes}
        <p className="text-muted-foreground">
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
      </ReportDetails>
    </section>
  );
}

/** Jeden fakt o otoczeniu pola (kafel pod karta): podpis i wartosc; `marked` = kolor wyroznienia na zdjeciu. */
interface FieldFact {
  key: string;
  label: string;
  value: string;
  marked: boolean;
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

// Ekran "znajdz dzialke": mapa na cala powierzchnie i panel (boczny na komputerze, arkusz od dolu na telefonie).
// Telefon: na gorze mapy wyszukiwarka i jeden rzad pigulek (podklad, warstwy, satelita), pod nimi po prawej przyciski
// MapLibre, w lewym dolnym rogu pigulka "Legenda", na dole niski arkusz z glowna akcja kroku.
// Stan: tekst wyszukiwania, wskazana dzialka (podglad) i polozenie arkusza. Lista "moje dzialki" zyje w adresie
// strony, wiec przychodzi z trasy (`ids` + `onIdsChange`) - link da sie wyslac, a odswiezenie niczego nie gubi.
import {
  type ContextLayer,
  PARCEL_ID_PATTERN,
  PARCEL_LIMITS,
  POLAND_BOUNDS,
  type Parcel,
  type ParcelCandidate,
  type ParcelBoundaryTileZoom,
  type ParcelOutline,
  type Place,
} from '@app/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'use-intl';

import { ProblemAlert } from '@/components/shared/problem-alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/navigation';
import { toProblem } from '@/lib/problems';
import { cn } from '@/lib/utils/cn';
import type { AppHref, FieldSearch } from '@/lib/routes';

import {
  contextTileQuery,
  hydroTileQuery,
  parcelBoundariesQuery,
  parcelSearchQuery,
  parcelsKeys,
  parcelTargetQuery,
  placeSearchQuery,
  pointTarget,
  type ParcelTarget,
} from '../../api/parcels.queries';
import { useFieldDraw, type FieldDrawMode, type SplitTarget } from '../../hooks/use-field-draw';
import { useMapLayers } from '../../hooks/use-map-layers';
import { useContextKindLabels, useMapLabels } from '../../hooks/use-map-labels';
import { useSelectedParcels, type SelectedParcel } from '../../hooks/use-selected-parcels';
import {
  useVegetationImagery,
  type ImageryChoice,
  type ImageryState,
} from '../../hooks/use-vegetation-imagery';
import { validateParcelSearch, type ParcelSearchError } from '../../schemas/parcel-search.schema';
import { todayInPoland } from '../../utils/imagery-months';
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetFooter,
  SHEET_HALF_FRACTION,
  SHEET_PEEK_FALLBACK_REM,
  type SheetSnap,
} from '../bottom-sheet';
import { FieldDrawEntry, FieldDrawHint, FieldDrawPanel, FieldDrawUndo } from '../field-draw-panel';
import { MapIntro } from '../map-intro';
import { BasemapSwitch } from '../basemap-switch';
import { IMAGERY_GRADIENTS } from '../imagery-legend';
import { ImageryPanel } from '../imagery-panel';
import { ImagerySwitch } from '../imagery-switch';
import { LayersPanel } from '../layers-panel';
import { LegendDock, type LegendDockStatus } from '../legend-dock';
import { MapLegends } from '../map-legends';
import { ParcelCandidates } from '../parcel-candidates';
import { ParcelList } from '../parcel-list';
import {
  ParcelMap,
  type ContextVisibility,
  type HydroStatus,
  type LayerStatus,
  type MapFocus,
  type MapPadding,
} from '../parcel-map';
import { ParcelPreview, useAreaFormatter } from '../parcel-preview';
import { ParcelSearch } from '../parcel-search';
import { PlaceResults } from '../place-results';
import { StepsHeader, type ParcelStep } from '../steps-header';

export interface ParcelsScreenProps {
  /** identyfikatory z listy "moje dzialki" (z adresu strony) */
  ids: readonly string[];
  onIdsChange: (ids: string[]) => void;
  /** adres nastepnego kroku dla podanej listy dzialek (i wlasnego obszaru narysowanego na mapie) */
  analysisHref: (ids: readonly string[], area?: FieldSearch) => AppHref;
  /** okolica do pokazania na starcie (adres wybrany na stronie glownej) - rolnik klika swoja dzialke */
  initialView?: MapFocus['bbox'] | null;
  /** od razu tryb "wlasne pole" (z kroku "Czy to Twoja dzialka?" -> "Tylko czesc") */
  initialDraw?: FieldDrawMode | null;
}

const DESKTOP_QUERY = '(min-width: 48rem)';
const PANEL_WIDTH_REM = 25;
const MAP_MARGIN_PX = 56;
const HINT_MS = 4000;
const NO_PARCELS: readonly Parcel[] = [];

type MapHint = 'zoomHint' | 'outsidePoland' | 'pickHint';

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

function insidePoland(lng: number, lat: number): boolean {
  return (
    lng >= POLAND_BOUNDS.west &&
    lng <= POLAND_BOUNDS.east &&
    lat >= POLAND_BOUNDS.south &&
    lat <= POLAND_BOUNDS.north
  );
}

const HYDRO_OFF: HydroStatus = { state: 'off', importedAt: null, truncated: false };
const CONTEXT_OFF: Record<ContextLayer, LayerStatus> = {
  cover: HYDRO_OFF,
  waterworks: HYDRO_OFF,
  protected: HYDRO_OFF,
};

export function ParcelsScreen({
  ids,
  onIdsChange,
  analysisHref,
  initialView = null,
  initialDraw = null,
}: ParcelsScreenProps) {
  const t = useTranslations('parcels');
  const tCommon = useTranslations('common');
  const tImagery = useTranslations('parcels.imagery');
  const queryClient = useQueryClient();
  const mapLabels = useMapLabels();
  const contextLabels = useContextKindLabels();
  const rootRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<number | undefined>(undefined);

  const [text, setText] = useState('');
  const [inputError, setInputError] = useState<ParcelSearchError | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [picked, setPicked] = useState<ParcelTarget | null>(null);
  // Dzialka kliknieta w warstwie granic: obrys i numer sa znane od razu, pelny opis dociaga sie w tle.
  const [instant, setInstant] = useState<ParcelOutline | null>(null);
  // Czy mapa ma dojechac do podgladu: tak po wyszukaniu, nie po kliknieciu w dzialke, ktora juz widac.
  const [focusPreview, setFocusPreview] = useState(true);
  const [shown, setShown] = useState<MapFocus | null>(() =>
    initialView ? { bbox: initialView, key: `view:${initialView.join(',')}` } : null,
  );
  // tryb rysowania z adresu wlaczamy raz - podzial czeka, az dzialka do podzialu sie wczyta
  const pendingDraw = useRef<FieldDrawMode | null>(initialDraw);
  // warstwy mapy zyja w pamieci przegladarki - wybor wraca po powrocie z raportu
  const { layers, update: updateLayers } = useMapLayers();
  const { imagery: imageryChoice, imageryMonth } = layers;
  const [hydroStatus, setHydroStatus] = useState<HydroStatus>(HYDRO_OFF);
  const [contextStatuses, setContextStatuses] = useState(CONTEXT_OFF);
  const [layersOpen, setLayersOpen] = useState(false);
  const [imageryOpen, setImageryOpen] = useState(false);
  const [legendsOpen, setLegendsOpen] = useState(false);
  // zmierzona wysokosc zwinietego arkusza (telefon): mapa konczy sie tuz pod nim, pigulka legendy stoi nad nim
  const [sheetPeek, setSheetPeek] = useState<number | null>(null);
  // pierwsze wejscie (pusta lista): arkusz do polowy, zeby na telefonie bylo widac trzy kroki i przyklad
  const [snap, setSnap] = useState<SheetSnap>(ids.length === 0 && !initialView ? 'half' : 'peek');
  const [hint, setHint] = useState<MapHint | null>(initialView ? 'pickHint' : null);

  const search = useQuery({ ...parcelSearchQuery(submitted ?? ''), enabled: submitted !== null });
  const places = useQuery({ ...placeSearchQuery(submitted ?? ''), enabled: submitted !== null });
  // Jedno trafienie jest jednoznaczne - od razu pokazujemy podglad; przy kilku wybiera rolnik (lista kandydatow).
  const onlyMatch = search.data?.items.length === 1 ? search.data.items[0] : undefined;
  const target = useMemo(
    (): ParcelTarget | null => picked ?? (onlyMatch ? { kind: 'id', id: onlyMatch.id } : null),
    [picked, onlyMatch],
  );
  const previewQuery = useQuery(parcelTargetQuery(target));
  const preview = target ? (previewQuery.data ?? null) : null;
  const outline = target?.kind === 'id' && instant?.id === target.id ? instant : null;
  // na mapie rysujemy to, co juz wiemy: pelna dzialke albo sam obrys z warstwy granic
  const previewShape = preview ?? outline;
  const selected = useSelectedParcels(ids);
  // Podzial linia dotyczy jednej dzialki - jedynej na liscie (przy kilku nie wiadomo, ktora dzielic).
  const onlyParcel = ids.length === 1 && selected.parcels.length === 1 ? selected.parcels[0] : undefined;
  const splitTarget = useMemo(
    (): SplitTarget | null =>
      onlyParcel ? { id: onlyParcel.id, number: onlyParcel.number, geometry: onlyParcel.geometry } : null,
    [onlyParcel],
  );
  const draw = useFieldDraw(splitTarget);
  const imagery = useVegetationImagery(ids, imageryChoice, imageryMonth);
  const formatArea = useAreaFormatter();
  const drawing = draw.mode !== null;

  const focus = useMemo((): MapFocus | null => {
    if (shown) return shown;

    if (preview && focusPreview) return { bbox: preview.bbox, key: `preview:${preview.id}` };

    const box = selected.settled ? unionBbox(selected.parcels) : null;

    return box ? { bbox: box, key: `selection:${ids.join(',')}` } : null;
  }, [shown, preview, focusPreview, selected.settled, selected.parcels, ids]);

  // Margines dojazdu liczony w chwili dojazdu: na komputerze panel zaslania lewa strone, na telefonie arkusz dol.
  const getPadding = useCallback((): MapPadding => {
    const base = { top: MAP_MARGIN_PX, right: MAP_MARGIN_PX, bottom: MAP_MARGIN_PX, left: MAP_MARGIN_PX };
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

    if (window.matchMedia(DESKTOP_QUERY).matches) {
      return { ...base, left: PANEL_WIDTH_REM * rem + MAP_MARGIN_PX };
    }

    const height = rootRef.current?.clientHeight ?? window.innerHeight;
    const peek = sheetPeek ?? SHEET_PEEK_FALLBACK_REM * rem;
    const visible = snap === 'peek' ? peek : height * SHEET_HALF_FRACTION;

    // mapa konczy sie nad zwinietym arkuszem, wiec doliczamy tylko to, co arkusz zaslania ponad nim
    const bottom = Math.max(0, visible - peek) + MAP_MARGIN_PX;
    // u gory wyszukiwarka i rzad pigulek siegaja na telefonie w glab mapy - dzialka ma stanac pod nimi
    const controls = controlsRef.current?.getBoundingClientRect().bottom ?? 0;
    const rootTop = rootRef.current?.getBoundingClientRect().top ?? 0;
    const top = Math.min(
      Math.max(MAP_MARGIN_PX, controls - rootTop + MAP_MARGIN_PX / 4),
      height - peek - bottom - MAP_MARGIN_PX * 2,
    );

    return { ...base, top: Math.max(MAP_MARGIN_PX, top), bottom };
  }, [snap, sheetPeek]);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  const showHint = useCallback((next: MapHint) => {
    window.clearTimeout(hintTimer.current);
    setHint(next);
    hintTimer.current = window.setTimeout(() => setHint(null), HINT_MS);
  }, []);

  const clearSearch = useCallback(() => {
    setText('');
    setSubmitted(null);
    setPicked(null);
    setInstant(null);
    setInputError(null);
  }, []);

  const submitSearch = useCallback(() => {
    const input = validateParcelSearch(text);

    // blad formatu stoi przy polu - arkusz zostaje, gdzie byl; wyniki pokazuje arkusz podniesiony do polowy
    if (!input.ok) {
      setInputError(input.error);

      return;
    }

    setSnap('half');
    setInputError(null);
    setShown(null);
    setInstant(null);
    setFocusPreview(true);

    // Pelny numer wskazuje jedna dzialke - pobieramy ja od razu, bez listy kandydatow (jedno zapytanie mniej).
    if (PARCEL_ID_PATTERN.test(input.query)) {
      setSubmitted(null);
      setPicked({ kind: 'id', id: input.query });
    } else {
      setPicked(null);
      setSubmitted(input.query);
    }

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [text]);

  const changeText = useCallback((value: string) => {
    setText(value);
    setInputError(null);
  }, []);

  const { addPoint, start: startDraw } = draw;

  const pickOnMap = useCallback(
    (lng: number, lat: number, hit?: ParcelOutline) => {
      if (!insidePoland(lng, lat)) {
        showHint('outsidePoland');

        return;
      }

      // w trybie "wlasne pole" stukniecie dodaje punkt obrysu albo linii podzialu
      if (drawing) {
        addPoint(lng, lat);

        return;
      }

      setHint(null);
      setSubmitted(null);
      setShown(null);
      // Dzialka z warstwy granic zaznacza sie od razu i pytamy o nia po identyfikatorze; bez niej - po punkcie.
      setInstant(hit ?? null);
      setPicked(hit ? { kind: 'id', id: hit.id } : pointTarget(lng, lat));
      // Na komputerze kliknieta dzialka jest juz widoczna obok panelu, wiec mapa stoi w miejscu. Na telefonie
      // arkusz zaslania dol mapy - tam dojazd przesuwa dzialke nad arkusz.
      setFocusPreview(!window.matchMedia(DESKTOP_QUERY).matches);
      setSnap('half');
    },
    [showHint, drawing, addPoint],
  );

  const beginFieldDraw = useCallback(
    (mode: FieldDrawMode) => {
      clearSearch();
      startDraw(mode);
      // mapa ma byc widoczna do stukania; przy podziale dojezdzamy do dzielonej dzialki
      setSnap('peek');

      if (mode === 'split' && onlyParcel) {
        setShown({ bbox: onlyParcel.bbox, key: `split:${onlyParcel.id}:${Date.now()}` });
      }
    },
    [clearSearch, startDraw, onlyParcel],
  );

  useEffect(() => {
    const mode = pendingDraw.current;

    if (!mode || (mode === 'split' && !onlyParcel)) return;

    pendingDraw.current = null;
    beginFieldDraw(mode);
  }, [onlyParcel, beginFieldDraw]);

  const loadBoundaries = useCallback(
    (x: number, y: number, z: ParcelBoundaryTileZoom) => queryClient.query(parcelBoundariesQuery(x, y, z)),
    [queryClient],
  );

  const loadHydro = useCallback(
    (x: number, y: number) => queryClient.query(hydroTileQuery(x, y)),
    [queryClient],
  );

  const loadContext = useCallback(
    (layer: ContextLayer, x: number, y: number) => queryClient.query(contextTileQuery(layer, x, y)),
    [queryClient],
  );

  const onContextStatus = useCallback(
    (layer: ContextLayer, status: LayerStatus) =>
      setContextStatuses((current) => ({ ...current, [layer]: status })),
    [],
  );

  const context = useMemo(
    (): ContextVisibility => ({
      cover: layers.cover,
      waterworks: layers.waterworks,
      protected: layers.protected,
    }),
    [layers.cover, layers.waterworks, layers.protected],
  );
  // legenda otoczenia od chwili wlaczenia warstwy - przy oddalonej mapie mowi "przybliz", bo nic jeszcze nie widac
  const contextShown = (['cover', 'waterworks', 'protected'] as const).some(
    (layer) => layers[layer] && contextStatuses[layer].state !== 'off',
  );

  const setImageryMonth = useCallback(
    (month: string | null) => updateLayers({ imageryMonth: month }),
    [updateLayers],
  );

  const hydroLegendShown = layers.hydro && hydroStatus.state !== 'off' && hydroStatus.state !== 'zoom';
  const imageryLegendShown = imageryChoice !== 'none' && imagery.state !== 'off';
  const legendsShown = hydroLegendShown || contextShown || imageryLegendShown;
  const imageryStatus = IMAGERY_BUTTON_STATUS[imagery.state];
  const legendStatus = legendDockStatus({
    hydro: hydroLegendShown ? hydroStatus : null,
    context: contextShown
      ? (['cover', 'waterworks', 'protected'] as const)
          .filter((layer) => layers[layer])
          .map((layer) => contextStatuses[layer])
      : [],
    imagery: imageryLegendShown ? imageryStatus : 'idle',
  });
  const rootStyle = useMemo(
    () => (sheetPeek === null ? undefined : ({ '--sheet-peek': `${sheetPeek}px` } as CSSProperties)),
    [sheetPeek],
  );

  const onZoomTooLow = useCallback(() => showHint('zoomHint'), [showHint]);

  const chooseImagery = useCallback(
    (choice: ImageryChoice) => {
      updateLayers({ imagery: choice });

      // na telefonie arkusz i panel wyboru zaslaniaja mape - po wyborze chowamy oba, zeby bylo widac kolory na polu
      if (choice === 'none' || window.matchMedia(DESKTOP_QUERY).matches) return;

      setSnap('peek');
      setImageryOpen(false);

      // dojazd do pol: kolory maja stanac nad arkuszem i pod legenda, a nie pod nimi
      const box = unionBbox(selected.parcels);

      if (box) setShown({ bbox: box, key: `imagery:${Date.now()}` });

      // fokus w schowanym arkuszu przewinalby caly ekran (kontener mapy) w strone przelacznika
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    },
    [selected.parcels, updateLayers],
  );

  const chooseCandidate = useCallback((candidate: ParcelCandidate) => {
    setShown(null);
    setInstant(null);
    setFocusPreview(true);
    setPicked({ kind: 'id', id: candidate.id });
    setSnap('half');
  }, []);

  const choosePlace = useCallback(
    (place: Place) => {
      setShown({ bbox: place.bbox, key: `place:${place.id}:${Date.now()}` });
      setSnap('peek');
      showHint('pickHint');
    },
    [showHint],
  );

  // Dodac mozna od razu po kliknieciu: lista potrzebuje tylko identyfikatora, opis doczyta sama.
  const addableId = previewShape?.id ?? null;
  const canAdd = addableId !== null && !ids.includes(addableId) && ids.length < PARCEL_LIMITS.selectionMax;

  const addPreview = useCallback(() => {
    if (addableId === null || !canAdd) return;

    // dzialka wskazana na mapie siedzi w cache pod kluczem punktu - lista czyta ja po identyfikatorze
    if (preview) queryClient.setQueryData(parcelsKeys.detail(preview.id), preview);

    onIdsChange([...ids, addableId]);
    clearSearch();

    if (preview && focusPreview) setShown({ bbox: preview.bbox, key: `added:${preview.id}` });
  }, [addableId, canAdd, preview, focusPreview, queryClient, onIdsChange, ids, clearSearch]);

  const showOnMap = useCallback((item: SelectedParcel) => {
    if (!item.parcel) return;

    setShown({ bbox: item.parcel.bbox, key: `show:${item.id}:${Date.now()}` });
    setSnap('peek');
  }, []);

  const removeParcel = useCallback(
    (id: string) => {
      setShown(null);
      onIdsChange(ids.filter((current) => current !== id));
    },
    [onIdsChange, ids],
  );

  const { refetch: refetchSearch } = search;
  const { refetch: refetchPreview } = previewQuery;
  const retrySearch = useCallback(() => void refetchSearch(), [refetchSearch]);
  const retryPreview = useCallback(() => void refetchPreview(), [refetchPreview]);
  const sheetLabels = useMemo(() => ({ expand: t('sheet.expand'), collapse: t('sheet.collapse') }), [t]);

  const step: ParcelStep = target ? 'check' : ids.length > 0 ? 'analyze' : 'find';
  const firstVisit = ids.length === 0 && target === null && submitted === null;
  const showCandidates = submitted !== null && picked === null && !onlyMatch && search.data !== undefined;
  const hasPlaces = (places.data?.items.length ?? 0) > 0;
  const showPlaces = submitted !== null && picked === null && !onlyMatch && hasPlaces;
  const previewMissing = target !== null && previewQuery.isSuccess && previewQuery.data === null;

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      className="@container-[size] relative min-h-0 flex-1 overflow-clip"
      // telefon: przyciski MapLibre (przybliz, oddal, polozenie) po prawej pod wyszukiwarka i rzedem pigulek (app.css);
      // w trybie "wlasne pole" gora mapy jest wolna, wiec wracaja na gore (podpowiedz zostawia im miejsce)
      data-map-controls={drawing ? undefined : 'below-search'}
    >
      <div
        ref={controlsRef}
        // otwarty panel warstw na telefonie przykrywa arkusz dzialek (arkusz ma z-10)
        // w trybie "wlasne pole" wyszukiwarka i przyciski ustepuja miejsca podpowiedzi (rysowane miejsce ma byc odsloniete)
        className={cn(
          'absolute inset-x-3 top-3 z-10 flex flex-col gap-2 has-aria-expanded:z-30 md:right-auto md:left-106 md:max-w-[calc(100%-31rem)]',
          drawing && 'hidden',
        )}
      >
        {/* telefon: wyszukiwarka na gorze mapy (klawiatura jej nie zaslania); na komputerze stoi w panelu bocznym */}
        <ParcelSearch
          variant="map"
          className="md:hidden"
          value={text}
          onChange={changeText}
          onSubmit={submitSearch}
          pending={search.isFetching || (target !== null && previewQuery.isFetching)}
          error={inputError}
        />
        {/* podklad i zdjecie z satelity maja wlasne przyciski - to najczestsze zmiany, nie chowamy ich w warstwach;
            telefon: jeden rzad, ponizej 360 px przewija sie w poziomie (otwarte panele sa `fixed`, rzad ich nie przycina;
            margines w pionie zostawia miejsce na plakietke stanu na przycisku "Satelita") */}
        <div
          className="flex items-start gap-2 max-md:-mx-3 max-md:-my-2 max-md:gap-1 max-md:overflow-x-auto max-md:px-3 max-md:py-2 max-md:[scrollbar-width:none] md:flex-wrap"
          data-testid="map-controls-row"
        >
          <BasemapSwitch value={layers.basemap} onChange={updateLayers} />
          <LayersPanel
            open={layersOpen}
            onOpenChange={setLayersOpen}
            layers={layers}
            onChange={updateLayers}
            className="shrink-0"
          />
          <ImageryPanel
            open={imageryOpen}
            onOpenChange={setImageryOpen}
            value={ids.length > 0 ? imageryChoice : 'none'}
            status={imageryStatus}
            className="shrink-0"
          >
            <ImagerySwitch
              value={imageryChoice}
              onChange={chooseImagery}
              month={imageryMonth}
              onMonthChange={setImageryMonth}
              today={todayInPoland()}
              enabled={ids.length > 0}
              legendClassName="sr-only"
            />
          </ImageryPanel>
        </div>
      </div>

      <div className="absolute inset-0 max-md:bottom-[calc(var(--sheet-peek,7.75rem)-0.5rem)]">
        <ParcelMap
          // w trybie "wlasne pole" dzialki tylko obrysem (tlo), zeby wybrana czesc odrozniala sie od reszty
          selected={drawing ? NO_PARCELS : selected.parcels}
          preview={drawing ? (draw.mode === 'split' ? (onlyParcel ?? null) : null) : previewShape}
          drawing={drawing ? draw.overlay : null}
          basemap={layers.basemap}
          boundaries={layers.boundaries}
          loadBoundaries={loadBoundaries}
          hydro={layers.hydro}
          loadHydro={loadHydro}
          onHydroStatus={setHydroStatus}
          context={context}
          loadContext={loadContext}
          onContextStatus={onContextStatus}
          contextLabels={contextLabels}
          imagery={imagery.overlays}
          focus={focus}
          getPadding={getPadding}
          onPick={pickOnMap}
          onZoomTooLow={onZoomTooLow}
          status={target !== null && previewQuery.isFetching ? t('map.loadingParcel') : null}
          // telefon: nad pigulka legendy (lewy dolny rog); komputer: na srodku widocznej mapy obok panelu
          statusClassName="max-md:bottom-18 md:left-[calc(50%+12.5rem)]"
          labels={mapLabels}
        />
      </div>

      {/* legendy stoja osobno od przyciskow; rozwinieta jest najwyzej jedna (harmonijka) */}
      {legendsShown && !drawing && (
        <LegendDock
          open={legendsOpen}
          onOpenChange={setLegendsOpen}
          layerName={imageryLegendShown ? tImagery(`choices.${imageryChoice}`) : null}
          swatchClassName={imageryLegendShown ? IMAGERY_GRADIENTS[imageryChoice] : null}
          status={legendStatus}
        >
          {/* przy oddalonej mapie warstwa nic nie pokazuje - legenda tylko by zaslaniala (podpowiedz ma przelacznik) */}
          <MapLegends
            hydroStatus={hydroLegendShown ? hydroStatus : null}
            contextEnabled={contextShown ? context : null}
            contextStatuses={contextStatuses}
            imageryLayer={imageryLegendShown ? imageryChoice : null}
            imageryState={imagery.state}
            imageryData={imagery.data}
            imageryRequestedDate={imagery.requestedDate}
            onImageryRetry={imagery.retry}
            itemClassName="max-md:w-full max-md:shadow-none"
          />
        </LegendDock>
      )}

      {drawing && (
        // podpowiedz "co teraz" u gory mapy (obok przyciskow przyblizenia) - rysowane miejsce zostaje odsloniete
        <div className="absolute top-3 right-14 left-3 z-20 md:right-auto md:left-106 md:max-w-xl">
          <FieldDrawHint draw={draw} splitTarget={splitTarget} />
        </div>
      )}

      {hint && !drawing && (
        // telefon: pod rzedem pigulek, z lewej - kolumna przyciskow mapy po prawej zostaje odslonieta
        <output className="absolute top-32 left-1/2 z-10 block w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg max-md:top-30 max-md:left-3 max-md:max-w-[calc(100%-4.5rem)] max-md:translate-x-0 md:top-3 md:left-[calc(50%+12.5rem)]">
          {t(`map.${hint}`)}
        </output>
      )}

      <BottomSheet snap={snap} onSnapChange={setSnap} labels={sheetLabels} onPeekChange={setSheetPeek}>
        <BottomSheetBody>
          {drawing ? (
            <div className="flex flex-col gap-4 p-4 max-md:pt-0">
              <FieldDrawPanel draw={draw} splitTarget={splitTarget} />
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4 max-md:pt-0">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  {/* telefon: tytul tylko dla czytnikow - miejsce w arkuszu nalezy do wynikow i listy dzialek */}
                  <h1 className="text-2xl font-medium tracking-tight max-md:sr-only">{t('title')}</h1>
                  {/* przy pierwszym wejsciu kroki opisuje karta nizej - pasek etapow bylby powtorzeniem */}
                  {!firstVisit && <StepsHeader current={step} />}
                </div>
                {/* komputer: wyszukiwarka w panelu bocznym; telefon ma ja na gorze mapy (ten sam stan) */}
                <ParcelSearch
                  className="max-md:hidden"
                  value={text}
                  onChange={changeText}
                  onSubmit={submitSearch}
                  pending={search.isFetching || (target !== null && previewQuery.isFetching)}
                  error={inputError}
                />
              </div>

              {search.isFetching && picked === null && (
                <output className="block rounded-lg bg-muted px-3 py-3 text-sm">{t('search.slow')}</output>
              )}

              {search.isError && picked === null && !hasPlaces && !places.isFetching && (
                <ProblemAlert problem={toProblem(search.error)} title={t('search.failed')}>
                  <Button variant="outline" size="sm" onClick={retrySearch}>
                    {tCommon('tryAgain')}
                  </Button>
                </ProblemAlert>
              )}

              {showPlaces && places.data && (
                <PlaceResults places={places.data.items} onChoose={choosePlace} />
              )}

              {showCandidates && search.data && (search.data.items.length > 0 || !hasPlaces) && (
                <ParcelCandidates result={search.data} onChoose={chooseCandidate} />
              )}

              {target !== null && previewQuery.isPending && (
                <output aria-label={t('preview.loading')} className="flex flex-col gap-2">
                  {/* numer z warstwy granic znamy od razu - reszta opisu dociaga sie w tle */}
                  {outline ? (
                    <span className="text-xl font-semibold">
                      {t('preview.parcel', { number: outline.number })}
                    </span>
                  ) : (
                    <Skeleton className="h-7 w-2/3" />
                  )}
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-12 w-full" />
                </output>
              )}

              {target !== null && previewQuery.isError && (
                <ProblemAlert problem={toProblem(previewQuery.error)} title={t('preview.failed')}>
                  <Button variant="outline" size="sm" onClick={retryPreview}>
                    {tCommon('tryAgain')}
                  </Button>
                </ProblemAlert>
              )}

              {previewMissing && (
                <output className="block rounded-lg bg-muted px-3 py-3 text-sm">
                  {t(target.kind === 'point' ? 'preview.notFoundAtPoint' : 'preview.notFound')}
                </output>
              )}

              {preview && (
                <ParcelPreview
                  parcel={preview}
                  alreadyAdded={ids.includes(preview.id)}
                  listFull={ids.length >= PARCEL_LIMITS.selectionMax}
                  listMax={PARCEL_LIMITS.selectionMax}
                  onDismiss={clearSearch}
                />
              )}

              {firstVisit && <MapIntro />}

              <ParcelList
                items={selected.items}
                totalAreaHa={selected.totalAreaHa}
                onShow={showOnMap}
                onRemove={removeParcel}
              />

              <FieldDrawEntry splitTarget={splitTarget} onStart={beginFieldDraw} />
            </div>
          )}
        </BottomSheetBody>
        <BottomSheetFooter>
          {/* Pasek pokazuje glowna akcje biezacego kroku: przy podgladzie "dodaj", poza nim "analizuj". */}
          {drawing && (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <FieldDrawUndo draw={draw} />
                {draw.area ? (
                  <Button asChild size="xl" className="min-w-0 flex-1">
                    <Link
                      href={analysisHref(draw.area.parcelIds, {
                        obszar: draw.area.obszar,
                        rodzaj: draw.area.rodzaj,
                      })}
                    >
                      {t('field.analyze')}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <Button size="xl" className="min-w-0 flex-1" disabled aria-describedby="field-analyze-hint">
                    {t('field.analyze')}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                )}
              </div>
              {/* pole powierzchni tez w pasku: w zwinietym arkuszu na telefonie panel widac tylko u gory */}
              {draw.area ? (
                <p aria-hidden="true" className="text-center text-xs font-medium md:hidden">
                  {t('field.area', { area: formatArea(draw.area.areaHa) })}
                </p>
              ) : (
                <p id="field-analyze-hint" className="text-center text-xs text-muted-foreground">
                  {t('field.analyzeHint')}
                </p>
              )}
            </div>
          )}
          {!drawing && canAdd && (
            <Button size="xl" className="w-full" onClick={addPreview}>
              <Plus aria-hidden="true" />
              {t('preview.add')}
            </Button>
          )}
          {!drawing && !canAdd && ids.length > 0 && (
            <Button asChild size="xl" className="w-full">
              <Link href={analysisHref(ids)}>
                {t('analyze.cta', { count: ids.length })}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          )}
          {!drawing && !canAdd && ids.length === 0 && (
            <div className="flex flex-col gap-1.5">
              <Button size="xl" className="w-full" disabled aria-describedby="analyze-hint">
                {t('analyze.cta', { count: 1 })}
                <ArrowRight aria-hidden="true" />
              </Button>
              <p id="analyze-hint" className="text-center text-xs text-muted-foreground">
                {t('analyze.disabledHint')}
              </p>
            </div>
          )}
        </BottomSheetFooter>
      </BottomSheet>
    </div>
  );
}

/** Stan pobierania obrazu z satelity pokazany na przycisku "Satelita" (legenda bywa zwinieta albo poza ekranem). */
const IMAGERY_BUTTON_STATUS: Record<ImageryState, 'idle' | 'loading' | 'problem'> = {
  off: 'idle',
  ready: 'idle',
  loading: 'loading',
  noClearScene: 'problem',
  notConfigured: 'problem',
  busy: 'problem',
  failed: 'problem',
};

interface LegendDockInput {
  hydro: HydroStatus | null;
  /** stany wlaczonych warstw otoczenia */
  context: readonly LayerStatus[];
  imagery: 'idle' | 'loading' | 'problem';
}

/**
 * Stan na pigulce legendy (telefon): ostrzezenie, gdy ktoras legenda ma komunikat (warstwa niedostepna, przybliz mape,
 * brak zdjecia, blad) - po zamknieciu panelu komunikatu nie widac, wiec pigulka musi go zapowiadac.
 */
function legendDockStatus({ hydro, context, imagery }: LegendDockInput): LegendDockStatus {
  const contextStates = context.map((status) => status.state);
  const contextAttention =
    contextStates.includes('unavailable') ||
    (contextStates.length > 0 && contextStates.every((state) => state === 'zoom'));

  if (imagery === 'problem' || hydro?.state === 'unavailable' || contextAttention) return 'attention';

  if (imagery === 'loading' || contextStates.includes('loading')) return 'loading';

  return 'idle';
}

// Miejsca na polu (pakiet P12): komorki siatki 10 m z cechami (cell-features.ts) -> klasa komorki (suchsza,
// gromadzaca wode, typowa) -> wygladzenie -> spojne obszary >= 0,05 ha -> 2-5 stref z obrysem, udzialem i opisem.
// Klasa komorki z dwoch niezaleznych sygnalow wzgledem reszty pola: wilgotnosc roslin (NDMI z Sentinel-2) i
// polozenie w terenie (TWI), plus zaglebienie bez odplywu. Dzialki waskie (< 40 m szerokosci przy > 200 m dlugosci)
// dostaja profil podluzny w odcinkach, a pola < 0,5 ha - uczciwe "za male, by wyrozniac miejsca".
// Pogoda i gleba sa wspolne dla calego pola - strefy nie udaja, ze znamy je co 10 m.
import type { MeasureId, Zone, ZoneMap } from '@app/contracts';

import type { StageInput } from '../analysis-stages';
import {
  cellsInField,
  cellsOutline,
  fieldGrid,
  gridTooLarge,
  type GridCell,
  type GridSpec,
} from '../field-grid';
import { cellFeatures, type CellFeatures } from './cell-features';
import { compass, describeSegment, describeZone } from './describe';

/** ponizej 0,5 ha strefy bylyby pojedynczymi pikselami - mowimy wprost, ze pole jest za male */
export const MIN_ZONES_AREA_HA = 0.5;
/** najmniejsza strefa: 0,05 ha (5 komorek 10 m) */
const MIN_ZONE_M2 = 500;
const MAX_SPECIAL_ZONES = 4;
const NARROW_WIDTH_M = 40;
const PROFILE_MIN_LENGTH_M = 200;
const SEGMENT_MAX_M = 100;
/** prog klasy komorki: srednie odchylenie sygnalow od reszty pola (w jednostkach rozrzutu) */
const CLASS_SCORE = 0.8;
const SEGMENT_SCORE = 0.5;
/** najmniejszy rozrzut, wzgledem ktorego liczymy odchylenie - jednorodne pole nie robi stref z szumu */
const NDMI_SPREAD_MIN = 0.03;
const WETNESS_SPREAD_MIN = 1;
const DEPRESSION_DEPTH_M = 0.1;
const NEAR_DITCH_M = 200;
const SLOPE_RELIEF_PCT = 3;
/** roznica wysokosci ponizej szumu modelu terenu (dziesiate czesci metra) nie robi z miejsca wzniesienia */
const RELIEF_MARGIN_M = 0.1;

type CellClass = 'dry' | 'wet' | 'typical';

const round = (value: number, digits = 2): number => Number(value.toFixed(digits));

const finite = (values: readonly number[]): number[] => values.filter((value) => Number.isFinite(value));

function mean(values: readonly number[]): number {
  const known = finite(values);

  return known.length === 0 ? Number.NaN : known.reduce((sum, value) => sum + value, 0) / known.length;
}

function quantile(values: readonly number[], q: number): number {
  const sorted = finite(values).toSorted((a, b) => a - b);

  if (sorted.length === 0) return Number.NaN;

  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))] ?? Number.NaN;
}

function spread(values: readonly number[], minimum: number): number {
  const known = finite(values);
  const average = mean(known);
  const variance = known.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, known.length);

  return Math.max(Math.sqrt(variance), minimum);
}

interface FieldStats {
  ndmiMedian: number;
  ndmiSpread: number;
  ndviMedian: number;
  wetnessMedian: number;
  wetnessSpread: number;
  elevationLow: number;
  elevationHigh: number;
}

function fieldStats(features: readonly CellFeatures[]): FieldStats {
  const ndmi = features.map((item) => item.ndmi);
  const wetness = features.map((item) => item.wetnessIndex);
  const elevation = features.map((item) => item.elevationM);

  return {
    ndmiMedian: quantile(ndmi, 0.5),
    ndmiSpread: spread(ndmi, NDMI_SPREAD_MIN),
    ndviMedian: quantile(
      features.map((item) => item.ndvi),
      0.5,
    ),
    wetnessMedian: quantile(wetness, 0.5),
    wetnessSpread: spread(wetness, WETNESS_SPREAD_MIN),
    elevationLow: quantile(elevation, 0.25),
    elevationHigh: quantile(elevation, 0.75),
  };
}

/** Odchylenie komorki od reszty pola: + wilgotniej, - suszej (srednia z dostepnych sygnalow, +1 w zaglebieniu). */
function moistureScore(item: CellFeatures, stats: FieldStats): number {
  const signals = [
    (item.ndmi - stats.ndmiMedian) / stats.ndmiSpread,
    (item.wetnessIndex - stats.wetnessMedian) / stats.wetnessSpread,
  ];
  const base = mean(signals);
  const depression = item.depressionDepthM >= DEPRESSION_DEPTH_M ? 1 : 0;

  return (Number.isFinite(base) ? base : 0) + depression;
}

/** Wygladzenie: komorka przyjmuje klase, ktora ma wiekszosc w jej sasiedztwie 3 x 3 (w granicach pola). */
function smooth(spec: GridSpec, labels: Map<number, CellClass>, passes = 2): Map<number, CellClass> {
  let current = labels;

  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Map(current);

    for (const [index, label] of current) {
      const row = Math.floor(index / spec.cols);
      const col = index % spec.cols;
      const votes = new Map<CellClass, number>();
      let total = 0;

      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const r = row + dr;
          const c = col + dc;
          const neighbour = r >= 0 && c >= 0 && c < spec.cols ? current.get(r * spec.cols + c) : undefined;

          if (neighbour) {
            votes.set(neighbour, (votes.get(neighbour) ?? 0) + 1);
            total += 1;
          }
        }
      }

      const [winner, count] = [...votes].toSorted((a, b) => b[1] - a[1])[0] ?? [label, 0];

      if (winner !== label && count * 2 > total) next.set(index, winner);
    }

    current = next;
  }

  return current;
}

/** Spojne obszary jednej klasy (sasiedztwo krawedziowe). */
function components(spec: GridSpec, labels: ReadonlyMap<number, CellClass>, wanted: CellClass): number[][] {
  const seen = new Set<number>();
  const found: number[][] = [];

  for (const [start, label] of labels) {
    if (label !== wanted || seen.has(start)) continue;

    const queue = [start];
    const part: number[] = [];

    seen.add(start);

    while (queue.length > 0) {
      const index = queue.pop() ?? start;
      const col = index % spec.cols;

      part.push(index);

      for (const next of [
        index - spec.cols,
        index + spec.cols,
        col > 0 ? index - 1 : -1,
        col < spec.cols - 1 ? index + 1 : -1,
      ]) {
        if (next >= 0 && !seen.has(next) && labels.get(next) === wanted) {
          seen.add(next);
          queue.push(next);
        }
      }
    }

    found.push(part);
  }

  return found;
}

interface Context {
  spec: GridSpec;
  byIndex: Map<number, { cell: GridCell; features: CellFeatures }>;
  stats: FieldStats;
  centre: [number, number];
  scaleM: number;
  totalCells: number;
}

/** Cechy wspolne stref i odcinkow: powierzchnia, udzial, obrys, srednie cechy, polozenie. */
function zoneOf(ctx: Context, id: string, kind: Zone['kind'], indices: readonly number[]): Zone {
  const { spec, stats } = ctx;
  const members = indices.flatMap((index) => {
    const item = ctx.byIndex.get(index);

    return item ? [item] : [];
  });
  const values = (key: keyof CellFeatures) => members.map(({ features }) => features[key]);
  const cellArea = spec.cellSizeM * spec.cellSizeM;
  const elevation = mean(values('elevationM'));
  const slope = mean(values('slopePct'));
  const wetness = mean(values('wetnessIndex'));
  const ndmi = mean(values('ndmi'));
  const ndvi = mean(values('ndvi'));
  const ditch = Math.min(...finite(values('ditchM')), Number.POSITIVE_INFINITY);
  const depthSum = finite(values('depressionDepthM')).reduce((sum, value) => sum + value, 0);
  const east = mean(members.map(({ cell }) => cell.easting));
  const north = mean(members.map(({ cell }) => cell.northing));
  const relief = !Number.isFinite(elevation)
    ? undefined
    : elevation > stats.elevationHigh + RELIEF_MARGIN_M
      ? 'hilltop'
      : elevation < stats.elevationLow - RELIEF_MARGIN_M
        ? 'hollow'
        : slope >= SLOPE_RELIEF_PCT
          ? 'slope'
          : 'flat';

  return {
    id,
    kind,
    areaHa: round((members.length * cellArea) / 10_000),
    share: round(members.length / ctx.totalCells),
    geometry: cellsOutline(spec, indices),
    position: compass(east - ctx.centre[0], north - ctx.centre[1], ctx.scaleM),
    ...(relief ? { relief } : {}),
    ...(Number.isFinite(elevation) ? { elevationM: round(elevation, 1) } : {}),
    ...(Number.isFinite(slope) ? { slopePct: round(slope, 1) } : {}),
    ...(Number.isFinite(wetness) ? { wetnessIndex: round(wetness, 1) } : {}),
    ...(Number.isFinite(ndmi) ? { ndmiDelta: round(ndmi - stats.ndmiMedian, 3) } : {}),
    ...(Number.isFinite(ndvi) ? { ndviDelta: round(ndvi - stats.ndviMedian, 3) } : {}),
    ...(ditch <= NEAR_DITCH_M ? { ditchDistanceM: Math.round(ditch) } : {}),
    ...(kind === 'depression' ? { volumeM3: Math.round(depthSum * cellArea) } : {}),
  };
}

function buildContext(
  spec: GridSpec,
  cells: readonly GridCell[],
  features: readonly CellFeatures[],
): Context {
  const byIndex = new Map(
    cells.map((cell, position) => [cell.index, { cell, features: features[position] as CellFeatures }]),
  );

  return {
    spec,
    byIndex,
    stats: fieldStats(features),
    centre: [mean(cells.map((cell) => cell.easting)), mean(cells.map((cell) => cell.northing))],
    scaleM: Math.sqrt(cells.length) * spec.cellSizeM,
    totalCells: cells.length,
  };
}

/** Strefy z komorek: 0-4 strefy szczegolne (suchsze, gromadzace wode, zaglebienia) i reszta pola jako "typowa". */
export function zonesFromCells(
  spec: GridSpec,
  cells: readonly GridCell[],
  features: readonly CellFeatures[],
): Pick<ZoneMap, 'zones' | 'reason'> {
  const ctx = buildContext(spec, cells, features);
  const raw = new Map<number, CellClass>(
    cells.map((cell, position) => {
      const score = moistureScore(features[position] as CellFeatures, ctx.stats);

      return [cell.index, score >= CLASS_SCORE ? 'wet' : score <= -CLASS_SCORE ? 'dry' : 'typical'];
    }),
  );
  const labels = smooth(spec, raw);
  const minCells = Math.ceil(MIN_ZONE_M2 / (spec.cellSizeM * spec.cellSizeM));
  const special = [
    ...components(spec, labels, 'dry').map((part) => ({ part, label: 'dry' as const })),
    ...components(spec, labels, 'wet').map((part) => ({ part, label: 'wet' as const })),
  ]
    .filter(({ part }) => part.length >= minCells)
    .toSorted((a, b) => b.part.length - a.part.length)
    .slice(0, MAX_SPECIAL_ZONES);
  const taken = new Set(special.flatMap(({ part }) => part));
  const rest = cells.map((cell) => cell.index).filter((index) => !taken.has(index));
  const zones = special.map(({ part, label }, position): Zone => {
    const depthCells = part.filter(
      (index) => (ctx.byIndex.get(index)?.features.depressionDepthM ?? 0) >= DEPRESSION_DEPTH_M,
    );
    const kind: Zone['kind'] =
      label === 'dry' ? 'drying' : depthCells.length * 2 >= part.length ? 'depression' : 'collecting';
    const zone = zoneOf(ctx, `zone-${position + 1}`, kind, part);

    return { ...zone, moisture: label === 'dry' ? 'drier' : 'wetter' };
  });

  if (rest.length > 0) {
    zones.push({ ...zoneOf(ctx, `zone-${zones.length + 1}`, 'typical', rest), moisture: 'typical' });
  }

  for (const zone of zones) zone.description = describeZone(zone);

  return {
    zones,
    ...(special.length === 0 ? { reason: 'uniform' as const } : {}),
  };
}

/** Os glowna zbioru komorek (PCA): kierunek, dlugosc wzdluz osi i srednia szerokosc. */
export function principalAxis(cells: readonly GridCell[], cellSizeM: number) {
  const me = mean(cells.map((cell) => cell.easting));
  const mn = mean(cells.map((cell) => cell.northing));
  let sxx = 0;
  let syy = 0;
  let sxy = 0;

  for (const cell of cells) {
    const dx = cell.easting - me;
    const dy = cell.northing - mn;

    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
  const along = cells.map((cell) => (cell.easting - me) * ux + (cell.northing - mn) * uy);
  const start = Math.min(...along);
  const lengthM = Math.max(...along) - start + cellSizeM;

  return {
    ux,
    uy,
    along: along.map((value) => value - start),
    lengthM,
    widthM: (cells.length * cellSizeM * cellSizeM) / lengthM,
  };
}

/** Profil podluzny waskiej dzialki: odcinki do 100 m wzdluz osi, kazdy z cechami i opisem. */
export function profileFromCells(
  spec: GridSpec,
  cells: readonly GridCell[],
  features: readonly CellFeatures[],
): Pick<ZoneMap, 'zones' | 'profileStart'> {
  const ctx = buildContext(spec, cells, features);
  const axis = principalAxis(cells, spec.cellSizeM);
  const count = Math.max(2, Math.ceil(axis.lengthM / SEGMENT_MAX_M));
  const step = axis.lengthM / count;
  const start = compass(-axis.ux, -axis.uy, 0);
  const segments = Array.from({ length: count }, (_unused, segment) =>
    cells.flatMap((cell, position) => {
      const at = Math.min(count - 1, Math.floor((axis.along[position] ?? 0) / step));

      return at === segment ? [position] : [];
    }),
  );
  const zones = segments.flatMap((positions, segment): Zone[] => {
    if (positions.length === 0) return [];

    const score = mean(
      positions.map((position) => moistureScore(features[position] as CellFeatures, ctx.stats)),
    );
    const base = zoneOf(
      ctx,
      `segment-${segment + 1}`,
      'segment',
      positions.map((position) => (cells[position] as GridCell).index),
    );
    const zone: Zone = {
      ...base,
      fromM: Math.round(segment * step),
      toM: Math.round((segment + 1) * step),
      moisture: score >= SEGMENT_SCORE ? 'wetter' : score <= -SEGMENT_SCORE ? 'drier' : 'typical',
    };

    return [{ ...zone, description: describeSegment(zone, start) }];
  });

  return { zones, profileStart: start };
}

/** Etap `zones`: strefy, profil albo uczciwy powod, dla ktorego ich nie ma; null bez zadnych danych przestrzennych. */
export function fieldZones(input: StageInput): ZoneMap | null {
  const { field, terrain, hydro, vegetation } = input;
  const raster = vegetation?.raster ?? null;

  if (!terrain && !raster) return null;

  const spec = fieldGrid(field.geometry, field.centroid[0], field.areaHa);

  if (gridTooLarge(spec)) {
    return { layout: 'zones', cellSizeM: spec.cellSizeM, cells: 0, zones: [], reason: 'scattered_parts' };
  }

  const cells = cellsInField(spec, field.geometry);
  const base = { cellSizeM: spec.cellSizeM, cells: cells.length };

  if (field.areaHa < MIN_ZONES_AREA_HA || cells.length < 2) {
    return { layout: 'zones', ...base, zones: [], reason: 'field_too_small' };
  }

  const { features, basis } = cellFeatures(spec, cells, { terrain: terrain?.grid ?? null, raster, hydro });
  const images = raster && basis.includes('vegetation') ? { imageFrom: raster.from, imageTo: raster.to } : {};
  const axis = principalAxis(cells, spec.cellSizeM);

  // waska dzialka dostaje odcinki takze bez cech komorek - sam podzial wzdluz osi przypina zalecenia do miejsc
  if (axis.widthM < NARROW_WIDTH_M && axis.lengthM > PROFILE_MIN_LENGTH_M) {
    return { layout: 'profile', ...base, basis, ...images, ...profileFromCells(spec, cells, features) };
  }

  if (!basis.includes('vegetation') && !basis.includes('terrain')) {
    return { layout: 'zones', ...base, zones: [], reason: 'no_spatial_data', basis };
  }

  return { layout: 'zones', ...base, basis, ...images, ...zonesFromCells(spec, cells, features) };
}

type Pick2 = (zones: readonly Zone[]) => Zone | undefined;

const largest = (zones: readonly Zone[]) => zones.toSorted((a, b) => b.areaHa - a.areaHa)[0];
const wetter: Pick2 = (zones) =>
  zones.find((zone) => zone.kind === 'depression') ??
  largest(zones.filter((zone) => zone.moisture === 'wetter'));
const drier: Pick2 = (zones) => largest(zones.filter((zone) => zone.moisture === 'drier'));
const steepest: Pick2 = (zones) =>
  zones
    .filter((zone) => (zone.slopePct ?? 0) >= 2)
    .toSorted((a, b) => (b.slopePct ?? 0) - (a.slopePct ?? 0))[0];
const byDitch: Pick2 = (zones) =>
  zones
    .filter((zone) => zone.ditchDistanceM !== undefined && zone.ditchDistanceM <= 50)
    .toSorted((a, b) => (a.ditchDistanceM ?? 0) - (b.ditchDistanceM ?? 0))[0];

/** Gdzie na polu dziala zalecenie: oczko w zaglebieniu, zastawka przy rowie, pas trawiasty na stoku, ... */
const WHERE: Partial<Record<MeasureId, Pick2>> = {
  small_pond: wetter,
  protect_wetland: wetter,
  ditch_weir: byDitch,
  grassed_waterway: (zones) => steepest(zones) ?? drier(zones),
  contour_farming: steepest,
  field_margin_trees: drier,
  organic_matter: drier,
  mulch_residue: drier,
  cover_crop: drier,
};

/** Strefa dla zalecenia albo null (cale pole), gdy podzialu nie ma albo zadna strefa nie pasuje. */
export function zoneForMeasure(measure: MeasureId, zoneMap: ZoneMap | null | undefined): string | null {
  const pick = WHERE[measure];

  if (!pick || !zoneMap || zoneMap.zones.length < 2) return null;

  return pick(zoneMap.zones)?.id ?? null;
}

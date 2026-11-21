// Pochodne modelu wysokosci dla pola (pakiet P4): spadek (metoda Horna), zaglebienia bezodplywowe z pojemnoscia
// (wypelnienie "priority flood", Barnes i in. 2014), splyw D8 i wskaznik wilgotnosci topograficznej
// TWI = ln(a / tg beta). Wszystko na siatce metrycznej wierszami od polnocnego zachodu; statystyki tylko z komorek
// pola (maska), ale splyw i zaglebienia licza sie na calej siatce z marginesem - woda doplywa spoza granicy.
import type { TerrainData, TerrainGrid } from '../analysis-ports';

/** rozdzielczosc danych wysokosci (EU-DEM / SRTM / GLO-30) - siatka obliczen moze byc gestsza, dane nie */
export const TERRAIN_MODEL_RESOLUTION_M = 30;
/** ponizej tylu komorek modelu w polu spadek i zaglebienia sa tylko przyblizeniem */
const MIN_MODEL_CELLS = 25;

/** Czy pole jest za male na model 30 m (ok. 2,25 ha = 25 komorek) - raport mowi wtedy `terrain_coarse`. */
export function terrainTooCoarse(areaHa: number): boolean {
  return (areaHa * 10_000) / TERRAIN_MODEL_RESOLUTION_M ** 2 < MIN_MODEL_CELLS;
}

/** zaglebienie plytsze niz tyle (m) to szum modelu (kwantyzacja, interpolacja), nie miejsce, gdzie stoi woda */
export const MIN_DEPRESSION_DEPTH_M = 0.1;
/** stok, z ktorego woda splywa po powierzchni szybciej, niz wsiaka (%) */
export const STEEP_SLOPE_PCT = 5;
/** najmniejszy spadek do TWI - na plaskim tg beta = 0 dawaloby nieskonczonosc */
const MIN_TAN_BETA = 0.001;
/** spadek wymuszany przy wypelnianiu, zeby z plaskich den woda miala dokad splynac (m) */
const FLAT_EPSILON_M = 1e-4;

const NEIGHBOURS: readonly [dx: number, dy: number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

const cell = (grid: TerrainGrid, col: number, row: number): number =>
  grid.elevationM[row * grid.cols + col] ?? 0;

/** Wysokosc komorki; o jedna komorke poza siatka - ekstrapolacja liniowa (dokladna dla plaszczyzny). */
function at(grid: TerrainGrid, col: number, row: number): number {
  const inward = (value: number, size: number) => (value < 0 ? 1 : value >= size ? -1 : 0);
  const dc = inward(col, grid.cols);
  const dr = inward(row, grid.rows);
  const c = col + dc;
  const r = row + dr;

  if (dc === 0 && dr === 0) return cell(grid, c, r);

  const further = cell(
    grid,
    Math.min(Math.max(c + dc, 0), grid.cols - 1),
    Math.min(Math.max(r + dr, 0), grid.rows - 1),
  );

  return 2 * cell(grid, c, r) - further;
}

/** Spadek kazdej komorki w procentach (Horn 1981; na brzegu siatki ekstrapolacja liniowa). */
export function slopePercent(grid: TerrainGrid): number[] {
  const size = grid.cellSizeM;

  return grid.elevationM.map((_value, index) => {
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    const z = (dx: number, dy: number) => at(grid, col + dx, row + dy);
    const dzdx = (z(1, -1) + 2 * z(1, 0) + z(1, 1) - (z(-1, -1) + 2 * z(-1, 0) + z(-1, 1))) / (8 * size);
    const dzdy = (z(-1, 1) + 2 * z(0, 1) + z(1, 1) - (z(-1, -1) + 2 * z(0, -1) + z(1, -1))) / (8 * size);

    return Math.hypot(dzdx, dzdy) * 100;
  });
}

/** Kopiec binarny (najnizsza wysokosc na wierzchu) dla wypelniania zaglebien. */
class MinHeap {
  private readonly items: [priority: number, index: number][] = [];

  get size(): number {
    return this.items.length;
  }

  push(priority: number, index: number): void {
    const items = this.items;

    items.push([priority, index]);

    let child = items.length - 1;

    while (child > 0) {
      const parent = (child - 1) >> 1;
      const [up, down] = [items[parent], items[child]];

      if (!up || !down || up[0] <= down[0]) break;

      items[parent] = down;
      items[child] = up;
      child = parent;
    }
  }

  pop(): [number, number] | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();

    if (!top || !last || items.length === 0) return top;

    items[0] = last;

    let parent = 0;

    for (;;) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let smallest = parent;

      if ((items[left]?.[0] ?? Infinity) < (items[smallest]?.[0] ?? Infinity)) smallest = left;

      if ((items[right]?.[0] ?? Infinity) < (items[smallest]?.[0] ?? Infinity)) smallest = right;

      if (smallest === parent) break;

      const [a, b] = [items[parent], items[smallest]];

      if (!a || !b) break;

      items[parent] = b;
      items[smallest] = a;
      parent = smallest;
    }

    return top;
  }
}

/**
 * Powierzchnia z wypelnionymi zaglebieniami: woda z kazdej komorki moze odplynac do brzegu siatki. `epsilon` > 0
 * dodaje minimalny spadek na wypelnionych dnach (do splywu D8); do pojemnosci zaglebien liczymy z `epsilon` = 0.
 */
export function fillDepressions(grid: TerrainGrid, epsilon = 0): number[] {
  const { cols, rows } = grid;
  const filled = [...grid.elevationM];
  const done = new Uint8Array(cols * rows);
  const heap = new MinHeap();

  for (let index = 0; index < cols * rows; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);

    if (col === 0 || row === 0 || col === cols - 1 || row === rows - 1) {
      done[index] = 1;
      heap.push(filled[index] ?? 0, index);
    }
  }

  while (heap.size > 0) {
    const [level = 0, index = 0] = heap.pop() ?? [];
    const col = index % cols;
    const row = Math.floor(index / cols);

    for (const [dx, dy] of NEIGHBOURS) {
      const c = col + dx;
      const r = row + dy;
      const next = r * cols + c;

      if (c < 0 || r < 0 || c >= cols || r >= rows || done[next] === 1) continue;

      done[next] = 1;
      filled[next] = Math.max(filled[next] ?? 0, level + epsilon);
      heap.push(filled[next] ?? 0, next);
    }
  }

  return filled;
}

export interface Depression {
  /** komorki zaglebienia (indeksy siatki) */
  cells: number[];
  areaM2: number;
  /** ile wody zmiesci sie do poziomu przelewu (m3) */
  volumeM3: number;
  maxDepthM: number;
}

/** Zaglebienia bezodplywowe: spojne obszary, gdzie wypelnienie podnosi teren o co najmniej `minDepthM` w dnie. */
export function findDepressions(grid: TerrainGrid, minDepthM = MIN_DEPRESSION_DEPTH_M): Depression[] {
  const { cols, rows, cellSizeM } = grid;
  const filled = fillDepressions(grid);
  const depth = filled.map((value, index) => value - (grid.elevationM[index] ?? value));
  const seen = new Uint8Array(cols * rows);
  const found: Depression[] = [];

  for (let start = 0; start < cols * rows; start += 1) {
    if (seen[start] === 1 || (depth[start] ?? 0) <= 1e-6) continue;

    const cells: number[] = [];
    const stack = [start];

    seen[start] = 1;

    while (stack.length > 0) {
      const index = stack.pop() ?? 0;
      const col = index % cols;
      const row = Math.floor(index / cols);

      cells.push(index);

      for (const [dx, dy] of NEIGHBOURS) {
        const c = col + dx;
        const r = row + dy;
        const next = r * cols + c;

        if (c < 0 || r < 0 || c >= cols || r >= rows || seen[next] === 1 || (depth[next] ?? 0) <= 1e-6)
          continue;

        seen[next] = 1;
        stack.push(next);
      }
    }

    const maxDepthM = Math.max(...cells.map((index) => depth[index] ?? 0));

    if (maxDepthM < minDepthM) continue;

    found.push({
      cells,
      areaM2: cells.length * cellSizeM * cellSizeM,
      volumeM3: cells.reduce((sum, index) => sum + (depth[index] ?? 0), 0) * cellSizeM * cellSizeM,
      maxDepthM,
    });
  }

  return found.toSorted((a, b) => b.volumeM3 - a.volumeM3);
}

/** Splyw D8 po powierzchni z wypelnionymi zaglebieniami: ile komorek (z soba) odprowadza wode przez kazda komorke. */
export function flowAccumulation(grid: TerrainGrid): number[] {
  const { cols, rows, cellSizeM } = grid;
  const surface = fillDepressions(grid, FLAT_EPSILON_M);
  const accumulation = Array.from({ length: cols * rows }, () => 1);
  const order = surface
    .map((_value, index) => index)
    .toSorted((a, b) => (surface[b] ?? 0) - (surface[a] ?? 0));

  for (const index of order) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    let target = -1;
    let steepest = 0;

    for (const [dx, dy] of NEIGHBOURS) {
      const c = col + dx;
      const r = row + dy;

      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;

      const next = r * cols + c;
      const drop = ((surface[index] ?? 0) - (surface[next] ?? 0)) / (cellSizeM * Math.hypot(dx, dy));

      if (drop > steepest) {
        steepest = drop;
        target = next;
      }
    }

    if (target >= 0) accumulation[target] = (accumulation[target] ?? 0) + (accumulation[index] ?? 0);
  }

  return accumulation;
}

/** Wskaznik wilgotnosci topograficznej: ln(powierzchnia zlewni na metr szerokosci / tg spadku). */
export function wetnessIndex(grid: TerrainGrid): number[] {
  const slopes = slopePercent(grid);
  const accumulation = flowAccumulation(grid);

  return accumulation.map((cells, index) => {
    const specificArea = cells * grid.cellSizeM;
    const tanBeta = Math.max((slopes[index] ?? 0) / 100, MIN_TAN_BETA);

    return Math.log(specificArea / tanBeta);
  });
}

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

/** Statystyki terenu pola: komorki z maski (`inField[i]`), zaglebienia i splyw z calej siatki. */
export function summarizeTerrain(grid: TerrainGrid, inField: readonly boolean[]): TerrainData['summary'] {
  const field = grid.elevationM.flatMap((_value, index) => (inField[index] ? [index] : []));
  const cells = field.length > 0 ? field : grid.elevationM.map((_value, index) => index);
  const slopes = slopePercent(grid);
  const wetness = wetnessIndex(grid);
  const elevations = cells.map((index) => grid.elevationM[index] ?? 0);
  const fieldSlopes = cells.map((index) => slopes[index] ?? 0);
  const inFieldSet = new Set(cells);
  // zaglebienie liczy sie dla pola, gdy jego dno albo czesc lezy w polu; pojemnosc tylko z komorek pola
  const depressions = findDepressions(grid)
    .map((depression) => {
      const inside = depression.cells.filter((index) => inFieldSet.has(index));
      const share = inside.length / depression.cells.length;

      return {
        inside: inside.length,
        volumeM3: depression.volumeM3 * share,
        maxDepthM: depression.maxDepthM,
      };
    })
    .filter((depression) => depression.inside > 0);
  const largest = depressions.at(0);

  return {
    elevationMinM: round(Math.min(...elevations), 2),
    elevationMaxM: round(Math.max(...elevations), 2),
    slopeMeanPct: round(fieldSlopes.reduce((sum, value) => sum + value, 0) / cells.length),
    slopeShareAbove5Pct: round(
      fieldSlopes.filter((value) => value > STEEP_SLOPE_PCT).length / cells.length,
      2,
    ),
    depressions: depressions.length,
    depressionVolumeM3: Math.round(depressions.reduce((sum, depression) => sum + depression.volumeM3, 0)),
    ...(largest
      ? {
          largestDepression: {
            areaM2: Math.round(largest.inside * grid.cellSizeM * grid.cellSizeM),
            volumeM3: Math.round(largest.volumeM3),
            maxDepthM: round(largest.maxDepthM, 2),
          },
        }
      : {}),
    wetnessIndexMean: round(cells.reduce((sum, index) => sum + (wetness[index] ?? 0), 0) / cells.length),
    cellSizeM: round(grid.cellSizeM),
  };
}

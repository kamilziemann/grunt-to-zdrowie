// Tryb "wlasne pole" (D3) na mapie dzialek: rysowanie obszaru stuknieciami albo podzial jednej dzialki linia i wybor
// czesci. Stan to tylko punkty stukniete na mapie; obrys, pole powierzchni, bledy i warstwa mapy wynikaja z niego
// (`deriveFieldDraw` - czysta funkcja, testowana bez mapy).
import type { ParcelGeometry } from '@app/contracts';
import { useCallback, useMemo, useState } from 'react';

import {
  encodeRing,
  FIELD_LIMITS,
  isSimpleRing,
  outerRing,
  ringAreaM2,
  ringBbox,
  splitByLine,
  type Position,
} from '@/lib/field-geometry';

export type FieldDrawMode = 'draw' | 'split';

export type FieldDrawIssue = 'needMore' | 'selfIntersecting' | 'lineMissing' | 'lineOutside' | null;

/** Dzialka do podzialu linia (jedyna na liscie). */
export interface SplitTarget {
  id: string;
  number: string;
  geometry: ParcelGeometry;
}

export interface FieldDrawOverlay {
  /** obszary: wybrany (do analizy), druga czesc dzialki, szkic rysowanego obrysu */
  areas: { ring: Position[]; role: 'chosen' | 'other' | 'draft' }[];
  /** linia podzialu albo otwarty szkic obrysu */
  line: Position[] | null;
  points: Position[];
}

/** Wynik do analizy: obrys w adresie (`obszar`), rodzaj pola i dzialki, z ktorych go wycieto. */
export interface FieldDrawArea {
  obszar: string;
  rodzaj: 'part' | 'drawn';
  parcelIds: string[];
  areaHa: number;
  bbox: [number, number, number, number];
}

export interface FieldDrawDerived {
  issue: FieldDrawIssue;
  /** ile punktow brakuje do zamkniecia obszaru */
  missingPoints: number;
  /** pole biezacego obszaru w ha (rysowanie: szkic od 3 punktow; podzial: wybrana czesc) */
  areaHa: number | null;
  /** pola obu czesci przy podziale */
  partsHa: [number, number] | null;
  /** obrysy obu czesci przy podziale (w kolejnosci A, B) - stukniecie w czesc ja wybiera */
  partRings: [Position[], Position[]] | null;
  overlay: FieldDrawOverlay;
  area: FieldDrawArea | null;
}

const SQUARE_METERS_PER_HECTARE = 10_000;

export function deriveFieldDraw(
  mode: FieldDrawMode,
  points: readonly Position[],
  part: 0 | 1,
  target: SplitTarget | null,
): FieldDrawDerived {
  const pointsCopy = [...points];

  if (mode === 'draw') {
    const missing = Math.max(0, FIELD_LIMITS.minVertices - points.length);
    const simple = missing === 0 && isSimpleRing(points);
    const areaHa = missing === 0 ? ringAreaM2(points) / SQUARE_METERS_PER_HECTARE : null;
    let issue: FieldDrawIssue = null;

    if (missing > 0) issue = 'needMore';
    else if (!simple) issue = 'selfIntersecting';

    return {
      issue,
      missingPoints: missing,
      areaHa,
      partsHa: null,
      partRings: null,
      overlay: {
        areas: missing === 0 ? [{ ring: pointsCopy, role: simple ? 'chosen' : 'draft' }] : [],
        line: points.length >= 2 ? pointsCopy : null,
        points: pointsCopy,
      },
      area:
        issue === null && areaHa !== null
          ? {
              obszar: encodeRing(points),
              rodzaj: 'drawn',
              parcelIds: [],
              areaHa,
              bbox: ringBbox(points),
            }
          : null,
    };
  }

  const ring = target ? outerRing(target.geometry) : null;
  const [a, b] = points;
  const parts = ring && a && b ? splitByLine(ring, a, b) : null;
  const line = a && b ? [a, b] : null;
  let issue: FieldDrawIssue = null;

  if (!a || !b) issue = 'lineMissing';
  else if (!parts) issue = 'lineOutside';

  if (!parts || !target) {
    return {
      issue,
      missingPoints: 0,
      areaHa: null,
      partsHa: null,
      partRings: null,
      overlay: { areas: [], line, points: pointsCopy },
      area: null,
    };
  }

  const chosen = parts[part];
  const other = parts[part === 0 ? 1 : 0];
  const partsHa: [number, number] = [
    ringAreaM2(parts[0]) / SQUARE_METERS_PER_HECTARE,
    ringAreaM2(parts[1]) / SQUARE_METERS_PER_HECTARE,
  ];

  return {
    issue: null,
    missingPoints: 0,
    areaHa: partsHa[part],
    partsHa,
    partRings: [parts[0], parts[1]],
    overlay: {
      areas: [
        { ring: other, role: 'other' },
        { ring: chosen, role: 'chosen' },
      ],
      line,
      points: pointsCopy,
    },
    area: {
      obszar: encodeRing(chosen),
      rodzaj: 'part',
      parcelIds: [target.id],
      areaHa: partsHa[part],
      bbox: ringBbox(chosen),
    },
  };
}

/** Czy punkt lezy wewnatrz pierscienia (promien w prawo, parzystosc przeciec). */
export function insideRing([x, y]: Position, ring: readonly Position[]): boolean {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi = 0, yi = 0] = ring[index] ?? [];
    const [xj = 0, yj = 0] = ring[previous] ?? [];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }

  return inside;
}

export interface FieldDraw extends FieldDrawDerived {
  mode: FieldDrawMode | null;
  points: readonly Position[];
  part: 0 | 1;
  start: (mode: FieldDrawMode) => void;
  stop: () => void;
  addPoint: (lng: number, lat: number) => void;
  undo: () => void;
  clear: () => void;
  choosePart: (part: 0 | 1) => void;
}

/** Stan trybu "wlasne pole"; `target` = dzialka do podzialu (null = podzial niedostepny). */
export function useFieldDraw(target: SplitTarget | null): FieldDraw {
  const [mode, setMode] = useState<FieldDrawMode | null>(null);
  const [points, setPoints] = useState<Position[]>([]);
  const [part, setPart] = useState<0 | 1>(0);

  const start = useCallback((next: FieldDrawMode) => {
    setMode(next);
    setPoints([]);
    setPart(0);
  }, []);
  const stop = useCallback(() => {
    setMode(null);
    setPoints([]);
  }, []);
  const undo = useCallback(() => setPoints((current) => current.slice(0, -1)), []);
  const clear = useCallback(() => setPoints([]), []);

  const derived = useMemo(
    () => deriveFieldDraw(mode ?? 'draw', points, part, target),
    [mode, points, part, target],
  );
  const { partRings } = derived;
  const addPoint = useCallback(
    (lng: number, lat: number) => {
      // linia podzialu gotowa: stukniecie w czesc dzialki wybiera ja, stukniecie obok zaczyna nowa linie
      const tapped = partRings?.findIndex((ring) => insideRing([lng, lat], ring)) ?? -1;

      if (mode === 'split' && (tapped === 0 || tapped === 1)) {
        setPart(tapped);

        return;
      }

      setPoints((current) => {
        if (mode === 'split') return current.length >= 2 ? [[lng, lat]] : [...current, [lng, lat]];

        return current.length >= FIELD_LIMITS.maxVertices ? current : [...current, [lng, lat]];
      });
    },
    [mode, partRings],
  );

  return { ...derived, mode, points, part, start, stop, addPoint, undo, clear, choosePart: setPart };
}

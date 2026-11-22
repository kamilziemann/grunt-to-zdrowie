import type { ParcelGeometry } from '@app/contracts';
import { useMemo } from 'react';

const VIEW = 100;
const PADDING = 12;
const DEGREE = Math.PI / 180;

/**
 * Sciezka SVG obrysow zewnetrznych w polu `VIEW` x `VIEW` (z marginesem), w lokalnym rzucie rownoodleglosciowym:
 * dlugosc skrocona o cos(szerokosci), zeby ksztalt zgadzal sie z mapa. Pusta, gdy nie ma czego rysowac.
 */
export function outlinePath(geometries: readonly ParcelGeometry[]): string {
  const rings = geometries.flatMap((geometry) =>
    (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).flatMap(([outer]) =>
      outer && outer.length > 2 ? [outer] : [],
    ),
  );
  const points = rings.flat();

  if (points.length === 0) return '';

  const latitude = points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const scaleX = Math.cos(latitude * DEGREE);
  const xs = points.map(([lng]) => lng * scaleX);
  const ys = points.map(([, lat]) => lat);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  const span = Math.max(Math.max(...xs) - minX, maxY - Math.min(...ys)) || 1;
  const size = VIEW - 2 * PADDING;
  const offsetX = PADDING + (size - ((Math.max(...xs) - minX) / span) * size) / 2;
  const offsetY = PADDING + (size - ((maxY - Math.min(...ys)) / span) * size) / 2;
  const toPoint = ([lng = 0, lat = 0]: readonly number[]) =>
    `${(offsetX + ((lng * scaleX - minX) / span) * size).toFixed(2)},${(offsetY + ((maxY - lat) / span) * size).toFixed(2)}`;

  return rings.map((ring) => `M${ring.map(toPoint).join('L')}Z`).join('');
}

/**
 * Obrys dzialki rysowany od razu z geometrii (lekki SVG), zanim wczyta sie mapa: rolnik widzi ksztalt pola zamiast
 * pustego tla. Kolory jak zaznaczenie na mapie.
 */
export function ParcelOutline({ geometries }: { geometries: readonly ParcelGeometry[] }) {
  const path = useMemo(() => outlinePath(geometries), [geometries]);

  if (!path) return null;

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      aria-hidden="true"
      className="absolute inset-0 size-full"
      data-testid="parcel-outline"
    >
      <path
        d={path}
        className="fill-(--map-selected)/15 stroke-(--map-selected)"
        strokeWidth={3}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

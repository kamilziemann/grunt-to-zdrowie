// Parametry adresu ekranu mapy (`/mapa`): lista "moje dzialki", widok do pokazania (adres wybrany na stronie glownej)
// i tryb "wlasne pole" otwierany z kroku "Czy to Twoja dzialka?". Uszkodzone wartosci = jak bez parametru.
import { parcelSelectionSearchSchema } from '@app/contracts';
import { z } from 'zod';

import type { FieldDrawMode } from '../hooks/use-field-draw';

/** Tryb rysowania w adresie (slowa po polsku, jak reszta parametrow). */
export const MAP_DRAW_PARAM = { podziel: 'split', rysuj: 'draw' } as const satisfies Record<
  string,
  FieldDrawMode
>;

export const mapSearchSchema = parcelSelectionSearchSchema.extend({
  /** prostokat do pokazania: `zachod,poludnie,wschod,polnoc` (stopnie) */
  widok: z.string().max(100).optional().catch(undefined),
  rysuj: z.enum(['podziel', 'rysuj']).optional().catch(undefined),
});

export type MapSearch = z.infer<typeof mapSearchSchema>;

export type MapBbox = [number, number, number, number];

/** Prostokat z parametru `widok`; null, gdy brak albo zly zapis (4 liczby, zachod < wschod, poludnie < polnoc). */
export function parseMapView(value: string | undefined): MapBbox | null {
  if (!value) return null;

  const parts = value.split(',').map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;

  const [west = 0, south = 0, east = 0, north = 0] = parts;

  if (west >= east || south >= north) return null;

  return [west, south, east, north];
}

/** Zapis prostokata do adresu (6 miejsc po przecinku = ok. 10 cm). */
export function formatMapView(bbox: readonly [number, number, number, number]): string {
  return bbox.map((value) => value.toFixed(6)).join(',');
}

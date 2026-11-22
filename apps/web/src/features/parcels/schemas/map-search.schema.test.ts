import { describe, expect, it } from 'vitest';

import { formatMapView, mapSearchSchema, parseMapView } from './map-search.schema';

describe('parametry ekranu mapy', () => {
  it('odczytuje widok zapisany przez formatMapView', () => {
    const bbox = [19.1, 52.2, 19.3, 52.4] as const;

    expect(parseMapView(formatMapView(bbox))).toEqual([19.1, 52.2, 19.3, 52.4]);
  });

  it.each(['', '1,2,3', 'a,b,c,d', '19.3,52.2,19.1,52.4', '19.1,52.4,19.3,52.2'])(
    'odrzuca zly widok %s',
    (value) => {
      expect(parseMapView(value)).toBeNull();
    },
  );

  it('nieznany tryb rysowania to brak trybu', () => {
    expect(mapSearchSchema.parse({ rysuj: 'kolo' }).rysuj).toBeUndefined();
    expect(mapSearchSchema.parse({ rysuj: 'podziel' }).rysuj).toBe('podziel');
  });
});

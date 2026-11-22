// Testy przelacznika podkladu mapy: dwa przyciski, wcisniety = aktualny podklad, klikniecie zglasza zmiane.
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import type { MapLayers } from '../../schemas/map-layers.schema';
import { BasemapSwitch } from './basemap-switch';

type OnChange = (patch: Partial<MapLayers>) => void;

describe('BasemapSwitch', () => {
  it('pokazuje aktualny podklad jako wcisniety przycisk', () => {
    renderWithIntl(<BasemapSwitch value="map" onChange={vi.fn<OnChange>()} />);

    expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Zdjęcie lotnicze' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('klikniecie zglasza wybrany podklad', () => {
    const onChange = vi.fn<OnChange>();

    renderWithIntl(<BasemapSwitch value="map" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zdjęcie lotnicze' }));

    expect(onChange).toHaveBeenCalledWith({ basemap: 'ortho' });
  });
});

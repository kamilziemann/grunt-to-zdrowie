import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { MapZoomLocate } from './map-rail';

const controls = { zoomIn: vi.fn<() => void>(), zoomOut: vi.fn<() => void>(), locate: vi.fn<() => void>() };

describe('MapZoomLocate', () => {
  it('zanim mapa się wczyta, przyciski są nieaktywne', () => {
    renderWithIntl(<MapZoomLocate controls={null} locate="idle" />);

    expect(screen.getByRole('button', { name: 'Przybliż' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Oddal' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Gdzie jestem' })).toBeDisabled();
  });

  it('woła polecenia mapy; podpis „Gdzie jestem” jest nazwą, pełny opis w dymku', () => {
    renderWithIntl(<MapZoomLocate controls={controls} locate="denied" />);

    fireEvent.click(screen.getByRole('button', { name: 'Przybliż' }));
    fireEvent.click(screen.getByRole('button', { name: 'Oddal' }));

    const locate = screen.getByRole('button', { name: 'Gdzie jestem' });

    fireEvent.click(locate);

    expect(controls.zoomIn).toHaveBeenCalledOnce();
    expect(controls.zoomOut).toHaveBeenCalledOnce();
    expect(controls.locate).toHaveBeenCalledOnce();
    expect(locate).toHaveAttribute('title', 'Pokaż moje położenie');
    expect(locate).toHaveAttribute('data-locate-state', 'denied');
  });
});

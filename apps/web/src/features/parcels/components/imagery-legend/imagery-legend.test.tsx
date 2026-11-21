import type { VegetationImagery } from '@app/contracts';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { ImageryLegend } from './imagery-legend';

const DATA: VegetationImagery = {
  layer: 'moisture',
  images: [],
  bbox: [21.58, 52.17, 21.59, 52.18],
  requestedDate: '2018-06-15',
  sceneDate: '2018-05-29',
  sceneCloudCover: 12,
  clearShare: 0.7,
  scale: { low: -0.05, high: 0.31, mean: 0.14 },
};

const noop = () => undefined;

describe('ImageryLegend', () => {
  it('zwinięta domyślnie; skala słowami, dzień zdjęcia, chmury i ograniczenia drobnym drukiem', () => {
    const { container } = renderWithIntl(
      <ImageryLegend layer="moisture" state="ready" data={DATA} requestedDate="2018-06-15" onRetry={noop} />,
    );

    expect(container.querySelector('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Legenda: woda w roślinach')).toBeInTheDocument();
    expect(screen.getByText('sucho')).toBeInTheDocument();
    expect(screen.getByText('wilgotno')).toBeInTheDocument();
    expect(screen.getByText('Zdjęcie satelitarne z 29 maja 2018.')).toBeInTheDocument();
    expect(screen.getByText(/pod chmurą/)).toBeInTheDocument();
    expect(screen.getByText('„Woda w roślinach” to wilgotność roślin, nie gleby.')).toBeInTheDocument();
    expect(screen.getByText(/NDMI z Sentinel-2.*-0,05–0,31/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('kondycja roślin bez zdania o wilgotności; stany widoczne także po zwinięciu', () => {
    const { rerender } = renderWithIntl(
      <ImageryLegend
        layer="condition"
        state="loading"
        data={null}
        requestedDate="2018-06-15"
        onRetry={noop}
      />,
    );

    expect(screen.getByText('słabiej')).toBeInTheDocument();
    expect(screen.queryByText(/nie gleby/)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('do kilkunastu sekund');

    rerender(
      <ImageryLegend
        layer="condition"
        state="noClearScene"
        data={null}
        requestedDate="2018-01-31"
        onRetry={noop}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('przez 30 dni przed 31 stycznia 2018');
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).toBeNull();
  });

  it('limit albo awaria Copernicus: komunikat i „Spróbuj ponownie”', () => {
    const retry = vi.fn<() => void>();

    renderWithIntl(
      <ImageryLegend layer="condition" state="busy" data={null} requestedDate="2018-06-15" onRetry={retry} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Copernicus');
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

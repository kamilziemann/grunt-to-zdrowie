import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { MapLegends } from './map-legends';

const READY = { state: 'ready', importedAt: null, truncated: false } as const;
const STATUSES = { cover: READY, waterworks: READY, protected: READY };
const ENABLED = { cover: true, waterworks: false, protected: false };
const noop = () => undefined;

describe('MapLegends', () => {
  it('pokazuje tylko wlaczone legendy, wszystkie zwiniete i w jednej grupie (jedna rozwinieta naraz)', () => {
    const { container } = renderWithIntl(
      <MapLegends
        hydroStatus={READY}
        contextEnabled={ENABLED}
        contextStatuses={STATUSES}
        imageryLayer="moisture"
        imageryState="ready"
        imageryData={null}
        imageryRequestedDate="2026-06-15"
        onImageryRetry={noop}
      />,
    );
    const details = [...container.querySelectorAll('details')];
    const [first] = details;

    expect(details).toHaveLength(3);
    expect(details.every((item) => !item.open)).toBe(true);
    expect(first?.getAttribute('name')).toBeTruthy();
    expect(new Set(details.map((item) => item.getAttribute('name'))).size).toBe(1);
  });

  it('bez wlaczonych warstw nic nie rysuje', () => {
    const { container } = renderWithIntl(
      <MapLegends
        hydroStatus={null}
        contextEnabled={null}
        contextStatuses={STATUSES}
        imageryLayer={null}
        imageryState="off"
        imageryData={null}
        imageryRequestedDate="2026-06-15"
        onImageryRetry={noop}
      />,
    );

    expect(screen.queryByRole('group')).toBeNull();
    expect(container.querySelector('details')).toBeNull();
  });
});

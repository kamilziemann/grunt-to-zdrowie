// Testy wspolnego podswietlenia miejsca: klikniecie zaznacza, ponowne klikniecie tego samego miejsca odznacza.
import { fireEvent, render, screen } from '@testing-library/react';
import { useCallback } from 'react';
import { describe, expect, it } from 'vitest';

import { useZoneFocus, ZoneFocusProvider } from './zone-focus';

function Probe({ zoneId }: { zoneId: string }) {
  const { active, toggle } = useZoneFocus();
  const select = useCallback(() => toggle(zoneId), [toggle, zoneId]);

  return (
    <button type="button" onClick={select}>
      {zoneId}: {active === zoneId ? 'zaznaczone' : 'niezaznaczone'}
    </button>
  );
}

describe('ZoneFocusProvider', () => {
  it('drugie klikniecie tego samego miejsca zdejmuje wyroznienie', () => {
    render(
      <ZoneFocusProvider>
        <Probe zoneId="zone-1" />
        <Probe zoneId="zone-2" />
      </ZoneFocusProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /zone-1/ }));
    expect(screen.getByRole('button', { name: 'zone-1: zaznaczone' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /zone-1/ }));
    expect(screen.getByRole('button', { name: 'zone-1: niezaznaczone' })).toBeInTheDocument();
  });

  it('klikniecie innego miejsca przenosi wyroznienie', () => {
    render(
      <ZoneFocusProvider>
        <Probe zoneId="zone-1" />
        <Probe zoneId="zone-2" />
      </ZoneFocusProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /zone-1/ }));
    fireEvent.click(screen.getByRole('button', { name: /zone-2/ }));

    expect(screen.getByRole('button', { name: 'zone-1: niezaznaczone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'zone-2: zaznaczone' })).toBeInTheDocument();
  });
});

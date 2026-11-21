// ConfirmDialog: okno kontroluje rodzic. Potwierdzenie wola tylko onConfirm (okno zamyka rodzic po mutacji),
// anulowanie i Escape tylko zamykaja, a w trakcie mutacji (`pending`) zaden przycisk nie dziala.
import { fireEvent, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithIntl, translator } from '@/test/render-intl';

import { ConfirmDialog } from './confirm-dialog';

const t = translator('common');

function renderDialog(props: Partial<ComponentProps<typeof ConfirmDialog>> = {}) {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onConfirm = vi.fn<() => void>();

  renderWithIntl(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Usunac dzialke z listy?"
      description="Tej operacji nie da sie cofnac."
      {...props}
    />,
  );

  return { onOpenChange, onConfirm };
}

describe('ConfirmDialog', () => {
  it('zamkniete okno nic nie rysuje', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('okno ma tytul jako nazwe, opis i domyslne etykiety przyciskow', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Usunac dzialke z listy?' });

    expect(dialog).toHaveAccessibleDescription('Tej operacji nie da sie cofnac.');
    expect(screen.getByRole('button', { name: t('cancel') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('confirm') })).toBeInTheDocument();
  });

  it('bez opisu nie rysuje pustego akapitu opisu', () => {
    renderDialog({ description: undefined });

    expect(screen.getByRole('dialog').querySelector('p')).toBeNull();
  });

  it('potwierdzenie wola onConfirm i nie zamyka okna samo', () => {
    const { onConfirm, onOpenChange } = renderDialog({ confirmLabel: 'Usun', cancelLabel: 'Zostaw' });

    fireEvent.click(screen.getByRole('button', { name: 'Usun' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('anulowanie zamyka okno bez potwierdzenia', () => {
    const { onConfirm, onOpenChange } = renderDialog({ cancelLabel: 'Zostaw' });

    fireEvent.click(screen.getByRole('button', { name: 'Zostaw' }));

    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape zamyka okno bez potwierdzenia', () => {
    const { onConfirm, onOpenChange } = renderDialog();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('w trakcie mutacji oba przyciski sa wylaczone', () => {
    const { onConfirm, onOpenChange } = renderDialog({ pending: true });
    const confirm = screen.getByRole('button', { name: t('confirm') });
    const cancel = screen.getByRole('button', { name: t('cancel') });

    fireEvent.click(confirm);
    fireEvent.click(cancel);

    expect(confirm).toBeDisabled();
    expect(cancel).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it.each([
    [true, 'ma'],
    [false, 'nie ma'],
  ])('destructive=%s: przycisk potwierdzenia %s koloru akcji nieodwracalnej', (destructive) => {
    renderDialog({ destructive });

    const confirm = screen.getByRole('button', { name: t('confirm') });

    expect(confirm.classList.contains('bg-destructive')).toBe(destructive);
  });
});

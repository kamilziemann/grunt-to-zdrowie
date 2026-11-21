// Blad poziomu dokumentu (port app/error-boundaries.test.tsx, „globalna”): widok bez dostawcy use-intl, jezyk z adresu,
// a „Sprobuj ponownie” uruchamia loadery od nowa (`router.invalidate`).
import type * as TanstackRouter from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentError } from './document-fallbacks';

const invalidate = vi.hoisted(() => vi.fn<() => Promise<void>>(() => Promise.resolve()));
const pathname = vi.hoisted(() => ({ value: '/' }));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof TanstackRouter>()),
  useRouter: () => ({ invalidate }),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: pathname.value } }),
}));

describe('DocumentError', () => {
  beforeEach(() => {
    invalidate.mockClear();
    pathname.value = '/';
  });

  it('ponowienie uniewaznia trase', () => {
    render(<DocumentError error={new Error('API down')} reset={vi.fn<() => void>()} />);

    expect(screen.getByRole('alert')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(invalidate).toHaveBeenCalledOnce();
  });

  it('jezyk z adresu: /en po angielsku', () => {
    pathname.value = '/en/articles/x';
    render(<DocumentError error={new Error('API down')} reset={vi.fn<() => void>()} />);

    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

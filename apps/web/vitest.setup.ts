// Typy matcherow jest-dom (toBeInTheDocument...) dla vitest; same matchery rejestruje expect.extend nizej.
/// <reference types="@testing-library/jest-dom/vitest" />
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, vi } from 'vitest';

expect.extend(jestDomMatchers);

// Bez `globals: true` Testing Library nie sprzata samo po kazdym tescie.
afterEach(() => {
  cleanup();
});

// Komponenty renderuja sie w testach bez routera TanStack: nawigacja aplikacji to dubel (src/test/navigation-double).
vi.mock('@/lib/navigation', () => import('./src/test/navigation-double'));

// jsdom nie ma `matchMedia` ani `scrollIntoView` - komponenty wolaja je w przegladarce (uklad, przewiniecie do bledu).
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  Element.prototype.scrollIntoView = () => undefined;
}

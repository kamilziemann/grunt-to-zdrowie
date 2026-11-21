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

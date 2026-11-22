// Straznik designu (ADR 0007): komponenty uzywaja wylacznie tokenow z src/styles/app.css, bez surowych kolorow.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
// Wspolne komponenty i komponenty featurow: kolory tylko z tokenow (var(--color-*),
// color-mix z tokenem), zeby obrysy i tla szly za paleta.
const DIRS = ['components/ui', 'components/shared', ...featureComponentDirs()];
const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white';
// Surowy kolor: hex, rgb()/hsl()/oklch() albo klasa z palety Tailwinda (bg-red-500, text-white...).
const RAW_COLOR = new RegExp(
  `#[0-9a-fA-F]{3,8}\\b|\\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\\(|\\b(?:bg|text|border|ring|fill|stroke|from|to|via|shadow|outline|divide|decoration|accent|caret)-(?:${PALETTE})(?:-\\d{2,3})?\\b`,
);

function featureComponentDirs(): string[] {
  return readdirSync(join(ROOT, 'features'))
    .map((feature) => join('features', feature, 'components'))
    .filter((dir) => existsSync(join(ROOT, dir)));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) return sourceFiles(path);

    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('tokeny designu', () => {
  const files = DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)));

  it('znajduje komponenty do sprawdzenia', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((file) => file.includes('features'))).toBe(true);
  });

  it.each(files.map((file) => [relative(ROOT, file), file] as const))(
    '%s nie zawiera surowych kolorów',
    (_name, file) => {
      const match = RAW_COLOR.exec(readFileSync(file, 'utf8'));

      expect(match?.[0]).toBeUndefined();
    },
  );

  it('app.css definiuje komplet tokenów kolorów, ruchu i cieni', () => {
    const css = readFileSync(join(ROOT, 'styles/app.css'), 'utf8');
    const required = [
      'background',
      'foreground',
      'muted',
      'card',
      'primary',
      'secondary',
      'secondary-border',
      'water',
      'destructive',
      'success',
      'warning',
      'border',
      'input',
      'ring',
    ];

    for (const token of required) expect(css).toContain(`--${token}: light-dark(`);

    for (const token of ['--duration-base', '--ease-out', '--shadow-card', '--text-base', '--radius']) {
      expect(css).toContain(`${token}:`);
    }

    // mieta i ciemny panel sa stale (panel to wyspa ciemnych wartosci light-dark()), kolory danych wspolne z raportem
    for (const token of ['--accent', '--accent-foreground', '--panel', '--data-blue', '--data-orange-dark']) {
      expect(css).toContain(`${token}: #`);
    }

    expect(css).toContain('@utility surface-panel');
    expect(css).toContain("'Geist Variable'");

    // build zamienia light-dark() na zmienne rozwiazywane przy deklaracji - panel musi deklarowac tokeny sam
    for (const match of css.matchAll(/--[\w-]+: light-dark\(/g)) {
      const block = css.slice(0, match.index);
      const selector = block.slice(block.lastIndexOf('}') + 1, block.lastIndexOf('{'));

      expect(`${match[0]} w ${selector.trim()}`).toContain('.surface-panel');
    }

    expect(css).toContain('prefers-reduced-motion');

    // tylko jasny motyw (ADR 0012): korzen jasny, bez reagowania na ustawienie systemu i bez data-theme
    expect(css).toMatch(/:root \{\n {2}color-scheme: light;/);
    expect(css).not.toContain('prefers-color-scheme');
    expect(css).not.toContain('data-theme');
  });
});

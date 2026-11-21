import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FieldSketchModel } from '@/lib/field-sketch';
import { renderWithIntl } from '@/test/render-intl';

import { FieldSketch } from './field-sketch';

// rysunek 576 x 460 (1 jednostka = 1 px), pole 200 x 100 na srodku, podzialka 250 m w dolnym lewym rogu
const MODEL: FieldSketchModel = {
  width: 576,
  height: 460,
  field: 'M188 180H388V280H188Z',
  fieldCenter: [288, 230],
  fieldSize: [200, 100],
  lines: [],
  areas: [],
  highlight: null,
  fact: { kind: 'ditch_through', lengthM: 120, alongEdge: false, anchor: [288, 230] },
  names: [],
  groups: [],
  scale: { meters: 250, length: 140 },
};

const CROWDED: FieldSketchModel = {
  ...MODEL,
  names: [
    { text: 'Kanał Wolny', at: [100, 60] },
    // podpis pola stoi pod polem (y ok. 296)
    { text: 'Struga Pod Podpisem', at: [288, 296] },
    // ramka faktu stoi nad polem (rowu w polu nie zaslaniamy)
    { text: 'Rzeka Pod Ramką', at: [288, 150] },
    { text: 'Potok Przy Podziałce', at: [60, 440] },
    { text: 'Kanał Wolny Drugi', at: [110, 62] },
  ],
};

function texts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('text')].map((text) => text.textContent ?? '');
}

describe('FieldSketch', () => {
  it('nazwa cieku nachodzaca na podpis pola, ramke faktu, podzialke albo inna nazwe znika z rysunku', () => {
    const { container } = renderWithIntl(
      <FieldSketch model={CROWDED} fieldName="Działka 1" factText="Rów przez pole, 120 m" label="Szkic" />,
    );

    const shown = texts(container);

    expect(shown).toContain('Kanał Wolny');
    expect(shown).toContain('Działka 1');
    expect(shown).toContain('Rów przez pole, 120 m');
    expect(shown).not.toContain('Struga Pod Podpisem');
    expect(shown).not.toContain('Rzeka Pod Ramką');
    expect(shown).not.toContain('Potok Przy Podziałce');
    expect(shown).not.toContain('Kanał Wolny Drugi');
    expect(screen.getByTestId('field-sketch-scale')).toHaveTextContent('250 m');
  });
});

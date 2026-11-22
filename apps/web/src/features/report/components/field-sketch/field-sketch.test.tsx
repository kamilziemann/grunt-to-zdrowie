import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FieldSketchModel } from '@/lib/field-sketch';
import { renderWithIntl } from '@/test/render-intl';

import { FieldSketch, type SketchZoneMark } from './field-sketch';

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
  fact: { kind: 'ditch_through', lengthM: 120, alongEdge: false, ditches: 1, anchors: [[288, 230]] },
  names: [],
  groups: [],
  scale: { meters: 250, length: 140 },
  zones: [],
  woods: [],
  treeRows: [],
  structures: [],
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

const TWO_DITCHES: FieldSketchModel = {
  ...MODEL,
  fact: {
    kind: 'ditch_through',
    lengthM: 406,
    alongEdge: false,
    ditches: 2,
    anchors: [
      [220, 210],
      [350, 250],
    ],
  },
};

const ZONED: FieldSketchModel = {
  ...MODEL,
  zones: [
    { id: 'zone-1', d: 'M188 180H250V230H188Z', line: false, labelAt: [219, 205] },
    { id: 'zone-2', d: 'M300 240H388V280H300Z', line: false, labelAt: [344, 260] },
    { id: 'zone-3', d: 'M188 180H388V280H188Z', line: false, labelAt: [288, 230] },
  ],
};

const MARKS: SketchZoneMark[] = [
  { id: 'zone-1', kind: 'drying', number: 1 },
  { id: 'zone-2', kind: 'collecting', number: 2 },
];

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

  it('kazdy row w polu ma wlasna linie do jednej tabliczki, linie nie przechodza przez tabliczke', () => {
    const { container } = renderWithIntl(
      <FieldSketch
        model={TWO_DITCHES}
        fieldName="Działka 1"
        factText="2 rowy przez pole, razem 406 m"
        label="Szkic"
      />,
    );
    const box = container.querySelector('[data-testid="field-sketch-fact"] rect');
    const lines = screen.getAllByTestId('field-sketch-fact-line');
    const top = Number(box?.getAttribute('y'));
    const bottom = top + Number(box?.getAttribute('height'));

    expect(screen.getAllByText('2 rowy przez pole, razem 406 m')).toHaveLength(1);
    expect(lines).toHaveLength(2);

    // obie linie wychodza z tego samego punktu krawedzi tabliczki i ida na zewnatrz
    const starts = lines.map((line) => {
      const segment = line.querySelector('line');

      return [segment?.getAttribute('x1'), segment?.getAttribute('y1')].join(' ');
    });

    expect(new Set(starts).size).toBe(1);

    for (const line of lines) {
      const y2 = Number(line.querySelector('line')?.getAttribute('y2'));

      expect(y2 > bottom || y2 < top).toBe(true);
    }
  });

  it('rysuje miejsca na polu wzorem z numerem, tlo bez wzoru, wyroznia aktywne miejsce', () => {
    const { container } = renderWithIntl(
      <FieldSketch
        model={ZONED}
        fieldName="Działka 1"
        factText={null}
        label="Szkic"
        zones={MARKS}
        activeZone="zone-2"
      />,
    );
    const zones = [...container.querySelectorAll('path[data-zone]')];

    // strefa bez numeru (reszta pola) nie jest rysowana
    expect(zones.map((zone) => zone.getAttribute('data-kind'))).toEqual(['drying', 'collecting']);
    expect(zones[0]?.getAttribute('fill')).toMatch(/^url\(#.*-drying\)$/);
    expect(zones[1]?.getAttribute('fill')).toMatch(/^url\(#.*-collecting\)$/);
    expect(screen.getAllByTestId('field-sketch-zone-number').map((badge) => badge.textContent)).toEqual([
      '1',
      '2',
    ]);
    expect(screen.getByTestId('field-sketch-zone-active')).toHaveAttribute('d', 'M300 240H388V280H300Z');
  });

  it('numery miejsc to przyciski z aria-pressed; klikniecie numeru wybiera, klikniecie w tlo zdejmuje wybor', () => {
    const select = vi.fn<(zoneId: string) => void>();
    const clear = vi.fn<() => void>();

    renderWithIntl(
      <FieldSketch
        model={ZONED}
        fieldName="Działka 1"
        factText={null}
        label="Szkic"
        zones={MARKS}
        activeZone="zone-1"
        selectedZone="zone-1"
        onZoneSelect={select}
        onBackgroundSelect={clear}
      />,
    );

    const first = screen.getByRole('button', { name: 'Miejsce 1 na polu' });

    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Miejsce 2 na polu' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.click(first);
    expect(select).toHaveBeenCalledWith('zone-1');

    // klikniecie w strefe na rysunku nie jest kliknieciem w tlo
    const shape = document.querySelector('path[data-zone="zone-2"]');

    if (!shape) throw new Error('brak strefy 2 na rysunku');
    fireEvent.click(shape);
    expect(select).toHaveBeenCalledWith('zone-2');
    expect(clear).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('field-sketch-field'));
    expect(clear).toHaveBeenCalledOnce();
  });
});

import type { Evidence } from '@app/contracts';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { EvidenceList } from './evidence-list';

const EVIDENCE: Evidence[] = [
  { metric: 'nearest_ditch_m', value: 0, unit: 'm', reference: 50, source: 'hydro' },
  { metric: 'ditch_length_in_field_m', value: 382, unit: 'm', source: 'hydro' },
  { metric: 'ditches_in_radius', value: 114, unit: 'count', reference: 500, source: 'hydro' },
  { metric: 'wetlands_in_radius', value: 0, unit: 'count', reference: 500, source: 'hydro' },
  { metric: 'drought_seasons', value: 3, unit: 'seasons', reference: 10, source: 'meteo' },
  { metric: 'soil_category', value: 2, unit: 'category', source: 'soil' },
  { metric: 'ndmi_anomaly', value: -0.153, unit: 'index', reference: 0, source: 'vegetation' },
  { metric: 'organic_matter_pct', value: 5.9, unit: '%', source: 'soil' },
];

describe('EvidenceList', () => {
  it('nowe miary silnika po polsku: promien w nazwie, sezony "z", kategoria rzymska, bez identyfikatorow', () => {
    renderWithIntl(<EvidenceList evidence={EVIDENCE} />);

    const items = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');

    expect(items[0]).toContain('Odległość do najbliższego rowu: 0 m');
    expect(items[1]).toContain('Długość rowów w polu: 382 m');
    expect(items[2]).toContain('Odcinki rowów w promieniu 500 m: 114');
    expect(items[2]).not.toContain('odniesienie');
    expect(items[3]).toContain('Mokradła w promieniu 500 m: 0');
    expect(items[4]).toContain('Sezony z suszą rolniczą (progi IUNG): 3 z 10 sezonów');
    expect(items[5]).toContain('Kategoria gleby (IUNG): II (lekka)');
    expect(items[6]).toContain('-0,15');
    expect(items[7]).toContain('Materia organiczna w warstwie ornej: 6%');

    for (const text of items) expect(text).not.toMatch(/_|\{|Inny wskaźnik/);
  });
});

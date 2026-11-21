import { describe, expect, it } from 'vitest';

import { FULL_CATALOG } from '@/i18n/full-catalog';

import { REPORT_METRICS } from './report-labels';

describe('nazwy miar', () => {
  it('lista miar zgadza sie z komunikatami report.evidence.metrics (pl)', () => {
    const report = FULL_CATALOG.pl.report as { evidence: { metrics: Record<string, string> } };

    expect(Object.keys(report.evidence.metrics).toSorted()).toEqual([...REPORT_METRICS].toSorted());
  });
});

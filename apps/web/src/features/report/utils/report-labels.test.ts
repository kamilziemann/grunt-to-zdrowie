import type { WaterReport } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { FULL_CATALOG } from '@/i18n/full-catalog';

import { DROUGHT_REPORT } from '../fixtures/drought-report';
import { FIELD_REPORT } from '../fixtures/field-report';
import { FOREST_REPORT } from '../fixtures/forest-report';
import { LOW_CONFIDENCE_REPORT } from '../fixtures/low-confidence-report';
import { SAMPLE_REPORT } from '../fixtures/sample-report';
import { evidenceDisplay, isKnownMetric, REPORT_METRICS, romanSoilClass } from './report-labels';

// raporty z prawdziwego silnika (i przykladowy) - kazda miara, ktora silnik naprawde zwraca, musi miec nazwe
const REPORTS: readonly WaterReport[] = [
  FIELD_REPORT,
  FOREST_REPORT,
  DROUGHT_REPORT,
  LOW_CONFIDENCE_REPORT,
  SAMPLE_REPORT,
];

function evidenceOf(report: WaterReport) {
  return [...report.causes, ...report.recommendations.retention, ...report.recommendations.agrotech].flatMap(
    (item) => item.evidence,
  );
}

describe('nazwy miar', () => {
  it('lista miar zgadza sie z komunikatami report.evidence.metrics (pl)', () => {
    const report = FULL_CATALOG.pl.report as { evidence: { metrics: Record<string, string> } };

    expect(Object.keys(report.evidence.metrics).toSorted()).toEqual([...REPORT_METRICS].toSorted());
  });

  it('kazda miara i jednostka z raportow silnika ma nazwe (zadnego "innego wskaznika")', () => {
    const evidence = REPORTS.flatMap(evidenceOf);

    expect(evidence.length).toBeGreaterThan(20);
    expect(evidence.filter((item) => !isKnownMetric(item.metric)).map((item) => item.metric)).toEqual([]);
    expect(
      evidence
        .filter((item) => evidenceDisplay(item.value, item.unit).unit === 'none')
        .map((item) => item.unit),
    ).toEqual([]);
  });

  it('jednostki silnika: udzial -> procent, m2, klasa gleby cyframi rzymskimi', () => {
    expect(evidenceDisplay(0.25, 'share')).toEqual({ value: 25, unit: 'percent' });
    expect(evidenceDisplay(1200, 'm2')).toEqual({ value: 1200, unit: 'm2' });
    expect(evidenceDisplay(6, 'class')).toEqual({ value: 6, unit: 'soilClass' });
    expect([1, 4, 5, 6].map(romanSoilClass)).toEqual(['I', 'IV', 'V', 'VI']);
  });
});

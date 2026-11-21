import { describe, expect, it } from 'vitest';

import { DROUGHT_REPORT } from '../fixtures/drought-report';
import { exportFileName, reportCsv, reportJson } from './report-export';

describe('eksport dla doradcy', () => {
  it('CSV: BOM, naglowek, separator srednik, liczby z kropka, wszystkie sekcje', () => {
    const csv = reportCsv(DROUGHT_REPORT);
    const lines = csv.split('\r\n');

    expect(csv.startsWith('﻿section;key;value;unit')).toBe(true);
    expect(lines).toContain('climaticBalance;balanceMm;-188.4;mm');
    expect(lines).toContain('rootZone;seasonStressDays;31;d');
    expect(lines).toContain('calendar.2008.1;ok;-17.1;mm');
    expect(lines).toContain('irrigation;netDepthMm;136;mm');
    expect(lines.filter((line) => line.startsWith('season.'))).toHaveLength(50);
  });

  it('CSV: tekst ze srednikiem albo cudzyslowem w cudzyslowie', () => {
    const csv = reportCsv({ ...DROUGHT_REPORT, field: { ...DROUGHT_REPORT.field, label: 'Pole "A"; dol' } });

    expect(csv).toContain('field;label;"Pole ""A""; dol";');
  });

  it('JSON odtwarza raport, nazwa pliku z dzialki i dnia', () => {
    expect(JSON.parse(reportJson(DROUGHT_REPORT))).toEqual(DROUGHT_REPORT);
    expect(exportFileName(DROUGHT_REPORT, 'csv')).toBe('raport-141201_1.0001.6509-2018-06-15.csv');
  });
});

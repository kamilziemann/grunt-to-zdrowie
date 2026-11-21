// Eksport danych raportu dla doradcy (D7): caly raport jako JSON i plaska tabela CSV (sekcja; klucz; wartosc;
// jednostka) do arkusza kalkulacyjnego. Klucze to identyfikatory z kontraktu (plik jest dla doradcy, nie ekran).
// Separator `;` i BOM UTF-8 - polski Excel otwiera plik od razu w kolumnach; liczby z kropka dziesietna.
import type { WaterReport } from '@app/contracts';

type Cell = string | number | boolean | null | undefined;
type Row = [section: string, key: string, value: Cell, unit?: string];

function cell(value: Cell): string {
  if (value === null || value === undefined) return '';
  const text = String(value);

  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function reportRows(report: WaterReport): Row[] {
  const { meta, field, crop, assessment, history, recommendations } = report;
  const balance = assessment.climaticBalance;
  const rootZone = assessment.rootZone;
  const rows: Row[] = [
    ['meta', 'reportId', meta.reportId],
    ['meta', 'engineVersion', meta.engineVersion],
    ['meta', 'analysisDate', meta.analysisDate],
    ['meta', 'generatedAt', meta.generatedAt],
    ['meta', 'status', meta.status],
    ['meta', 'sample', meta.sample],
    ['meta', 'sampleParts', meta.sampleParts?.join(',')],
    ['field', 'label', field.label],
    ['field', 'kind', field.kind],
    ['field', 'parcelIds', field.parcelIds.join(',')],
    ['field', 'areaHa', field.areaHa, 'ha'],
    ['field', 'centroid', field.centroid.join(',')],
    ['crop', 'cropId', crop.cropId],
    ['crop', 'stage', crop.stage],
    ['crop', 'kc', crop.kc],
    ['crop', 'rootDepthM', crop.rootDepthM, 'm'],
    ['assessment', 'level', assessment.level],
    ['assessment', 'confidence', assessment.confidence],
  ];

  if (balance) {
    rows.push(
      ['climaticBalance', 'status', balance.status],
      ['climaticBalance', 'periodNo', balance.periodNo],
      ['climaticBalance', 'periodFrom', balance.periodFrom],
      ['climaticBalance', 'periodTo', balance.periodTo],
      ['climaticBalance', 'precipMm', balance.precipMm, 'mm'],
      ['climaticBalance', 'evapotranspirationMm', balance.evapotranspirationMm, 'mm'],
      ['climaticBalance', 'balanceMm', balance.balanceMm, 'mm'],
      ['climaticBalance', 'thresholdMm', balance.thresholdMm, 'mm'],
      ['climaticBalance', 'soilCategory', balance.soilCategory],
      ['climaticBalance', 'belowThreshold', balance.belowThreshold],
      ['climaticBalance', 'method', balance.method],
      ['climaticBalance', 'coverage', balance.coverage],
      ['climaticBalance', 'rankInHistory', balance.rankInHistory?.rank],
      ['climaticBalance', 'rankYears', balance.rankInHistory?.years],
    );

    for (const scenario of balance.categoryScenarios ?? []) {
      rows.push(
        [`soilScenario.${scenario.soilCategory}`, 'thresholdMm', scenario.thresholdMm, 'mm'],
        [`soilScenario.${scenario.soilCategory}`, 'belowThreshold', scenario.belowThreshold],
      );
    }
  }

  if (rootZone) {
    rows.push(
      ['rootZone', 'totalAvailableMm', rootZone.totalAvailableMm, 'mm'],
      ['rootZone', 'readilyAvailableMm', rootZone.readilyAvailableMm, 'mm'],
      ['rootZone', 'depletionMm', rootZone.depletionMm, 'mm'],
      ['rootZone', 'depletionShare', rootZone.depletionShare],
      ['rootZone', 'stressCoefficient', rootZone.stressCoefficient],
      ['rootZone', 'stressDays30', rootZone.stressDays30, 'd'],
      ['rootZone', 'seasonStressDays', rootZone.seasonStressDays, 'd'],
      ['rootZone', 'seasonEtDeficitMm', rootZone.seasonEtDeficitMm, 'mm'],
    );
  }

  if (assessment.precipitation) {
    const rain = assessment.precipitation;

    rows.push(
      ['precipitation', `sum${rain.days}d`, rain.sumMm, 'mm'],
      ['precipitation', 'medianMm', rain.medianMm, 'mm'],
      ['precipitation', 'rank', rain.rank],
      ['precipitation', 'years', rain.years],
    );
  }

  if (assessment.vegetation) {
    const plants = assessment.vegetation;

    rows.push(
      ['vegetation', 'observedOn', plants.observedOn],
      ['vegetation', 'ndvi', plants.ndvi],
      ['vegetation', 'ndmi', plants.ndmi],
      ['vegetation', 'ndviAnomaly', plants.ndviAnomaly],
      ['vegetation', 'ndmiAnomaly', plants.ndmiAnomaly],
      ['vegetation', 'interpretation', plants.interpretation],
    );
  }

  rows.push(
    ['history', 'seasonsWithData', history.seasonsWithData],
    ['history', 'droughtSeasons', history.droughtSeasons],
    ['history', 'riskMonths', history.riskMonths.join(',')],
  );

  for (const season of history.seasons) {
    const section = `season.${season.year}`;

    rows.push(
      [section, 'droughtPeriods', season.droughtPeriods],
      [section, 'monitoredPeriods', season.monitoredPeriods],
      [section, 'minBalanceMm', season.minBalanceMm, 'mm'],
      [section, 'stressDays', season.stressDays, 'd'],
      [section, 'etDeficitMm', season.etDeficitMm, 'mm'],
    );
  }

  for (const period of history.calendar) {
    rows.push([`calendar.${period.year}.${period.periodNo}`, period.status, period.balanceMm, 'mm']);
  }

  for (const cause of report.causes) {
    rows.push([`cause.${cause.id}`, 'weight', cause.weight]);

    for (const item of cause.evidence) rows.push([`cause.${cause.id}`, item.metric, item.value, item.unit]);
  }

  for (const item of [...recommendations.retention, ...recommendations.agrotech]) {
    rows.push(
      [`recommendation.${item.measure}`, 'priority', item.priority],
      [`recommendation.${item.measure}`, 'zoneId', item.zoneId],
      [`recommendation.${item.measure}`, item.effect?.kind ?? 'effect', item.effect?.value],
    );
  }

  if (recommendations.irrigation) {
    const irrigation = recommendations.irrigation;

    rows.push(
      ['irrigation', 'advisable', irrigation.advisable],
      ['irrigation', 'netDepthMm', irrigation.netDepthMm, 'mm'],
      ['irrigation', 'withinDays', irrigation.withinDays, 'd'],
      ['irrigation', 'forecastPrecipMm', irrigation.forecastPrecipMm, 'mm'],
    );
  }

  for (const source of report.sources) {
    rows.push(
      [`source.${source.id}`, 'provider', source.provider],
      [`source.${source.id}`, 'status', source.status],
      [`source.${source.id}`, 'sample', source.sample],
      [`source.${source.id}`, 'resolution', source.resolution],
    );
  }

  rows.push(['limitations', 'ids', report.limitations.join(',')]);

  return rows;
}

/** Raport jako CSV z naglowkiem (BOM UTF-8, separator `;`, wiersze CRLF). */
export function reportCsv(report: WaterReport): string {
  // zawsze 4 kolumny (pusta jednostka tez), zeby arkusz nie przesuwal komorek
  const lines = [['section', 'key', 'value', 'unit'] as Row, ...reportRows(report)].map(
    ([section, key, value, unit]) => [cell(section), cell(key), cell(value), cell(unit)].join(';'),
  );

  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Raport jako sformatowany JSON (ksztalt z kontraktu `WaterReport`). */
export function reportJson(report: WaterReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/** Nazwa pliku: raport-<pole>-<dzien>.<rozszerzenie>, tylko bezpieczne znaki. */
export function exportFileName(report: WaterReport, extension: 'json' | 'csv'): string {
  const field = (report.field.parcelIds[0] ?? report.field.id).replaceAll(/[^0-9A-Za-z._-]+/g, '-');

  return `raport-${field}-${report.meta.analysisDate}.${extension}`;
}

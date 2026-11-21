// Zapis raportow analiz w D1 (tabela `analysis_report`): jeden wiersz na klucz pole + uprawa + data + wersja silnika,
// tresc raportu jako JSON. Nadpisanie tego samego identyfikatora odswieza raport "na dzis"; zapis usuwa raporty
// starsze niz 30 dni.
import { analysisReport, type Db } from '@app/db';
import { eq, lt } from 'drizzle-orm';

import { REPORT_RETENTION_DAYS, type ReportStore } from '../../domain/report-store';

const DAY_MS = 24 * 60 * 60 * 1000;

export function createReportsRepository(db: Db): ReportStore {
  return {
    async get(id) {
      const [row] = await db.select().from(analysisReport).where(eq(analysisReport.id, id)).limit(1);

      if (!row) return null;

      return {
        key: {
          id: row.id,
          fieldId: row.fieldId,
          cropId: row.cropId,
          analysisDate: row.analysisDate,
          engineVersion: row.engineVersion,
        },
        report: row.report,
        createdAt: row.createdAt,
      };
    },

    async save(key, report, createdAt) {
      const values = { ...key, report, createdAt };
      const cutoff = new Date(Date.parse(createdAt) - REPORT_RETENTION_DAYS * DAY_MS).toISOString();

      // jedna paczka w D1: zapis i sprzatanie starych wierszy (createdAt to ISO 8601, porownanie tekstowe = czasowe)
      await db.batch([
        db
          .insert(analysisReport)
          .values(values)
          .onConflictDoUpdate({ target: analysisReport.id, set: { report, createdAt } }),
        db.delete(analysisReport).where(lt(analysisReport.createdAt, cutoff)),
      ]);
    },
  };
}

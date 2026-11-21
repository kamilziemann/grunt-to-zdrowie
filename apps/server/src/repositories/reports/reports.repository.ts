// Zapis raportow analiz w D1 (tabela `analysis_report`): jeden wiersz na klucz pole + uprawa + data + wersja silnika,
// tresc raportu jako JSON. Nadpisanie tego samego identyfikatora odswieza raport "na dzis".
import { analysisReport, type Db } from '@app/db';
import { eq } from 'drizzle-orm';

import type { ReportStore } from '../../domain/report-store';

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

      await db
        .insert(analysisReport)
        .values(values)
        .onConflictDoUpdate({ target: analysisReport.id, set: { report, createdAt } });
    },
  };
}

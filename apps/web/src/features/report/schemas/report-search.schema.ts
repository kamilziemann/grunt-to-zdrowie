// Adres raportu: parametry analizy (feature "analysis") i stan szczegolow. `widok=szczegoly` otwiera strone
// z rozwinietymi szczegolami (stare linki "widok szczegolowy" i link dla doradcy); inna wartosc = zwiniete, bez bledu.
import { z } from 'zod';

import { analysisSearchSchema } from '@/features/analysis';

export const reportSearchSchema = analysisSearchSchema.extend({
  widok: z.enum(['szczegoly']).optional().catch(undefined),
});

export type ReportSearch = z.infer<typeof reportSearchSchema>;

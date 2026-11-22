// Adres raportu: parametry analizy (feature "analysis") i poziom szczegolow. `widok=szczegoly` otwiera widok
// szczegolowy (link dla doradcy); inna wartosc = widok prosty, bez bledu.
import { z } from 'zod';

import { analysisSearchSchema } from '@/features/analysis';

export const reportSearchSchema = analysisSearchSchema.extend({
  widok: z.enum(['szczegoly']).optional().catch(undefined),
});

export type ReportSearch = z.infer<typeof reportSearchSchema>;

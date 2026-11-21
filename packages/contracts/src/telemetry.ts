// Telemetria przegladarki: raport bledu wysylany przez @app/start-kit do POST /telemetry/errors. Slad (`traceId`)
// laczy blad z zapytaniami API tej samej odslony strony w logach Cloudflare. Limity dlugosci chronia logi przed
// zalaniem (blad z petli, ogromny stack).
import { z } from 'zod';

export const CLIENT_ERROR_KINDS = ['error', 'unhandledrejection', 'boundary'] as const;

export const clientErrorReportSchema = z.object({
  kind: z.enum(CLIENT_ERROR_KINDS),
  message: z.string().min(1).max(1000),
  stack: z.string().max(8000).optional(),
  /** sciezka strony (bez query), na ktorej wystapil blad */
  path: z.string().max(500),
  /** slad odslony strony (32 znaki hex), ten sam co w `traceparent` zapytan API */
  traceId: z.string().regex(/^[0-9a-f]{32}$/),
  release: z.string().max(100).optional(),
});

export type ClientErrorReport = z.infer<typeof clientErrorReportSchema>;

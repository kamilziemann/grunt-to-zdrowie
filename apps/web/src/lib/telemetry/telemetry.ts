// Bledy przegladarki do logow Cloudflare: globalne `error`/`unhandledrejection` (instalowane raz w __root) i reczne
// raporty z granic bledow tras. Raport idzie do API Hono (`/api/telemetry/errors`) z traceId odslony - ten sam co
// w zapytaniach API tej strony, wiec w Observability widac blad razem z jego sciezka (@app/start-kit).
import { createClientErrorReporter, installClientErrorReporter } from '@app/start-kit';
import type { ClientErrorReport } from '@app/contracts';

import { apiUrl } from '../api';

const OPTIONS = { endpoint: apiUrl('/telemetry/errors'), release: import.meta.env.MODE };

let report: ReturnType<typeof createClientErrorReporter> | undefined;

/** Podpina globalne zdarzenia bledow (wywolanie raz, po stronie przegladarki). */
export function installErrorReporting(): void {
  report ??= installClientErrorReporter(OPTIONS);
}

/** Raport bledu z granicy bledow trasy (komponent bledu tez sie renderuje - uzytkownik widzi panel bledu). */
export function reportClientError(error: unknown, kind: ClientErrorReport['kind'] = 'boundary'): void {
  if (typeof window === 'undefined') return;

  report ??= createClientErrorReporter(OPTIONS);
  report(error, kind);
}

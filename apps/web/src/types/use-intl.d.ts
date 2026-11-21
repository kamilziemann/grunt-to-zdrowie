// Typy use-intl: pliki `messages/pl/<przestrzen>.json` sa zrodlem prawdy, wiec brakujacy klucz w kodzie (albo
// literowka) nie przejdzie `bun check:types`. Zgodnosc `messages/en` z `messages/pl` pilnuje src/i18n/messages.test.ts.
import type analysis from '../../messages/pl/analysis.json';
import type auth from '../../messages/pl/auth.json';
import type common from '../../messages/pl/common.json';
import type design from '../../messages/pl/design.json';
import type errors from '../../messages/pl/errors.json';
import type nav from '../../messages/pl/nav.json';
import type parcels from '../../messages/pl/parcels.json';
import type problems from '../../messages/pl/problems.json';
import type report from '../../messages/pl/report.json';
import type { AppLocale } from '@/lib/locale';

declare module 'use-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: {
      analysis: typeof analysis;
      auth: typeof auth;
      common: typeof common;
      design: typeof design;
      errors: typeof errors;
      nav: typeof nav;
      parcels: typeof parcels;
      problems: typeof problems;
      report: typeof report;
    };
  }
}

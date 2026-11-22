// Typy use-intl: pliki `messages/pl/<przestrzen>.json` sa zrodlem prawdy, wiec brakujacy klucz w kodzie (albo
// literowka) nie przejdzie `bun check:types`. Zgodnosc `messages/en` z `messages/pl` pilnuje src/i18n/messages.test.ts.
import type analysis from '../../messages/pl/analysis.json';
import type common from '../../messages/pl/common.json';
import type errors from '../../messages/pl/errors.json';
import type method from '../../messages/pl/method.json';
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
      common: typeof common;
      errors: typeof errors;
      method: typeof method;
      nav: typeof nav;
      parcels: typeof parcels;
      problems: typeof problems;
      report: typeof report;
    };
  }
}

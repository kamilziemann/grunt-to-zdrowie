import { Languages } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { buttonVariants } from '@/components/ui/button';
import { ENABLED_LOCALES, LOCALE_NAMES, type AppLocale, useAppLocale } from '@/lib/locale';
import { LocaleLink } from '@/lib/navigation';

/**
 * Przelacznik jezyka interfejsu: pokazuje jezyk, na ktory przelaczy (np. „EN”) i prowadzi do tej samej strony w tym
 * jezyku (jezyk jest w adresie). Nazwa zaczyna sie od widocznego skrotu („EN - zmien jezyk na English”), zeby
 * sterowanie glosem dzialalo (WCAG 2.5.3); bez `lang` na linku, bo nazwa jest w jezyku interfejsu, nie docelowym.
 */
export function LocaleSwitcher({ locales = ENABLED_LOCALES }: { locales?: readonly AppLocale[] }) {
  const t = useTranslations('nav');
  const current = useAppLocale();
  const target: AppLocale = locales[(locales.indexOf(current) + 1) % locales.length] ?? current;
  const code = target.toUpperCase();
  const label = t('switchLanguage', { code, language: LOCALE_NAMES[target] });

  // jeden wlaczony jezyk (lib/locale ENABLED_LOCALES) - nie ma na co przelaczac
  if (locales.length < 2) return null;

  return (
    <LocaleLink
      locale={target}
      aria-label={label}
      title={label}
      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
    >
      <Languages />
      {code}
    </LocaleLink>
  );
}

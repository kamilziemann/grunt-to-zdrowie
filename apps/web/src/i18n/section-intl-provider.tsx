// Dostawca komunikatow sekcji (np. sekcja deweloperska): do komunikatow strony z layoutu `{-$locale}` doklada
// przestrzenie sekcji ladowane przez jej layout - poza sekcja te przestrzenie nie trafiaja do HTML.
import { useMemo, type ReactNode } from 'react';
import { IntlProvider, useLocale, useMessages, useTimeZone, type Messages } from 'use-intl';

export function SectionIntlProvider({
  messages,
  children,
}: {
  messages: Partial<Messages>;
  children: ReactNode;
}) {
  const base = useMessages();
  const locale = useLocale();
  const timeZone = useTimeZone();
  const merged = useMemo(() => ({ ...base, ...messages }), [base, messages]);

  return (
    <IntlProvider locale={locale} timeZone={timeZone} messages={merged}>
      {children}
    </IntlProvider>
  );
}

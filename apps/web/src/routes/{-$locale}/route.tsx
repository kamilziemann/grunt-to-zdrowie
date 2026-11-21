// Layout jezyka: `/...` = polski, `/en/...` = angielski (jezyk w adresie, bo cache CDN nie widzi ciasteczek).
// Jezyk wylaczony w ENABLED_LOCALES (dzis angielski) przekierowuje na ten sam adres po polsku. Pierwszy segment,
// ktory nie jest jezykiem (`/brand-book`), to nieznana strona po polsku: layout przepuszcza go z `unknownPage`,
// a powloka aplikacji (`_app`) rzuca 404 w swoim wygladzie. Loader laduje komunikaty jezyka (chunki przestrzeni) - przy
// przelaczeniu jezyka trasa laduje sie ponownie bez przeladowania strony. Wszystkie strony sa ponizej.
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { IntlProvider } from 'use-intl';

import { ToastProvider } from '@/components/ui/toast';

import { loadMessages } from '@/i18n/load-messages';
import {
  APP_TIME_ZONE,
  DEFAULT_LOCALE,
  delocalizePath,
  isDisabledLocaleParam,
  localeFromParam,
} from '@/lib/locale';

export const Route = createFileRoute('/{-$locale}')({
  beforeLoad: ({ params, location }) => {
    if (isDisabledLocaleParam(params.locale))
      throw redirect({ href: delocalizePath(location.href), statusCode: 302 });

    const locale = localeFromParam(params.locale);

    return locale ? { locale, unknownPage: false } : { locale: DEFAULT_LOCALE, unknownPage: true };
  },
  loader: async ({ context }) => ({ locale: context.locale, messages: await loadMessages(context.locale) }),
  staleTime: Number.POSITIVE_INFINITY,
  component: LocaleLayout,
});

function LocaleLayout() {
  const { locale, messages } = Route.useLoaderData();

  return (
    <IntlProvider locale={locale} messages={messages} timeZone={APP_TIME_ZONE}>
      {/* toasty maja teksty z komunikatow - dostawca musi byc wewnatrz IntlProvider */}
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </IntlProvider>
  );
}

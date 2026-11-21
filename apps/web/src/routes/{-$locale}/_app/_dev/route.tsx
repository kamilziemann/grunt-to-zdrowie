// Strony deweloperskie (katalog designu): tylko w development, poza nim 404. Layout doklada przestrzenie komunikatow
// sekcji `dev` (poza nia nie trafiaja do HTML).
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';

import { loadSectionMessages } from '@/i18n/load-messages';
import { SectionIntlProvider } from '@/i18n/section-intl-provider';
import { pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/_dev')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  loader: async ({ context: { locale } }) => ({ messages: await loadSectionMessages(locale, 'dev') }),
  staleTime: Number.POSITIVE_INFINITY,
  head: () => pageHead({ noindex: true }),
  component: DevLayout,
});

function DevLayout() {
  const { messages } = Route.useLoaderData();

  return (
    <SectionIntlProvider messages={messages}>
      <Outlet />
    </SectionIntlProvider>
  );
}

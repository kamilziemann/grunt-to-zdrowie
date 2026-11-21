// Strona "Jak liczymy": layout doklada przestrzen komunikatow `method` (dlugie teksty metodyki nie trafiaja do HTML
// i JS pozostalych stron). Trasa bez segmentu w adresie.
import { createFileRoute, Outlet } from '@tanstack/react-router';

import { loadSectionMessages } from '@/i18n/load-messages';
import { SectionIntlProvider } from '@/i18n/section-intl-provider';

export const Route = createFileRoute('/{-$locale}/_app/_method')({
  loader: async ({ context: { locale } }) => ({ messages: await loadSectionMessages(locale, 'method') }),
  staleTime: Number.POSITIVE_INFINITY,
  component: MethodLayout,
});

function MethodLayout() {
  const { messages } = Route.useLoaderData();

  return (
    <SectionIntlProvider messages={messages}>
      <Outlet />
    </SectionIntlProvider>
  );
}

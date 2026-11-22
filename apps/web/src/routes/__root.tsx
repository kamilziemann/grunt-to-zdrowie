/// <reference types="vite/client" />
// Dokument HTML aplikacji (shellComponent renderuje sie zawsze po stronie serwera, takze dla tras z `ssr: false`),
// wspolne <head> i dostawcy, ktorzy nie zaleza od jezyka. Jezyk, komunikaty i powloki sekcji dokladaja layouty
// `{-$locale}`. HTML nie zalezy od ciasteczek (motyw jest tylko jasny), wiec strony moga isc z cache'u CDN.
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Scripts, useRouterState } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';

import { DocumentError, DocumentNotFound } from '@/components/shared/document-fallbacks';
import { localeFromPath } from '@/lib/locale';
import { installErrorReporting } from '@/lib/telemetry';
import appCss from '@/styles/app.css?url';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      // tylko jasny motyw (ADR 0012): przegladarka nie przyciemnia kontrolek, pasek = --background
      { name: 'color-scheme', content: 'light' },
      { name: 'theme-color', content: '#ffffff' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
  errorComponent: DocumentError,
  notFoundComponent: DocumentNotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  const locale = localeFromPath(useRouterState({ select: (state) => state.location.pathname }));

  useEffect(installErrorReporting, []);
  // Znacznik "strona interaktywna" (po hydracji): testy e2e czekaja na niego, zanim klikna - w `vite dev` hydracja
  // trwa chwile, a klikniecie wczesniej trafia w natywny formularz zamiast w handler Reacta.
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);

  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

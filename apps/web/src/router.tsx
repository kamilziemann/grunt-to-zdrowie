// Fabryka routera (TanStack Start wola ja na kazde zapytanie SSR i raz w przegladarce). Wytyczne router-query:
// - QueryClient tworzony TUTAJ, per zapytanie (wspolny klient na serwerze przeciekalby dane miedzy uzytkownikami),
// - setupRouterSsrQueryIntegration: dane zapytan z SSR jada do przegladarki (dehydracja/hydracja, streaming),
// - defaultPreloadStaleTime: 0 - swiezosc danych kontroluje Query, nie wewnetrzny cache routera,
// - preload `intent`: loader i zapytania startuja przy najechaniu na link (przejscie bez czekania),
// - zwykle query stringi (`?q=2027`, nie JSON) - jeden adres = jeden klucz cache brzegu.
import { createQueryClient, parsePlainSearch, stringifyPlainSearch } from '@app/start-kit';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { DocumentNotFound } from './components/shared/document-fallbacks';
import { RouteError } from './components/shared/route-error';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const queryClient = createQueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: DocumentNotFound,
    scrollRestoration: true,
    parseSearch: parsePlainSearch,
    stringifySearch: stringifyPlainSearch,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

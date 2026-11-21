// Izomorficzny klient API (Hono RPC) dla loaderow i hookow. Loader dziala na serwerze przy pierwszym wejsciu i w
// przegladarce przy nawigacji, wiec klient ma dwie galezie (kompilator Start wycina serwerowa z bundla klienta):
// - serwer: Hono W TYM SAMYM WORKERZE przez zarejestrowany `ServerFetch` - bez sieci, z pelnym middleware API, z
//   przeniesiona sesja, IP i sladem biezacego zapytania,
// - przegladarka: `fetch` do `<origin><prefix>` (ciasteczka ida same) z naglowkami sladu odslony.
// Typ klienta daje aplikacja (fabryka z `hc<AppType>`), wiec kit nie zna typu API i niczego nie rzutuje.
import type { ClientRequestOptions } from '@app/rpc';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { forwardRequestHeaders } from '../forwarded-headers';
import { pageTraceHeaders } from '../page-trace';
import { getServerFetch } from '../server-fetch';

export type ApiClientFactory<Client> = (baseUrl: string, options: ClientRequestOptions) => Client;

export function createIsomorphicApi<Client>(factory: ApiClientFactory<Client>, prefix = '/api') {
  return createIsomorphicFn()
    .server((): Client => {
      const incoming = getRequest();

      return factory(`${new URL(incoming.url).origin}${prefix}`, {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);

          forwardRequestHeaders(request.headers, incoming.headers);

          return getServerFetch()(request);
        },
      });
    })
    .client((): Client => factory(`${window.location.origin}${prefix}`, { headers: pageTraceHeaders }));
}

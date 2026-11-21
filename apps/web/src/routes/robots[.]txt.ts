// robots.txt: strony sa otwarte dla wyszukiwarek, strony deweloperskie i API nie. Strony osobiste (konto, logowanie)
// nie sa tu blokowane, bo robot musi je pobrac, zeby zobaczyc ich `noindex`. Plik jest staly, wiec idzie z brzegu
// (polityka `static`).
import { cacheHeaders } from '@app/cache';
import { createFileRoute } from '@tanstack/react-router';

import { routes } from '@/lib/routes';

const DISALLOW = [routes.design(), '/api/'];

const BODY = ['User-Agent: *', 'Allow: /', ...DISALLOW.map((path) => `Disallow: ${path}`), ''].join('\n');

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(BODY, {
          headers: { 'content-type': 'text/plain; charset=utf-8', ...cacheHeaders('static') },
        }),
    },
  },
});

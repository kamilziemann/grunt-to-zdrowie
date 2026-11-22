// robots.txt: strony sa otwarte dla wyszukiwarek, API nie. Strony z `noindex` nie sa tu
// blokowane, bo robot musi je pobrac, zeby ten `noindex` zobaczyc. Plik jest staly, wiec idzie z brzegu
// (polityka `static`).
import { cacheHeaders } from '@app/cache';
import { createFileRoute } from '@tanstack/react-router';

const DISALLOW = ['/api/'];

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

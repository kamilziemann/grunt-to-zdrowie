// Dubel `@/lib/navigation` dla testow komponentow (podpiety globalnie w vitest.setup.ts): `Link` jako zwykle <a>
// (komponenty renderuja sie bez routera), hooki ze stalymi wartosciami. Test, ktory sprawdza nawigacje, nadpisuje
// wybrane hooki: vi.mock('@/lib/navigation', async () => ({ ...(await vi.importActual('@/test/navigation-double')), usePathname: () => '/x' })).
import { forwardRef, type AnchorHTMLAttributes } from 'react';

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, prefetch: _prefetch, replace: _replace, scroll: _scroll, ...rest },
  ref,
) {
  return (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  );
});

export const usePathname = (): string => '/';

export const useSearchParams = (): URLSearchParams => new URLSearchParams();

const noop = () => undefined;

export const useRouter = () => ({ push: noop, replace: noop, refresh: noop, back: noop });

export const useAlternateHref = (locale: string): string => (locale === 'pl' ? '/' : `/${locale}`);

export const LocaleLink = forwardRef<
  HTMLAnchorElement,
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'hrefLang'> & { locale: string }
>(function LocaleLink({ locale, children, ...rest }, ref) {
  return (
    <a ref={ref} href={useAlternateHref(locale)} hrefLang={locale} {...rest}>
      {children}
    </a>
  );
});

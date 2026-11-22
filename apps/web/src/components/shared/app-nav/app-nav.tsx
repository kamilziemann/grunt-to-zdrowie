import { Menu } from 'lucide-react';
import { useCallback, useId, useRef } from 'react';
import { useTranslations } from 'use-intl';

import { BrandMark } from '@/components/shared/brand-mark';
import { LocaleSwitcher } from '@/components/shared/locale-switcher';
import { buttonVariants } from '@/components/ui/button';
import { ENABLED_LOCALES } from '@/lib/locale';
import { Link, usePathname } from '@/lib/navigation';
import { isNavItemActive, NAV_ITEMS, routes } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

const HOME_PATHS = new Set(['/', '/en', '/en/']);

/** Kotwice sekcji strony glownej (makieta: "Jak to dziala", "Co dostaniesz", "Pytania"); id sekcji w HomeScreen. */
const HOME_ANCHORS = [
  { href: '#jak', labelKey: 'homeHow' },
  { href: '#wynik', labelKey: 'homeResult' },
  { href: '#pytania', labelKey: 'homeFaq' },
] as const;

const LINK_CLASS =
  'flex min-h-11 items-center rounded-full px-3 text-base font-medium whitespace-nowrap transition-colors hover:bg-muted lg:px-4';

/**
 * Naglowek aplikacji: znak i nazwa (powrot na strone glowna), "Sprawdz inna dzialke" poza strona glowna, pozycje
 * menu i jezyk - te same na kazdej stronie, w tym samym stylu. Na stronie glownej przed menu stoja kotwice jej sekcji,
 * a przycisk to "Sprawdz dzialke" (przewija do pola). Na telefonie wszystko poza logo chowa sie pod przyciskiem "Menu" (natywny popover: Esc
 * i klikniecie obok zamykaja, fokus wraca na przycisk).
 */
export function AppNav({ appName }: { appName: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const menuId = useId();
  const onHome = HOME_PATHS.has(pathname);
  const items = NAV_ITEMS.filter((item) => !item.devOnly || import.meta.env.DEV);
  const menuRef = useRef<HTMLDivElement>(null);

  // wybor pozycji zamyka menu telefonu (nawigacja po stronie klienta nie zamyka popovera sama)
  const closeMenu = useCallback(() => {
    const menu = menuRef.current;

    if (menu && 'hidePopover' in menu && menu.matches(':popover-open')) menu.hidePopover();
  }, []);

  // jedno menu na kazdej stronie ("Jak liczymy" szuka tez jury); strona glowna dokleja przed nim kotwice swoich sekcji
  const links = (
    <>
      {onHome &&
        HOME_ANCHORS.map((anchor) => (
          <li key={anchor.href}>
            <Link href={anchor.href} onClick={closeMenu} className={cn(LINK_CLASS, 'text-foreground')}>
              {t(anchor.labelKey)}
            </Link>
          </li>
        ))}
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={closeMenu}
              aria-current={active ? 'page' : undefined}
              className={cn(LINK_CLASS, active ? 'bg-muted text-foreground' : 'text-foreground/80')}
            >
              {t(item.labelKey)}
            </Link>
          </li>
        );
      })}
    </>
  );
  // glowne dzialanie w naglowku: poza strona glowna inna dzialka, na glownej przewiniecie do pola numeru
  const action = onHome
    ? { href: '#szukaj' as const, label: t('homeCheck'), variant: 'default' as const }
    : { href: routes.home(), label: t('otherParcel'), variant: 'default' as const };

  return (
    <nav aria-label={t('main')} className="flex min-w-0 flex-1 items-center gap-3 md:gap-4 lg:gap-6">
      <Link
        href={routes.home()}
        className="flex min-w-0 items-center gap-2.5 rounded-full pr-2 text-foreground md:shrink-0"
      >
        <BrandMark />
        <span className="truncate text-lg font-medium tracking-tight md:text-xl">{appName}</span>
      </Link>
      <ul className="flex items-center gap-1 max-md:hidden">{links}</ul>
      <div className="ml-auto flex items-center gap-1 max-md:hidden">
        <Link
          href={action.href}
          className={cn(
            buttonVariants({ variant: action.variant, size: onHome ? 'default' : 'sm' }),
            'mr-2 text-base whitespace-nowrap',
          )}
        >
          {action.label}
        </Link>
        <LocaleSwitcher />
      </div>
      <button
        type="button"
        popoverTarget={menuId}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'ml-auto shrink-0 text-base md:hidden',
        )}
      >
        <Menu aria-hidden="true" />
        {t('menu')}
      </button>
      <div
        id={menuId}
        ref={menuRef}
        popover="auto"
        className="inset-auto top-16 right-gutter m-0 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border bg-popover p-3 text-popover-foreground shadow-lg md:hidden"
      >
        <ul className="flex flex-col gap-1">
          {links}
          <li className="mt-1">
            <Link
              href={action.href}
              onClick={closeMenu}
              className={cn(buttonVariants({ variant: 'default', size: 'default' }), 'w-full')}
            >
              {action.label}
            </Link>
          </li>
        </ul>
        {ENABLED_LOCALES.length > 1 && (
          <div className="mt-2 flex items-center gap-1 border-t pt-2">
            <LocaleSwitcher />
          </div>
        )}
      </div>
    </nav>
  );
}

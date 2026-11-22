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

/**
 * Naglowek aplikacji: znak i nazwa (powrot na strone glowna), "Sprawdz inna dzialke" poza strona glowna, pozycje
 * menu i jezyk. Na telefonie wszystko poza logo chowa sie pod przyciskiem "Menu" (natywny popover: Esc
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

  const links = (
    <>
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={closeMenu}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center rounded-full px-4 text-base font-medium transition-colors hover:bg-muted',
                active ? 'bg-muted text-foreground' : 'text-foreground/80',
              )}
            >
              {t(item.labelKey)}
            </Link>
          </li>
        );
      })}
    </>
  );

  return (
    <nav aria-label={t('main')} className="flex flex-1 items-center gap-3 md:gap-6">
      <Link href={routes.home()} className="flex items-center gap-2.5 rounded-full pr-2 text-foreground">
        <BrandMark />
        <span className="flex flex-col leading-tight">
          <span className="text-lg font-medium tracking-tight md:text-xl">{appName}</span>
          <span className="text-sm text-muted-foreground max-lg:hidden">{t('tagline')}</span>
        </span>
      </Link>
      <ul className="flex items-center gap-1 max-md:hidden">{links}</ul>
      <div className="ml-auto flex items-center gap-1 max-md:hidden">
        {!onHome && (
          <Link
            href={routes.home()}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mr-2 text-base')}
          >
            {t('otherParcel')}
          </Link>
        )}
        <LocaleSwitcher />
      </div>
      <button
        type="button"
        popoverTarget={menuId}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'ml-auto text-base md:hidden')}
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
          {!onHome && (
            <li>
              <Link
                href={routes.home()}
                onClick={closeMenu}
                className={cn(buttonVariants({ variant: 'default', size: 'default' }), 'w-full')}
              >
                {t('otherParcel')}
              </Link>
            </li>
          )}
          {links}
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

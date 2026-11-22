import { Droplets } from 'lucide-react';
import { Link } from '@/lib/navigation';
import { usePathname } from '@/lib/navigation';
import { useTranslations } from 'use-intl';

import { LocaleSwitcher } from '@/components/shared/locale-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { isNavItemActive, NAV_ITEMS, routes } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

/** Naglowek aplikacji: logo, pozycje menu, jezyk i motyw. */
export function AppNav({ appName }: { appName: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('main')} className="flex flex-1 items-center gap-6">
      <Link href={routes.home()} className="flex items-center gap-2 text-xl font-bold text-primary">
        <Droplets className="size-5" aria-hidden="true" />
        {appName}
      </Link>
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.filter((item) => !item.devOnly || import.meta.env.DEV).map((item) => {
          const active = isNavItemActive(item, pathname);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary/70',
                  active ? 'bg-secondary text-foreground' : 'text-muted-foreground',
                )}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="ml-auto flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </nav>
  );
}

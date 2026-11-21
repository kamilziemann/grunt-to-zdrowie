import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/theme-provider';

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

/** Przelacznik motywu: system -> jasny -> ciemny. Wybor zapisuje ciasteczko `theme` (serwer renderuje bez migniecia). */
export function ThemeToggle() {
  const t = useTranslations('nav');
  const { theme, cycleTheme } = useTheme();
  const Icon = ICONS[theme];
  const label = t('themeToggle', { theme: t(`themes.${theme}`) });

  return (
    <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label={label} title={label}>
      <Icon />
    </Button>
  );
}

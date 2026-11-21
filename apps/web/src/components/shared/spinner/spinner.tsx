import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

/** Wskaznik ladowania z tekstem w `<output>`, ktory czytniki ekranu oglaszaja; domyslnie `common.loading`. */
export function Spinner({ label, className }: { label?: string; className?: string }) {
  const t = useTranslations('common');

  return (
    <output className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      {label ?? t('loading')}
    </output>
  );
}

import { Check, Link2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

type CopyState = 'idle' | 'copied' | 'manual';

/** Jak dlugo przycisk mowi "Skopiowano". */
const COPIED_MS = 3000;

/**
 * "Kopiuj link do raportu": adres strony niesie dzialki, uprawe i dzien, wiec doradca albo sasiad otworzy ten sam
 * raport. Bez dostepu do schowka (stara przegladarka, brak zgody) pokazuje adres w polu do recznego skopiowania.
 */
export function CopyLinkButton({ className }: { className?: string }) {
  const t = useTranslations('report.actions');
  const [state, setState] = useState<CopyState>('idle');
  const [url, setUrl] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (state === 'manual') field.current?.select();
  }, [state]);

  const copy = useCallback(async () => {
    const href = window.location.href;

    setUrl(href);
    window.clearTimeout(timer.current);

    try {
      await navigator.clipboard.writeText(href);
      setState('copied');
      timer.current = window.setTimeout(() => setState('idle'), COPIED_MS);
    } catch {
      setState('manual');
    }
  }, []);
  const onClick = useCallback(() => void copy(), [copy]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button
        size="xl"
        variant="outline"
        onClick={onClick}
        className="h-auto min-h-12 w-full py-2 leading-tight whitespace-normal max-sm:px-3 max-sm:text-sm"
      >
        {state === 'copied' ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
        {state === 'copied' ? t('copied') : t('copyLink')}
      </Button>
      {/* komunikat dla czytnika ekranu - przycisk zmienia tekst, ale fokus zostaje na nim */}
      <output className="sr-only">{state === 'copied' ? t('copied') : ''}</output>
      {state === 'manual' && (
        <label className="flex flex-col gap-1 text-sm">
          {t('copyManual')}
          <input
            ref={field}
            readOnly
            value={url}
            className="min-h-11 rounded-md border bg-background px-3 text-base"
            data-testid="report-link"
          />
        </label>
      )}
    </div>
  );
}

import { PencilRuler, Scissors, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, type ChangeEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { FIELD_LIMITS } from '@/lib/field-geometry';
import { cn } from '@/lib/utils/cn';

import type { FieldDraw, FieldDrawMode, SplitTarget } from '../../hooks/use-field-draw';
import { useAreaFormatter } from '../parcel-preview';

export interface FieldDrawEntryProps {
  /** dzialka do podzialu; null = podzial niedostepny (lista ma 0 albo kilka dzialek) */
  splitTarget: SplitTarget | null;
  onStart: (mode: FieldDrawMode) => void;
}

/** Wejscie do trybu "wlasne pole" pod lista dzialek: narysuj obszar albo podziel jedyna dzialke linia. */
export function FieldDrawEntry({ splitTarget, onStart }: FieldDrawEntryProps) {
  const t = useTranslations('parcels.field');
  const startDraw = useCallback(() => onStart('draw'), [onStart]);
  const startSplit = useCallback(() => onStart('split'), [onStart]);

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-dashed p-4"
      aria-labelledby="field-entry"
    >
      <div className="flex flex-col gap-1">
        <h2 id="field-entry" className="text-base font-semibold">
          {t('intro')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('introDescription')}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
        <Button variant="outline" size="xl" onClick={startDraw}>
          <PencilRuler aria-hidden="true" />
          {t('startDraw')}
        </Button>
        <Button
          variant="outline"
          size="xl"
          onClick={startSplit}
          disabled={!splitTarget}
          aria-describedby={splitTarget ? undefined : 'field-split-hint'}
        >
          <Scissors aria-hidden="true" />
          {t('startSplit')}
        </Button>
      </div>
      {!splitTarget && (
        <p id="field-split-hint" className="text-xs text-muted-foreground">
          {t('splitNeedsOne')}
        </p>
      )}
    </section>
  );
}

export interface FieldDrawPanelProps {
  draw: FieldDraw;
  splitTarget: SplitTarget | null;
}

/**
 * Panel trybu "wlasne pole": przelacznik rysowanie / podzial, instrukcja, liczba punktow i pole powierzchni na
 * biezaco, komunikat o problemie (za malo punktow, przeciete boki, linia obok dzialki), wybor czesci po podziale.
 * Przyciski "cofnij" i "analizuj" sa w pasku arkusza (widoczne takze w zwinietym arkuszu na telefonie).
 */
export function FieldDrawPanel({ draw, splitTarget }: FieldDrawPanelProps) {
  const t = useTranslations('parcels.field');
  const formatArea = useAreaFormatter();
  const ids = useId();
  const mode = draw.mode ?? 'draw';
  const { start, stop, clear, choosePart } = draw;
  const changeMode = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => start(event.currentTarget.value === 'split' ? 'split' : 'draw'),
    [start],
  );
  const changePart = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => choosePart(event.currentTarget.value === '1' ? 1 : 0),
    [choosePart],
  );
  const full = mode === 'draw' && draw.points.length >= FIELD_LIMITS.maxVertices;
  const rootRef = useRef<HTMLElement>(null);

  // Panel zastepuje liste dzialek, ktora mogla byc przewinieta - naglowek i pole powierzchni maja byc na gorze
  // (w zwinietym arkuszu na telefonie widac tylko poczatek tresci).
  useEffect(() => {
    let parent = rootRef.current?.parentElement ?? null;

    while (parent && parent.scrollHeight <= parent.clientHeight) parent = parent.parentElement;
    parent?.scrollTo({ top: 0 });
  }, []);

  return (
    <section
      ref={rootRef}
      className="flex flex-col gap-3"
      aria-labelledby={`${ids}-title`}
      data-testid="field-draw"
    >
      <div className="flex items-center justify-between gap-2">
        <h1 id={`${ids}-title`} className="text-xl font-bold text-primary">
          {t('title')}
        </h1>
        <Button variant="ghost" size="xl" className="min-w-11 px-3" onClick={stop}>
          <X aria-hidden="true" />
          <span className="max-sm:sr-only">{t('cancel')}</span>
        </Button>
      </div>

      <output className="block text-base font-semibold" data-testid="field-area" aria-live="polite">
        {draw.areaHa === null
          ? t('points', { count: draw.points.length })
          : t('area', { area: formatArea(draw.areaHa) })}
      </output>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t('modeLabel')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['draw', 'split'] as const).map((option) => (
            <label
              key={option}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-2 has-focus-visible:ring-ring/60 has-disabled:cursor-not-allowed has-disabled:opacity-50',
              )}
            >
              <input
                type="radio"
                name={`${ids}-mode`}
                value={option}
                checked={mode === option}
                disabled={option === 'split' && !splitTarget}
                onChange={changeMode}
                className="sr-only"
              />
              {option === 'draw' ? (
                <PencilRuler aria-hidden="true" className="size-4" />
              ) : (
                <Scissors aria-hidden="true" className="size-4" />
              )}
              {t(`modes.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-sm">
        {mode === 'draw' ? t('drawHelp') : t('splitHelp', { number: splitTarget?.number ?? '' })}
      </p>

      {draw.issue && (
        <p
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            draw.issue === 'selfIntersecting' || draw.issue === 'lineOutside'
              ? 'bg-destructive/10 text-foreground'
              : 'bg-muted',
          )}
          data-issue={draw.issue}
        >
          {draw.issue === 'needMore' && t('needMore', { count: draw.missingPoints })}
          {draw.issue === 'selfIntersecting' && t('selfIntersecting')}
          {draw.issue === 'lineMissing' && t('lineMissing', { count: draw.points.length })}
          {draw.issue === 'lineOutside' && t('lineOutside')}
        </p>
      )}
      {full && (
        <p className="text-sm text-muted-foreground">{t('maxPoints', { max: FIELD_LIMITS.maxVertices })}</p>
      )}

      {mode === 'split' && draw.partsHa && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t('partsLabel')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {draw.partsHa.map((areaHa, index) => (
              <label
                key={index === 0 ? 'a' : 'b'}
                className="flex min-h-14 cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-2 has-focus-visible:ring-ring/60"
              >
                <input
                  type="radio"
                  name={`${ids}-part`}
                  value={index}
                  checked={draw.part === index}
                  onChange={changePart}
                  className="sr-only"
                />
                <span className="font-semibold">{t('part', { letter: index === 0 ? 'A' : 'B' })}</span>
                <span className="text-sm text-muted-foreground">
                  {t('partArea', { area: formatArea(areaHa) })}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {draw.points.length > 0 && (
        <Button variant="outline" size="xl" onClick={clear}>
          {t('clear')}
        </Button>
      )}
    </section>
  );
}

export interface FieldDrawUndoProps {
  draw: FieldDraw;
}

/** "Cofnij punkt" w pasku arkusza - pod reka obok glownej akcji, takze w zwinietym arkuszu. */
export function FieldDrawUndo({ draw }: FieldDrawUndoProps) {
  const t = useTranslations('parcels.field');

  return (
    <Button
      variant="outline"
      size="xl"
      className="shrink-0 px-3"
      onClick={draw.undo}
      disabled={draw.points.length === 0}
    >
      <Undo2 aria-hidden="true" />
      <span className="max-[22rem]:sr-only">{t('undo')}</span>
    </Button>
  );
}

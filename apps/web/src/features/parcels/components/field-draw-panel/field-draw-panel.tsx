import { PencilRuler, RotateCcw, Scissors, Undo2, X } from 'lucide-react';
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

type HintKey =
  | 'splitStart'
  | 'splitEnd'
  | 'splitOutside'
  | 'splitChoose'
  | 'splitNoParcel'
  | 'drawStart'
  | 'drawMore'
  | 'drawCrossing'
  | 'drawDone';

/** Co rolnik ma teraz zrobic na mapie (jedno zdanie) i ktory to krok z trzech. */
function guidance(draw: FieldDraw, splitTarget: SplitTarget | null): { hint: HintKey; step: 0 | 1 | 2 } {
  if (draw.mode === 'split') {
    if (!splitTarget) return { hint: 'splitNoParcel', step: 0 };

    if (draw.points.length === 0) return { hint: 'splitStart', step: 0 };

    if (draw.points.length === 1) return { hint: 'splitEnd', step: 1 };

    return draw.partsHa ? { hint: 'splitChoose', step: 2 } : { hint: 'splitOutside', step: 0 };
  }

  if (draw.points.length === 0) return { hint: 'drawStart', step: 0 };

  if (draw.issue === 'needMore') return { hint: 'drawMore', step: 0 };

  if (draw.issue === 'selfIntersecting') return { hint: 'drawCrossing', step: 0 };

  return { hint: 'drawDone', step: 2 };
}

const STEP_KEYS = {
  split: ['steps.split.start', 'steps.split.end', 'steps.split.choose'],
  draw: ['steps.draw.start', 'steps.draw.area', 'steps.draw.done'],
} as const;

/**
 * Duza podpowiedz na mapie w trybie "wlasne pole": jedno zdanie, co zrobic teraz (czytnik ekranu ja odczytuje).
 * Stoi u gory mapy, wiec nie zaslania miejsca, w ktorym rolnik stuka.
 */
export function FieldDrawHint({ draw, splitTarget }: FieldDrawPanelProps) {
  const t = useTranslations('parcels.field.hint');
  const formatArea = useAreaFormatter();
  const { hint } = guidance(draw, splitTarget);

  return (
    <output
      aria-live="polite"
      className="block rounded-2xl bg-foreground px-4 py-3 text-base font-medium text-background shadow-lg md:text-lg"
      data-testid="field-draw-hint"
    >
      {t(hint, { area: formatArea(draw.areaHa ?? 0), count: draw.missingPoints })}
    </output>
  );
}

/**
 * Panel trybu "wlasne pole": wybor sposobu (podzial linia albo obrys), trzy kroki z zaznaczonym biezacym, pole
 * powierzchni na biezaco, wybor czesci po podziale (tez stuknieciem w mape) i "Zacznij od nowa". "Cofnij" i "Gotowe -
 * dalej" sa w pasku arkusza (widoczne takze w zwinietym arkuszu na telefonie), podpowiedz - na mapie.
 */
export function FieldDrawPanel({ draw, splitTarget }: FieldDrawPanelProps) {
  const t = useTranslations('parcels.field');
  const formatArea = useAreaFormatter();
  const ids = useId();
  const mode = draw.mode ?? 'draw';
  const { start, stop, clear, choosePart } = draw;
  const { step } = guidance(draw, splitTarget);
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
      className="flex flex-col gap-4"
      aria-labelledby={`${ids}-title`}
      data-testid="field-draw"
    >
      <div className="flex items-center justify-between gap-2">
        <h1 id={`${ids}-title`} className="text-2xl font-medium tracking-tight max-md:text-xl">
          {mode === 'split' ? t('titleSplit') : t('titleDraw')}
        </h1>
        <Button variant="ghost" size="sm" className="min-w-11 px-3" onClick={stop}>
          <X aria-hidden="true" />
          <span className="max-sm:sr-only">{t('cancel')}</span>
        </Button>
      </div>

      <p className="text-2xl font-medium tabular-nums" data-testid="field-area">
        {draw.areaHa === null
          ? t('points', { count: draw.points.length })
          : t('yourArea', { area: formatArea(draw.areaHa) })}
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t('modeLabel')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['split', 'draw'] as const).map((option) => (
            <label
              key={option}
              className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-input px-3 text-base font-medium has-checked:border-accent has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring has-disabled:cursor-not-allowed has-disabled:opacity-50"
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
                <PencilRuler aria-hidden="true" className="size-5" />
              ) : (
                <Scissors aria-hidden="true" className="size-5" />
              )}
              {t(`modes.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <ol aria-label={t('stepsLabel')} className="flex flex-col gap-2">
        {STEP_KEYS[mode].map((key, index) => (
          <li
            key={key}
            aria-current={index === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-3',
              index === step ? 'font-medium' : 'text-muted-foreground',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold',
                index === step ? 'bg-accent text-accent-foreground' : 'border-2 border-input',
              )}
            >
              {index + 1}
            </span>
            {t(key)}
          </li>
        ))}
      </ol>

      {draw.issue === 'selfIntersecting' && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3" data-issue={draw.issue}>
          {t('selfIntersecting')}
        </p>
      )}
      {draw.issue === 'lineOutside' && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3" data-issue={draw.issue}>
          {t('lineOutside')}
        </p>
      )}
      {full && (
        <p className="text-sm text-muted-foreground">{t('maxPoints', { max: FIELD_LIMITS.maxVertices })}</p>
      )}

      {mode === 'split' && draw.partsHa && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-base font-medium">{t('partsLabel')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {draw.partsHa.map((areaHa, index) => (
              <label
                key={index === 0 ? 'a' : 'b'}
                className="flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border-2 border-input px-4 py-2 has-checked:border-accent has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
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
                <span className="text-sm">{t('partArea', { area: formatArea(areaHa) })}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {draw.points.length > 0 && (
        <Button variant="outline" size="lg" onClick={clear}>
          <RotateCcw aria-hidden="true" />
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

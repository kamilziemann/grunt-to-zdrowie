import { useTranslations } from 'use-intl';

const STEPS = ['zoom', 'click', 'confirm'] as const;

/**
 * Pierwsze wejscie na mape (pusta lista, nic nie wyszukano): trzy krotkie kroki "jak wskazac dzialke". Przyklady wyniku
 * i opis aplikacji sa na stronie glownej - tu tylko to, co trzeba zrobic na mapie.
 */
export function MapIntro() {
  const t = useTranslations('parcels.mapIntro');

  return (
    <section
      aria-labelledby="map-intro-title"
      className="flex flex-col gap-3 rounded-2xl bg-muted p-4"
      data-testid="map-intro"
    >
      <h2 id="map-intro-title" className="text-lg font-medium">
        {t('title')}
      </h2>
      <ol className="flex flex-col gap-2.5">
        {STEPS.map((key, index) => (
          <li key={key} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground"
            >
              {index + 1}
            </span>
            <span className="pt-0.5">{t(`steps.${key}`)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

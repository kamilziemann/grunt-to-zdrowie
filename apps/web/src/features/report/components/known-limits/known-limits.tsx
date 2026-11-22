import type { LimitationId, WaterReport } from '@app/contracts';
import { BookOpen } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Link } from '@/lib/navigation';
import { routes } from '@/lib/routes';

/** Ograniczenia waznie dla rolnika (kolejnosc = waga); techniczne zostaja w sekcji zrodel. */
const FARMER_LIMITS: readonly LimitationId[] = [
  'sample_data',
  'land_use_unknown',
  'meteo_missing',
  'soil_missing',
  'vegetation_missing',
  'vegetation_before_archive',
  'vegetation_few_pixels',
  'meteo_coarse_grid',
  'soil_estimated',
  'drainage_structures_unknown',
  'no_in_situ_measurement',
  'terrain_missing',
  'hydro_missing',
];

const MAX_ITEMS = 3;

/**
 * "Na co uważać przy tej ocenie": do trzech ograniczen z raportu jezykiem rolnika i stale zdanie, ze to porada, nie
 * ekspertyza, i link do "Jak liczymy". Pelna lista - w sekcji zrodel (szczegoly).
 */
export function KnownLimits({ report }: { report: WaterReport }) {
  const t = useTranslations('report.simple.limits');
  const tItems = useTranslations('report.sources.limitationItems');
  const items = FARMER_LIMITS.filter((id) => report.limitations.includes(id)).slice(0, MAX_ITEMS);

  return (
    <section
      aria-labelledby="nie-wie-title"
      className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-5 sm:p-6 print:break-inside-avoid print:border-foreground/40 print:bg-transparent print:p-4"
      data-testid="known-limits"
    >
      <h3 id="nie-wie-title" className="text-xl font-semibold">
        {t('title')}
      </h3>
      {items.length > 0 && (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-lg leading-snug">
          {items.map((id) => (
            <li key={id}>{tItems(id)}</li>
          ))}
        </ul>
      )}
      <p className="text-base text-muted-foreground">{t('advice')}</p>
      <Link
        href={routes.method()}
        className="inline-flex min-h-12 w-fit items-center gap-2 text-base font-semibold text-primary underline underline-offset-4 print:hidden"
      >
        <BookOpen aria-hidden="true" className="size-5" />
        {t('method')}
      </Link>
    </section>
  );
}

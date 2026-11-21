import { ArrowRight, FileText, MapPin, Sprout } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

/**
 * Przyklad dla jury i ciekawych: dzialka na Zulawach, pszenica ozima, 15 lipca 2018 - ryzyko suszy, przyczyny
 * z prawdziwych danych i zastawka na rowie w polu jako pierwsze zalecenie.
 */
export const EXAMPLE_REPORT = routes.report({
  dzialki: '221002_5.0015.120',
  uprawa: 'winter_wheat',
  data: '2018-07-15',
});

const STEPS = [
  { key: 'find', icon: MapPin },
  { key: 'crop', icon: Sprout },
  { key: 'report', icon: FileText },
] as const;

/**
 * Pierwsze wejscie: co robi aplikacja w trzech krokach i "Zobacz przyklad" (gotowa dzialka i uprawa -> raport).
 * Pokazywane, dopoki lista dzialek jest pusta i nic nie wyszukano - potem ustepuje miejsca liscie.
 */
export function FirstSteps({ className }: { className?: string }) {
  const t = useTranslations('parcels.firstSteps');

  return (
    <section
      aria-labelledby="first-steps-title"
      className={cn('flex flex-col gap-3 rounded-xl border bg-card p-4', className)}
      data-testid="first-steps"
    >
      <h2
        id="first-steps-title"
        className="text-lg font-semibold text-balance max-md:order-first max-md:text-base"
      >
        {t('title')}
      </h2>
      <ol className="flex flex-col gap-2.5 max-md:gap-1.5">
        {STEPS.map(({ key, icon: Icon }, index) => (
          <li key={key} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"
            >
              <Icon className="size-4" />
            </span>
            <span className="flex flex-col">
              <span className="font-medium">
                {index + 1}. {t(`steps.${key}.title`)}
              </span>
              <span className="text-sm text-muted-foreground max-md:hidden">{t(`steps.${key}.text`)}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link
        href={EXAMPLE_REPORT}
        // na telefonie przycisk zaraz pod tytulem - widac go w arkuszu otwartym do polowy
        className={cn(
          buttonVariants({ variant: 'outline', size: 'lg' }),
          'h-auto min-h-12 flex-col gap-0 py-2 max-md:order-first',
        )}
      >
        <span className="inline-flex items-center gap-2 font-semibold">
          {t('example')}
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
        <span className="text-xs font-normal text-muted-foreground">{t('exampleNote')}</span>
      </Link>
    </section>
  );
}

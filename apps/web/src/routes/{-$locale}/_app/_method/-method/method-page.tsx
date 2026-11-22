// Tresc strony "Jak liczymy": dane -> ocena -> przyczyny -> zalecenia -> czego nie wiemy -> pewnosc -> zrodla
// z licencjami -> metody dla doradcy. Pierwsza linia kazdej czesci dla rolnika, liczby i nazwy metod nizej.
import {
  ArrowRight,
  CloudRain,
  Crosshair,
  ExternalLink,
  Leaf,
  Map as MapIcon,
  Satellite,
  Sprout,
  Trees,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import { routes } from '@/lib/routes';

const DATA: readonly {
  id: 'weather' | 'soil' | 'water' | 'plants' | 'parcels' | 'zones' | 'surroundings';
  icon: LucideIcon;
}[] = [
  { id: 'weather', icon: CloudRain },
  { id: 'soil', icon: Sprout },
  { id: 'water', icon: Waves },
  { id: 'plants', icon: Satellite },
  { id: 'parcels', icon: MapIcon },
  { id: 'zones', icon: Crosshair },
  { id: 'surroundings', icon: Trees },
];

const CAUSES = ['rain', 'soil', 'ditches', 'retention', 'crop'] as const;
const STEPS = ['retain', 'farm', 'irrigate'] as const;
const UNKNOWNS = [
  'weather',
  'soil',
  'measurement',
  'boundaries',
  'ditches',
  'structures',
  'zones',
  'terrain',
] as const;
const CONFIDENCE = ['grid', 'gaps', 'soil', 'conflict'] as const;
const METHODS = ['kbw', 'root', 'soil', 'plants', 'water', 'zones', 'surroundings', 'heat'] as const;

const SOURCES = [
  { id: 'nasaPower', href: 'https://power.larc.nasa.gov/' },
  { id: 'metNorway', href: 'https://api.met.no/' },
  { id: 'iung', href: 'https://susza.iung.pulawy.pl/progi/' },
  { id: 'soilgrids', href: 'https://soilgrids.org/' },
  { id: 'bdot', href: 'https://www.geoportal.gov.pl/pl/dane/baza-danych-obiektow-topograficznych-bdot10k/' },
  { id: 'sentinel', href: 'https://dataspace.copernicus.eu/' },
  { id: 'uldk', href: 'https://uldk.gugik.gov.pl/' },
  { id: 'ortho', href: 'https://www.geoportal.gov.pl/pl/dane/ortofotomapa-orto/' },
  { id: 'osm', href: 'https://www.openstreetmap.org/copyright' },
  { id: 'imgw', href: 'https://imgw.pl/edukacja/slowniki-hydrologiczno-meteorologiczne/' },
] as const;

const SECTIONS = [
  'data',
  'assessment',
  'causes',
  'recommendations',
  'unknowns',
  'confidence',
  'sources',
  'methods',
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-3">
      <h2 id={`${id}-title`} className="text-xl font-semibold text-balance">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Strona metodyki dla jury, doradcy i rolnika - jezykiem rolnika, z licencja i linkiem przy kazdym zrodle. */
export function MethodPage() {
  const t = useTranslations('method');

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-section text-base leading-relaxed">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-balance">{t('title')}</h1>
        <p className="text-muted-foreground">{t('lead')}</p>
        <nav aria-label={t('toc')} className="print:hidden">
          {/* cele dotykowe min. 44 px (spis czytaja tez starsi rolnicy na telefonie), podkreslenie = link */}
          <ul className="flex flex-wrap gap-x-5 text-base">
            {SECTIONS.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-11 items-center text-primary underline decoration-1 underline-offset-4 hover:decoration-2"
                >
                  {t(`${id}.title`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <Section id="data" title={t('data.title')}>
        <p>{t('data.intro')}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {DATA.map(({ id, icon: Icon }) => (
            <li key={id} className="flex gap-3 rounded-lg border bg-card p-4">
              <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{t(`data.items.${id}.title`)}</h3>
                <p className="text-sm">{t(`data.items.${id}.text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="assessment" title={t('assessment.title')}>
        {(['kbw', 'root', 'history', 'plants', 'heat', 'validation'] as const).map((id) => (
          <div key={id} className="flex flex-col gap-1">
            <h3 className="font-semibold">{t(`assessment.${id}Title`)}</h3>
            <p>{t(`assessment.${id}`)}</p>
            {id === 'kbw' && <p className="text-sm text-muted-foreground">{t('assessment.kbwNote')}</p>}
          </div>
        ))}
      </Section>

      <Section id="causes" title={t('causes.title')}>
        <p>{t('causes.intro')}</p>
        <ul className="list-disc space-y-1 pl-6">
          {CAUSES.map((id) => (
            <li key={id}>{t(`causes.items.${id}`)}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t('causes.note')}</p>
      </Section>

      <Section id="recommendations" title={t('recommendations.title')}>
        <p>{t('recommendations.intro')}</p>
        <ol className="flex flex-col gap-2">
          {STEPS.map((id, index) => (
            <li key={id} className="flex gap-3 rounded-lg border bg-card p-4">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                {index + 1}
              </span>
              <p>
                <strong>{t(`recommendations.steps.${id}.title`)}:</strong>{' '}
                {t(`recommendations.steps.${id}.text`)}
              </p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">{t('recommendations.legal')}</p>
      </Section>

      <Section id="unknowns" title={t('unknowns.title')}>
        <ul className="list-disc space-y-1 pl-6">
          {UNKNOWNS.map((id) => (
            <li key={id}>{t(`unknowns.items.${id}`)}</li>
          ))}
        </ul>
      </Section>

      <Section id="confidence" title={t('confidence.title')}>
        <p>{t('confidence.intro')}</p>
        <ul className="list-disc space-y-1 pl-6">
          {CONFIDENCE.map((id) => (
            <li key={id}>{t(`confidence.items.${id}`)}</li>
          ))}
        </ul>
        <p>{t('confidence.noBalance')}</p>
        <p className="flex gap-2 rounded-lg border bg-card p-4 font-medium">
          <Leaf aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
          {t('confidence.advice')}
        </p>
      </Section>

      <Section id="sources" title={t('sources.title')}>
        <ul className="flex flex-col gap-2" data-testid="method-sources">
          {SOURCES.map(({ id, href }) => (
            <li key={id} className="flex flex-col gap-1 rounded-lg border bg-card p-4 text-sm">
              <h3 className="text-base font-semibold">{t(`sources.items.${id}.name`)}</h3>
              <dl className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[auto_1fr]">
                <dt className="text-muted-foreground">{t('sources.use')}</dt>
                <dd>{t(`sources.items.${id}.use`)}</dd>
                <dt className="text-muted-foreground">{t('sources.licence')}</dt>
                <dd>{t(`sources.items.${id}.licence`)}</dd>
              </dl>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 self-start text-primary underline-offset-4 hover:underline"
              >
                {t('sources.open')}
                <span className="sr-only">: {t(`sources.items.${id}.name`)}</span>
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="methods" title={t('methods.title')}>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          {METHODS.map((id) => (
            <li key={id}>{t(`methods.items.${id}`)}</li>
          ))}
        </ul>
      </Section>

      <Button asChild size="xl" className="self-start print:hidden">
        <Link href={routes.home()}>
          {t('backToMap')}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </article>
  );
}

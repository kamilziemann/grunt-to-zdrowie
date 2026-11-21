// Katalog systemu designu (trasa `/design`, tylko development): tokeny i komponenty we wszystkich stanach. Cel testow wizualnych
// (spec z tagiem @visual), wiec bez animacji i z deterministyczna trescia.
import {
  HTTP_STATUS_BY_CODE,
  PROBLEM_CODES,
  problemType,
  type ProblemCode,
  type ProblemDetails,
} from '@app/contracts';
import { Sprout } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { ProblemAlert } from '@/components/shared/problem-alert';
import { RetryButton } from '@/components/shared/retry-button';
import { Spinner } from '@/components/shared/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { routes, type Crumb } from '@/lib/routes';

import { OverlayDemos } from './overlay-demos';

// Tokeny linii i pol formularzy (border, input, ring) to nie tekst: probka bez podpisu `Aa`.
// Klasy musza byc literalami (Tailwind skanuje zrodla), dlatego tablice zamiast skladania nazw.
const COLOR_TOKENS = [
  { name: 'background', swatch: 'bg-background', text: 'text-foreground' },
  { name: 'foreground', swatch: 'bg-foreground', text: 'text-background' },
  { name: 'card', swatch: 'bg-card', text: 'text-card-foreground' },
  { name: 'muted', swatch: 'bg-muted', text: 'text-muted-foreground' },
  { name: 'primary', swatch: 'bg-primary', text: 'text-primary-foreground' },
  { name: 'secondary', swatch: 'bg-secondary', text: 'text-secondary-foreground' },
  { name: 'accent', swatch: 'bg-accent', text: 'text-accent-foreground' },
  { name: 'water', swatch: 'bg-water', text: 'text-water-foreground' },
  { name: 'destructive', swatch: 'bg-destructive', text: 'text-destructive-foreground' },
  { name: 'success', swatch: 'bg-success', text: 'text-success-foreground' },
  { name: 'warning', swatch: 'bg-warning', text: 'text-warning-foreground' },
  { name: 'border', swatch: 'bg-border', text: '' },
  { name: 'input', swatch: 'bg-input', text: '' },
  { name: 'ring', swatch: 'bg-ring', text: '' },
] as const;

const TYPE_SCALE = [
  { name: 'text-4xl', className: 'text-4xl' },
  { name: 'text-3xl', className: 'text-3xl' },
  { name: 'text-2xl', className: 'text-2xl' },
  { name: 'text-xl', className: 'text-xl' },
  { name: 'text-lg', className: 'text-lg' },
  { name: 'text-base', className: 'text-base' },
  { name: 'text-sm', className: 'text-sm' },
  { name: 'text-xs', className: 'text-xs' },
] as const;

const RADII = [
  { name: 'rounded-sm', className: 'rounded-sm' },
  { name: 'rounded-md', className: 'rounded-md' },
  { name: 'rounded-lg', className: 'rounded-lg' },
  { name: 'rounded-xl', className: 'rounded-xl' },
  { name: 'rounded-2xl', className: 'rounded-2xl' },
  { name: 'rounded-full', className: 'rounded-full' },
] as const;

const SHADOWS = [
  { name: 'shadow-xs', className: 'shadow-xs' },
  { name: 'shadow-sm', className: 'shadow-sm' },
  { name: 'shadow-md', className: 'shadow-md' },
  { name: 'shadow-lg', className: 'shadow-lg' },
  { name: 'shadow-card', className: 'shadow-card' },
] as const;

const SPACING = [
  { name: '1', className: 'w-1' },
  { name: '2', className: 'w-2' },
  { name: '4', className: 'w-4' },
  { name: '6', className: 'w-6' },
  { name: '8', className: 'w-8' },
  { name: '12', className: 'w-12' },
  { name: '16', className: 'w-16' },
] as const;

// Ruch: czasy i krzywe z styles/app.css. Statyczne (bez animacji), zeby zrzuty byly deterministyczne.
const DURATIONS = [
  { name: '--duration-instant', value: '80 ms' },
  { name: '--duration-fast', value: '120 ms' },
  { name: '--duration-base', value: '200 ms' },
  { name: '--duration-slow', value: '320 ms' },
] as const;
const EASINGS = [
  { name: '--ease-out', value: 'cubic-bezier(0.23, 1, 0.32, 1)' },
  { name: '--ease-in-out', value: 'cubic-bezier(0.77, 0, 0.175, 1)' },
  { name: '--ease-spring', value: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
] as const;

const BUTTON_VARIANTS = [
  'default',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'accent',
  'link',
] as const;
const BUTTON_SIZES = ['sm', 'default', 'lg'] as const;
const ALERT_VARIANTS = ['default', 'destructive', 'warning', 'success'] as const;

// Przykladowe problemy do ProblemAlert: prosty (sam kod) i szczegolowy (lista pol + detail techniczny).
function makeProblem(code: ProblemCode, wholeObjectIssue?: string): ProblemDetails {
  const base: ProblemDetails = {
    type: problemType(code),
    title: code,
    status: HTTP_STATUS_BY_CODE[code],
    code,
  };

  if (!wholeObjectIssue) return base;

  return {
    ...base,
    detail: 'Body failed validation',
    requestId: 'req-design-1',
    issues: [
      { path: 'title', message: 'Required' },
      { path: '', message: wholeObjectIssue },
    ],
  };
}

/** Sciezka do pokazu Breadcrumbs i PageHeader: strona glowna → biezaca strona (etykiety juz przetlumaczone). */
function demoTrail(listLabel: string, currentLabel: string): Crumb[] {
  return [{ label: listLabel, href: routes.home() }, { label: currentLabel }];
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-heading`} className="text-2xl font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h3>
      {children}
    </div>
  );
}

/** Caly katalog: kolory, typografia, promienie, cienie, odstepy, ruch i komponenty (stany, bledy, nakladki). */
export function DesignCatalog() {
  const t = useTranslations('design');
  const tCommon = useTranslations('common');
  const breadcrumbs = demoTrail(t('navigation.crumbList'), t('navigation.crumbCurrent'));
  const simpleProblem = makeProblem(PROBLEM_CODES.UPSTREAM_FAILED);
  const detailedProblem = makeProblem(PROBLEM_CODES.VALIDATION_FAILED, t('problemAlert.wholeObjectIssue'));

  return (
    <div className="flex flex-col gap-12">
      <PageHeader title={t('title')} description={t('description')} />

      <Section id="colors" title={t('colors.title')} description={t('colors.description')}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLOR_TOKENS.map((token) => (
            <li key={token.name} className="flex flex-col gap-1.5">
              <div
                className={`${token.swatch} ${token.text} flex h-16 items-end rounded-lg border px-3 py-2 text-xs font-medium`}
              >
                {token.text ? 'Aa' : null}
              </div>
              <code className="font-mono text-xs">--{token.name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="typography" title={t('typography.title')} description={t('typography.description')}>
        <div className="flex flex-col gap-3">
          {TYPE_SCALE.map((step) => (
            <div key={step.name} className="flex flex-wrap items-baseline gap-4">
              <code className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{step.name}</code>
              <span className={step.className}>{t('typography.sample')}</span>
            </div>
          ))}
          <p className="font-mono text-sm">font-mono: const token = &apos;primary&apos;;</p>
        </div>
      </Section>

      <Section id="radii" title={t('radii.title')}>
        <ul className="flex flex-wrap gap-4">
          {RADII.map((radius) => (
            <li key={radius.name} className="flex flex-col items-center gap-1.5">
              <div className={`${radius.className} size-16 border-2 border-primary bg-secondary`} />
              <code className="font-mono text-xs">{radius.name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="shadows" title={t('shadows.title')}>
        <ul className="flex flex-wrap gap-6">
          {SHADOWS.map((shadow) => (
            <li key={shadow.name} className="flex flex-col items-center gap-2">
              <div className={`${shadow.className} size-20 rounded-lg border bg-card`} />
              <code className="font-mono text-xs">{shadow.name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="spacing" title={t('spacing.title')} description={t('spacing.description')}>
        <ul className="flex flex-col gap-2">
          {SPACING.map((step) => (
            <li key={step.name} className="flex items-center gap-3">
              <code className="w-12 font-mono text-xs text-muted-foreground">{step.name}</code>
              <div className={`${step.className} h-3 rounded-sm bg-primary`} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="motion" title={t('motion.title')} description={t('motion.description')}>
        <div className="grid gap-6 sm:grid-cols-2">
          <ul className="flex flex-col gap-2">
            {DURATIONS.map((duration) => (
              <li key={duration.name} className="flex items-center justify-between gap-4 text-sm">
                <code className="font-mono text-xs">{duration.name}</code>
                <span className="text-muted-foreground">{duration.value}</span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-2">
            {EASINGS.map((easing) => (
              <li key={easing.name} className="flex items-center justify-between gap-4 text-sm">
                <code className="font-mono text-xs">{easing.name}</code>
                <span className="text-muted-foreground">{easing.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="button" title={t('button.title')} description={t('button.description')}>
        <Specimen label={t('button.variants')}>
          <div className="flex flex-wrap items-center gap-3">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant}
              </Button>
            ))}
          </div>
        </Specimen>
        <Specimen label={t('button.sizes')}>
          <div className="flex flex-wrap items-center gap-3">
            {BUTTON_SIZES.map((size) => (
              <Button key={size} size={size}>
                {size}
              </Button>
            ))}
            <Button size="icon" aria-label={t('button.iconLabel')}>
              <Sprout />
            </Button>
          </div>
        </Specimen>
        <Specimen label={t('button.disabled')}>
          <div className="flex flex-wrap items-center gap-3">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} disabled>
                {variant}
              </Button>
            ))}
          </div>
        </Specimen>
        <Specimen label={t('button.loading')}>
          <div className="flex flex-wrap items-center gap-3">
            <Button loading>{t('button.saving')}</Button>
            <Button variant="outline" loading>
              {t('button.fetching')}
            </Button>
          </div>
        </Specimen>
      </Section>

      <Section id="form" title={t('form.title')} description={t('form.description')}>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="design-input-default">{t('form.default')}</Label>
            <Input id="design-input-default" placeholder={t('form.placeholder')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="design-input-disabled">{t('form.disabled')}</Label>
            <Input id="design-input-disabled" defaultValue={t('form.disabledValue')} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="design-input-error">{t('form.error')}</Label>
            <Input
              id="design-input-error"
              defaultValue=""
              aria-invalid="true"
              aria-describedby="design-input-error-msg"
            />
            <p id="design-input-error-msg" className="text-xs text-destructive">
              {t('form.errorMessage')}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-3">
            <Label htmlFor="design-textarea">Textarea</Label>
            <Textarea id="design-textarea" placeholder={t('form.textareaPlaceholder')} rows={3} />
          </div>
        </div>
      </Section>

      <Section id="alert" title={t('alert.title')} description={t('alert.description')}>
        <div className="grid gap-3">
          {ALERT_VARIANTS.map((variant) => (
            <Alert key={variant} variant={variant}>
              <Sprout aria-hidden="true" />
              <AlertTitle>{t('alert.variantTitle', { variant })}</AlertTitle>
              <AlertDescription>{t('alert.body')}</AlertDescription>
            </Alert>
          ))}
        </div>
      </Section>

      <Section id="card" title={t('card.title')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('card.cardTitle')}</CardTitle>
              <CardDescription>{t('card.cardDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t('card.content')}</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">{t('card.action')}</Button>
              <Button size="sm" variant="outline">
                {tCommon('cancel')}
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm">{t('card.contentOnly')}</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section id="skeleton" title={t('loadingStates.title')} description={t('loadingStates.description')}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2" aria-hidden="true">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Spinner />
          <Spinner label={t('loadingStates.spinnerLabel')} />
        </div>
      </Section>

      <Section id="problem-alert" title={t('problemAlert.title')} description={t('problemAlert.description')}>
        <div className="grid gap-4">
          <ProblemAlert problem={simpleProblem}>
            <RetryButton />
          </ProblemAlert>
          <ProblemAlert problem={detailedProblem} title={t('problemAlert.customTitle')} />
        </div>
      </Section>

      <Section id="empty-state" title={t('emptyState.title')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <EmptyState
            icon={Sprout}
            title={t('emptyState.withIcon')}
            description={t('emptyState.withIconDescription')}
          />
          <EmptyState title={t('emptyState.plain')}>
            <Button size="sm" variant="outline">
              {t('emptyState.action')}
            </Button>
          </EmptyState>
        </div>
      </Section>

      <Section id="navigation" title={t('navigation.title')}>
        <div className="flex flex-col gap-6">
          <Breadcrumbs items={breadcrumbs} />
          <PageHeader
            title={t('navigation.headerTitle')}
            description={t('navigation.headerDescription')}
            breadcrumbs={breadcrumbs}
          >
            <Button variant="outline">{t('navigation.headerAction')}</Button>
          </PageHeader>
        </div>
      </Section>

      <Section id="overlays" title={t('overlays.title')} description={t('overlays.description')}>
        <OverlayDemos />
      </Section>
    </div>
  );
}

// Widoki bledu i 404 poziomu DOKUMENTU (trasa __root): blad poza layoutem jezyka albo nieznany jezyk w adresie
// (`/xx/...`). Nie ma tu dostawcy use-intl ani powloki aplikacji, wiec widok jest samowystarczalny: tlumacz z malego
// katalogu GLOBAL_ERROR_MESSAGES, style inline z tokenow (zmienne CSS z styles/app.css).
import { useRouter, useRouterState, type ErrorComponentProps } from '@tanstack/react-router';
import { useMemo, type CSSProperties } from 'react';
import { createTranslator } from 'use-intl';

import { GLOBAL_ERROR_MESSAGES as MESSAGES } from '@/i18n/global-error-messages';
import { localeFromPath, type AppLocale } from '@/lib/locale';
import { BRAND } from '@/lib/seo';
import { problemMessage, renderErrorProblem } from '@/lib/problems';

// Style korzystaja z tokenow (zmienne z app.css: --background, --foreground...), a nie z surowych kolorow; tekst
// idzie stosem systemowym.
const bodyStyle: CSSProperties = {
  margin: 0,
  minHeight: '100dvh',
  background: 'var(--background)',
  color: 'var(--foreground)',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
};
const boxStyle: CSSProperties = {
  maxWidth: '40rem',
  margin: '0 auto',
  padding: '4rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};
const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.625rem',
  fontWeight: 600,
};
const squareStyle: CSSProperties = { width: '0.75rem', height: '0.75rem', background: 'var(--primary)' };
const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
  lineHeight: 1,
  letterSpacing: '-0.03em',
  fontWeight: 800,
};
const textStyle: CSSProperties = { margin: 0, fontSize: '1.0625rem', lineHeight: 1.55 };
const detailStyle: CSSProperties = {
  margin: 0,
  padding: '1rem',
  background: 'var(--muted)',
  color: 'var(--muted-foreground)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.875rem',
  wordBreak: 'break-all',
};
const buttonStyle: CSSProperties = {
  alignSelf: 'flex-start',
  height: '3rem',
  padding: '0 1.25rem',
  border: 0,
  borderRadius: 'var(--radius)',
  background: 'var(--primary)',
  color: 'var(--primary-foreground)',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
};

function useDocumentLocale(): AppLocale {
  return localeFromPath(useRouterState({ select: (state) => state.location.pathname }));
}

function translators(locale: AppLocale) {
  const messages = MESSAGES[locale];

  return {
    errors: createTranslator({ locale, messages, namespace: 'errors' }),
    problems: createTranslator({ locale, messages, namespace: 'problems' }),
    common: createTranslator({ locale, messages, namespace: 'common' }),
  };
}

// Stale tlumacze per jezyk: te same obiekty miedzy renderami (stabilne propsy akcji w useMemo).
const TRANSLATORS: Record<AppLocale, ReturnType<typeof translators>> = {
  pl: translators('pl'),
  en: translators('en'),
};

function DocumentPanel({
  title,
  text,
  detail,
  action,
}: {
  title: string;
  text: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div role="alert" style={bodyStyle}>
      <div style={boxStyle}>
        <span style={eyebrowStyle}>
          <span aria-hidden="true" style={squareStyle} />
          {BRAND}
        </span>
        <h1 style={headingStyle}>{title}</h1>
        <p style={textStyle}>{text}</p>
        {detail ? <p style={detailStyle}>{detail}</p> : null}
        {action ? (
          <button type="button" onClick={action.onClick} style={buttonStyle}>
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Blad poziomu dokumentu: komunikat wg kodu Problem Details i ponowienie (ponowne loadery trasy). */
export function DocumentError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const t = TRANSLATORS[useDocumentLocale()];
  const problem = renderErrorProblem(error);
  const retry = useMemo(
    () => ({ label: t.common('tryAgain'), onClick: () => void router.invalidate() }),
    [t, router],
  );

  return (
    <DocumentPanel
      title={t.errors('globalTitle')}
      text={problemMessage(t.problems, problem.code)}
      detail={problem.detail}
      action={retry}
    />
  );
}

const HOME_ACTION = { label: BRAND, onClick: () => window.location.assign('/') };

/** 404 poziomu dokumentu (nieznany jezyk w adresie): link na strone glowna. */
export function DocumentNotFound() {
  const t = TRANSLATORS[useDocumentLocale()];

  return (
    <DocumentPanel title={t.problems('not_found')} text={t.errors('globalTitle')} action={HOME_ACTION} />
  );
}

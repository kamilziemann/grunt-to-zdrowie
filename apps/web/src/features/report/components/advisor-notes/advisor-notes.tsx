import { useTranslations } from 'use-intl';

const LINES = Array.from({ length: 9 }, (_, index) => index);

/** Miejsce na notatki doradcy - tylko na wydruku, na koncu raportu (linie do pisania recznego). */
export function AdvisorNotes() {
  const t = useTranslations('report.print');

  return (
    <section
      aria-labelledby="notatki-title"
      className="hidden print:block print:break-inside-avoid print:pt-6"
      data-testid="advisor-notes"
    >
      <h2 id="notatki-title" className="text-lg font-semibold">
        {t('notes')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('notesHint')}</p>
      <div aria-hidden="true" className="mt-2">
        {LINES.map((line) => (
          <div key={line} className="h-9 border-b border-foreground/40" />
        ))}
      </div>
    </section>
  );
}

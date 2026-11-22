import type { WaterReport } from '@app/contracts';

import { routes } from '@/lib/routes';

import { CopyLinkButton } from '../copy-link-button';
import { PrintButton } from '../print-button';

/**
 * Pasek przyklejony do dolu ekranu telefonu: "Zapisz PDF" i "Udostepnij" (krotki link zapisanego raportu) zawsze pod
 * kciukiem. Na komputerze te akcje sa w naglowku raportu; na wydruku pasek znika.
 */
export function ShareBar({ report }: { report: WaterReport }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 items-start gap-2 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden print:hidden"
      data-testid="share-bar"
    >
      <PrintButton short className="h-auto min-h-12 rounded-full text-base" />
      <CopyLinkButton
        share
        // przyciski w jednym rzedzie, pole z adresem (gdy schowek nie dziala) w calym wierszu pod nimi - w polowie
        // paska bylo uciete, a przycisk "Zapisz PDF" rozciagal sie na jego wysokosc
        className="contents [&_label]:col-span-2"
        path={routes.report({ raport: report.meta.reportId })}
        buttonClassName="rounded-full text-base max-sm:text-base"
      />
    </div>
  );
}

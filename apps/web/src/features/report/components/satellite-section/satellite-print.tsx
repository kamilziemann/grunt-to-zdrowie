// Zdjecia z satelity do wydruku pobieramy na zadanie: przed wydrukiem (na ekranie pobiera je wybor trybu karty).
// "Zapisz PDF" najpierw pobiera oba obrazy (pierwsze pobranie trwa do kilkunastu sekund), czeka, az sie narysuja,
// i dopiero wtedy otwiera okno wydruku - PDF nie ma pustych ramek. Bez dostawcy (testy pojedynczych komponentow)
// wydruk rusza od razu.
import type { WaterReport } from '@app/contracts';
import { CancelledError, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

import { IMAGERY_LAYERS } from '@app/contracts';

import { reportImageryQuery } from '../../api/imagery.queries';

/** Dzialki i dzien zdjecia; null = pole bez dzialek (wlasny obrys) - zdjecia nie pobieramy. */
export function imageryRequest(report: WaterReport): { dzialki: string; date: string } | null {
  const ids = report.field.parcelIds;

  if (ids.length === 0) return null;

  // kolejnosc dzialek nie zmienia obrazu - posortowane = jeden wpis cache (jak na mapie dzialek)
  return { dzialki: ids.toSorted().join(','), date: report.meta.analysisDate };
}

/** Najdluzej czekamy na zdjecia przed wydrukiem; potem drukujemy z tym, co jest (zdanie zamiast ramki). */
const PRINT_WAIT_MS = 30_000;

/** Ile razy czekamy od nowa po anulowanym pobraniu (sekcja przerysowala sie w trakcie i ponowila zapytanie). */
const CANCEL_RETRIES = 3;

/**
 * Pobiera obraz i czeka na wynik. Gdy sekcja "Pole z satelity" przerysuje sie w trakcie, jej obserwator anuluje
 * trwajace pobranie i zaczyna nowe - wtedy dolaczamy do nowego zamiast uznac, ze "juz po pobraniu" (inaczej okno
 * wydruku otwieraloby sie przed zdjeciami). Blad inny niz anulowanie konczy czekanie: sekcja pokaze zdanie.
 */
async function fetchImage(
  queryClient: QueryClient,
  options: ReturnType<typeof reportImageryQuery>,
  attempt = 0,
): Promise<void> {
  try {
    await queryClient.query(options);
  } catch (error) {
    if (!(error instanceof CancelledError) || attempt >= CANCEL_RETRIES) return;

    await nextFrame();
    await fetchImage(queryClient, options, attempt + 1);
  }
}

interface SatellitePrint {
  /** obrazy maja sie pobrac do bloku na wydruku */
  requested: boolean;
  /** trwa pobieranie przed wydrukiem */
  preparing: boolean;
  /** pobiera obrazy, czeka na ich narysowanie i otwiera okno wydruku */
  print: () => void;
}

const SatellitePrintContext = createContext<SatellitePrint>({
  requested: false,
  preparing: false,
  print: () => window.print(),
});

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Czeka, az obrazy sekcji sie zdekoduja (data URL w `<img>` dekoduje sie asynchronicznie). */
async function imagesDecoded(): Promise<void> {
  await nextFrame();
  const images = [...document.querySelectorAll<HTMLImageElement>('img[data-satellite-image]')];

  await Promise.allSettled(images.map((image) => image.decode()));
}

export function SatellitePrintProvider({ report, children }: { report: WaterReport; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [requested, setRequested] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const print = useCallback(() => {
    const target = imageryRequest(report);

    if (!target) {
      window.print();

      return;
    }

    setRequested(true);
    setPreparing(true);
    const fetches = Promise.all(
      IMAGERY_LAYERS.map((layer) =>
        fetchImage(queryClient, reportImageryQuery(target.dzialki, target.date, layer)),
      ),
    );
    const timeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, PRINT_WAIT_MS);
    });

    void Promise.race([fetches, timeout])
      .then(imagesDecoded)
      .finally(() => {
        setPreparing(false);
        window.print();
      });
  }, [queryClient, report]);
  const value = useMemo(() => ({ requested, preparing, print }), [requested, preparing, print]);

  return <SatellitePrintContext value={value}>{children}</SatellitePrintContext>;
}

export function useSatellitePrint(): SatellitePrint {
  return use(SatellitePrintContext);
}

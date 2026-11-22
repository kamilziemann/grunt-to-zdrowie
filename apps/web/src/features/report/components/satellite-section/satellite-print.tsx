// Zdjecia z satelity w raporcie pobieramy na zadanie: po rozwinieciu sekcji "Pole z satelity" albo przed wydrukiem.
// "Zapisz PDF" najpierw pobiera oba obrazy (pierwsze pobranie trwa do kilkunastu sekund), czeka, az sie narysuja,
// i dopiero wtedy otwiera okno wydruku - PDF nie ma pustych ramek. Bez dostawcy (testy pojedynczych komponentow)
// wydruk rusza od razu.
import type { WaterReport } from '@app/contracts';
import { useQueryClient } from '@tanstack/react-query';
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

interface SatellitePrint {
  /** obrazy maja sie pobrac (sekcja rozwinieta albo wydruk) */
  requested: boolean;
  request: () => void;
  /** trwa pobieranie przed wydrukiem */
  preparing: boolean;
  /** pobiera obrazy, czeka na ich narysowanie i otwiera okno wydruku */
  print: () => void;
}

const SatellitePrintContext = createContext<SatellitePrint>({
  requested: false,
  request: () => undefined,
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
  const request = useCallback(() => setRequested(true), []);
  const print = useCallback(() => {
    const target = imageryRequest(report);

    if (!target) {
      window.print();

      return;
    }

    setRequested(true);
    setPreparing(true);
    const fetches = Promise.allSettled(
      IMAGERY_LAYERS.map((layer) =>
        queryClient.query(reportImageryQuery(target.dzialki, target.date, layer)),
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
  const value = useMemo(
    () => ({ requested, request, preparing, print }),
    [requested, request, preparing, print],
  );

  return <SatellitePrintContext value={value}>{children}</SatellitePrintContext>;
}

export function useSatellitePrint(): SatellitePrint {
  return use(SatellitePrintContext);
}

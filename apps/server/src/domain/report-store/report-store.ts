// Port zapisu raportow analiz (implementacja: repositories/reports na D1). Raport jest powtarzalny: ten sam klucz
// daje ten sam raport, wiec powtorke oddajemy z zapisu zamiast pytac zrodla od nowa.
import type { WaterReport } from '@app/contracts';

/** Klucz zapisanego raportu: pole + uprawa + data + wersja silnika. */
export interface ReportKey {
  id: string;
  fieldId: string;
  cropId: string;
  analysisDate: string;
  engineVersion: string;
}

/** Zapis raportow (D1). Odczyt oddaje null, gdy raportu nie ma albo jego klucz sie nie zgadza (kolizja skrotu). */
export interface ReportStore {
  get(id: string): Promise<{ key: ReportKey; report: WaterReport; createdAt: string } | null>;
  /** zapis albo nadpisanie raportu o tym samym identyfikatorze (odswiezenie raportu "na dzis") */
  save(key: ReportKey, report: WaterReport, createdAt: string): Promise<void>;
}

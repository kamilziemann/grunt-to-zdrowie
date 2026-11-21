// Port zapisu raportow analiz (implementacja: repositories/reports na D1). Raport jest powtarzalny: ten sam klucz
// daje ten sam raport, wiec powtorke oddajemy z zapisu zamiast pytac zrodla od nowa.
import type { WaterReport } from '@app/contracts';

/**
 * Raporty starsze niz tyle dni usuwa kazdy zapis - powtorki po miesiacu i tak licza sie od nowa (nowa wersja silnika,
 * nowe dane), a tabela nie rosnie bez konca. Link do raportu dziala tyle samo.
 */
export const REPORT_RETENTION_DAYS = 30;

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
  /**
   * zapis albo nadpisanie raportu o tym samym identyfikatorze (odswiezenie raportu "na dzis"); przy okazji usuwa
   * raporty zapisane wczesniej niz REPORT_RETENTION_DAYS przed `createdAt`
   */
  save(key: ReportKey, report: WaterReport, createdAt: string): Promise<void>;
}

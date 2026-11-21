// Zaleznosci serwisu analizy: zrodla danych i etapy obliczen (definicje w domain) oraz pobranie dzialki.
import type { Parcel } from '@app/contracts';

export type { DataSources, Sourced } from '../../domain/analysis-ports';
export type { AnalysisStages, StageInput } from '../../domain/analysis-stages';
export type { ParcelRegistry, ParcelRegistryEntry } from '../../domain/parcel-source';

/** Dzialka z geometria po identyfikatorze; brak dzialki = AppError not_found (jak w services/parcels). */
export interface ParcelLookup {
  get(id: string): Promise<Parcel>;
}

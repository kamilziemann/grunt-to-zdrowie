// Etapy obliczen silnika analizy - szwy, w ktorych pakiety planu podmieniaja wersje przykladowa na wlasciwa:
// ocena (P2 KBW + P7 bilans + P8), historia (P8), przyczyny i zalecenia (P9), strefy (P12).
// Etapy sa czystymi funkcjami: dostaja dane ze zrodel (albo null, gdy zrodlo milczy) i oddaja czesci raportu.
import type {
  Assessment,
  Cause,
  CropAtDate,
  CropId,
  FieldArea,
  History,
  LimitationId,
  ReportPart,
  SourceId,
  WaterReport,
  ZoneMap,
} from '@app/contracts';

import type {
  ForecastSeries,
  HydroContext,
  MeteoSeries,
  SoilProfile,
  TerrainData,
  VegetationSeries,
} from '../analysis-ports';

export interface StageInput {
  field: FieldArea;
  cropId: CropId;
  /** data analizy; etapy nie uzywaja danych pozniejszych niz ta data */
  date: string;
  crop: CropAtDate;
  meteo: MeteoSeries | null;
  forecast: ForecastSeries | null;
  soil: SoilProfile | null;
  terrain: TerrainData | null;
  hydro: HydroContext | null;
  vegetation: VegetationSeries | null;
  /** zrodla, ktore oddaly dane przykladowe (atrapy) - etap nie moze przypisac im wysokiej pewnosci */
  sampleSources?: readonly SourceId[];
}

export type Recommendations = WaterReport['recommendations'];

export interface AnalysisStages {
  /** czesci raportu liczone jeszcze przykladowymi regulami - raport mowi o tym w `meta.sampleParts` */
  sampleParts: readonly ReportPart[];
  /** Faza i Kc uprawy w dacie analizy. */
  crop(cropId: CropId, date: string): CropAtDate;
  /** Ocena sytuacji wodnej w dacie analizy. */
  assess(input: StageInput): Assessment;
  /** Podatnosc na niedobory w 10 sezonach przed data analizy. */
  history(input: StageInput): History;
  /** Przyczyny niedoboru - tylko gdy ocena je uzasadnia. */
  causes(input: StageInput, assessment: Assessment): Cause[];
  /** Strefy wewnatrz pola; null, gdy brakuje danych przestrzennych. */
  zones(input: StageInput): ZoneMap | null;
  /** Zalecenia wynikaja z oceny i przyczyn: retencja, potem agrotechnika, na koncu nawadnianie. */
  recommend(
    input: StageInput,
    assessment: Assessment,
    causes: Cause[],
    zones: ZoneMap | null,
  ): Recommendations;
  /** Ograniczenia wynikajace z obliczen (ograniczenia zrodel doklada orkiestrator). */
  limitations(input: StageInput, assessment: Assessment): LimitationId[];
}

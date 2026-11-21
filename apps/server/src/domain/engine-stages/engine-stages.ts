// Etapy silnika analizy w wersji uzywanej przez aplikacje: ocena i historia (KBW wg IUNG + bilans strefy korzeniowej
// FAO-56), przyczyny i zalecenia (reguly na danych z raportu) oraz strefy na polu (siatka 10 m z rastra Sentinel-2,
// terenu i rowow - pakiet P12). Z wersji przykladowej zostaly tylko ograniczenia (lista jest juz liczona z danych).
import type { AnalysisStages } from '../analysis-stages';
import { assess } from '../assessment';
import { causes } from '../causes';
import { cropAtDate } from '../crop-calendar';
import { history } from '../history';
import { recommend } from '../recommendations';
import { sampleStages } from '../sample-stages';
import { fieldZones } from '../zones';

export const engineStages: AnalysisStages = {
  // ograniczenia z wersji przykladowej
  ...sampleStages,
  sampleParts: [],
  crop: cropAtDate,
  assess,
  history,
  causes,
  zones: fieldZones,
  recommend,
};

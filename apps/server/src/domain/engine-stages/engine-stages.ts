// Etapy silnika analizy w wersji uzywanej przez aplikacje: ocena i historia (KBW wg IUNG + bilans strefy korzeniowej
// FAO-56), przyczyny i zalecenia (reguly na danych z raportu) sa liczone; strefy na polu sa jeszcze przykladowe
// (pakiet P12) - raport mowi o tym w `meta.sampleParts`. Kazdy etap podmienia sie tutaj osobno.
import type { AnalysisStages } from '../analysis-stages';
import { assess } from '../assessment';
import { causes } from '../causes';
import { cropAtDate } from '../crop-calendar';
import { history } from '../history';
import { recommend } from '../recommendations';
import { sampleStages } from '../sample-stages';

export const engineStages: AnalysisStages = {
  // strefy i ograniczenia z wersji przykladowej
  ...sampleStages,
  sampleParts: ['zones'],
  crop: cropAtDate,
  assess,
  history,
  causes,
  recommend,
};

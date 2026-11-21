// Etapy silnika analizy w wersji uzywanej przez aplikacje: ocena i historia sa liczone z danych (KBW wg IUNG +
// bilans strefy korzeniowej FAO-56), a przyczyny, strefy i zalecenia sa jeszcze przykladowe (pakiety P9 i P12) -
// raport mowi o tym w `meta.sampleParts`. Kazdy etap podmienia sie tutaj osobno.
import type { AnalysisStages } from '../analysis-stages';
import { assess } from '../assessment';
import { cropAtDate } from '../crop-calendar';
import { history } from '../history';
import { sampleStages } from '../sample-stages';

export const engineStages: AnalysisStages = {
  // przyczyny, strefy, zalecenia i ograniczenia z wersji przykladowej
  ...sampleStages,
  sampleParts: ['causes', 'zones', 'recommendations'],
  crop: cropAtDate,
  assess,
  history,
};

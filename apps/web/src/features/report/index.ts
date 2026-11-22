// Publiczne API feature "report": ekran raportu wodnego (`/raport`) - ocena, historia, przyczyny, zalecenia,
// nawadnianie, zrodla i ograniczenia, z wydrukiem A4. Dane liczy feature "analysis" (POST /api/analysis); trasa
// `routes/{-$locale}/_app/raport.tsx` importuje tylko stad.
export { SAMPLE_REPORT } from './fixtures/sample-report';
export { FarmScreen, type FarmScreenProps } from './components/farm-screen';
export { ReportMissing, type ReportMissingProps } from './components/report-missing';
export { ReportScreen, type ReportScreenProps } from './components/report-screen';
export { ReportView, type ReportViewProps } from './components/report-view';
export { reportSearchSchema, type ReportSearch } from './schemas/report-search.schema';
export type { DetailsState } from './components/full-analysis';
export { StoredReportScreen, type StoredReportScreenProps } from './components/stored-report-screen';
export { RiskCalendar } from './components/risk-calendar';
export { SampleBanner } from './components/sample-banner';
export { VerdictSection } from './components/verdict-section';

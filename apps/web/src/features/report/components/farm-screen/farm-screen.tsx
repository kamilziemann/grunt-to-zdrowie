import type { CropId, IsoDate, WaterReport } from '@app/contracts';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, LoaderCircle, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { analysisReportQuery, parcelNumberOf } from '@/features/analysis';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import type { AppHref } from '@/lib/routes';

import { canStart, farmOrder } from '../../utils/farm';
import { isSampleReport, soilWater } from '../../utils/report-data';
import { LevelBadge } from '../verdict-section';

export interface FarmScreenProps {
  parcelIds: readonly string[];
  cropId: CropId;
  date: IsoDate;
  /** pelny raport jednej dzialki (te same uprawa i dzien) */
  reportHref: (parcelId: string) => AppHref;
  changeHref: AppHref;
  mapHref: AppHref;
}

type RowState = 'waiting' | 'running' | 'failed' | 'done';

interface Row {
  id: string;
  number: string;
  report: WaterReport | null;
  state: RowState;
  retry: () => void;
}

/**
 * Gospodarstwo (I2): kazda dzialka analizowana osobno (najwyzej dwie naraz - zrodla danych sa wspolne), tabela
 * "gdzie dzialac najpierw" od najpilniejszej i przejscie do pelnego raportu dzialki (raport jest juz w cache
 * zapytan, wiec otwiera sie od razu). Na waskim ekranie karty zamiast tabeli.
 */
export function FarmScreen({ parcelIds, cropId, date, reportHref, changeHref, mapHref }: FarmScreenProps) {
  const t = useTranslations('report.farm');
  // Kolejka: zapytanie rusza, gdy przed nim w toku jest mniej niz FARM_CONCURRENCY (useQueries nie ma limitu).
  // Stan zakonczonych czytamy z cache zapytan w renderze; obserwatorzy (takze wylaczeni) odswiezaja komponent po
  // kazdym wyniku, wiec kolejne zapytanie odblokowuje sie samo.
  const queryClient = useQueryClient();
  const options = parcelIds.map((id) => analysisReportQuery({ field: { parcelIds: [id] }, cropId, date }));
  const settled = options.map((option) => {
    const status = queryClient.getQueryState(option.queryKey)?.status;

    return status === 'success' || status === 'error';
  });
  const gated = useQueries({
    queries: options.map((option, index) => Object.assign(option, { enabled: canStart(settled, index) })),
  });

  const rows = useMemo(
    (): Row[] =>
      parcelIds.map((id, index) => {
        const query = gated[index];
        const report = query?.data ?? null;
        let state: RowState = 'waiting';

        if (report) state = 'done';
        else if (query?.isError) state = 'failed';
        else if (query?.isFetching) state = 'running';

        return {
          id,
          number: parcelNumberOf(id),
          report,
          state,
          retry: () => void query?.refetch(),
        };
      }),
    [parcelIds, gated],
  );
  const ordered = farmOrder(rows);
  const done = rows.filter((row) => row.state === 'done').length;
  const sample = rows.some((row) => row.report && isSampleReport(row.report));

  return (
    <div className="flex flex-col gap-section">
      <PageHeader title={t('title')} description={t('description')}>
        <Button asChild variant="outline" size="xl">
          <Link href={changeHref}>
            <ArrowLeft aria-hidden="true" />
            {t('change')}
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold">{t('order')}</h2>
          <output className="text-sm text-muted-foreground" aria-live="polite" data-testid="farm-progress">
            {t('progress', { done, total: rows.length })}
          </output>
        </div>
        {sample && <p className="text-sm text-muted-foreground">{t('sample')}</p>}

        {/* telefon: karty */}
        <ol className="flex flex-col gap-3 md:hidden" data-testid="farm-cards">
          {ordered.map((row, index) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-lg border bg-card p-4"
              data-parcel={row.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-lg font-semibold">
                    {row.report ? `${index + 1}. ` : null}
                    {t('parcel', { number: row.number })}
                  </span>
                  <RowStatus row={row} />
                </div>
              </div>
              {row.report && <RowFacts report={row.report} />}
              <RowAction row={row} href={reportHref(row.id)} />
            </li>
          ))}
        </ol>

        {/* komputer: tabela */}
        <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full text-left text-sm" data-testid="farm-table">
            <thead className="bg-muted/50">
              <tr>
                {(['rank', 'parcel', 'level', 'water', 'stress', 'confidence', 'report'] as const).map(
                  (key) => (
                    <th key={key} scope="col" className="px-3 py-2 font-medium">
                      {t(`headers.${key}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {ordered.map((row, index) => (
                <tr key={row.id} className="border-t" data-parcel={row.id}>
                  <td className="px-3 py-2 font-semibold tabular-nums">
                    {row.report ? index + 1 : t('none')}
                  </td>
                  <th scope="row" className="px-3 py-2 font-medium">
                    {t('parcel', { number: row.number })}
                  </th>
                  <td className="px-3 py-2">
                    <RowStatus row={row} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.report ? <WaterValue report={row.report} /> : t('none')}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.report?.assessment.rootZone
                      ? t('stressValue', { days: row.report.assessment.rootZone.stressDays30 })
                      : t('none')}
                  </td>
                  <td className="px-3 py-2">{row.report ? <Confidence report={row.report} /> : t('none')}</td>
                  <td className="px-3 py-1">
                    <RowAction row={row} href={reportHref(row.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button asChild variant="outline" size="xl" className="w-fit">
        <Link href={mapHref}>
          <ArrowLeft aria-hidden="true" />
          {t('map')}
        </Link>
      </Button>
    </div>
  );
}

function RowStatus({ row }: { row: Row }) {
  const t = useTranslations('report.farm');

  if (row.report) return <LevelBadge level={row.report.assessment.level} />;

  if (row.state === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        {t('running')}
      </span>
    );
  }

  return (
    <span className={row.state === 'failed' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
      {t(row.state === 'failed' ? 'failed' : 'waiting')}
    </span>
  );
}

function WaterValue({ report }: { report: WaterReport }) {
  const t = useTranslations('report.farm');
  const rootZone = report.assessment.rootZone;

  return rootZone ? t('waterValue', { percent: soilWater(rootZone).percent }) : t('none');
}

function Confidence({ report }: { report: WaterReport }) {
  const t = useTranslations('report.verdict');

  return t(`confidenceLevels.${report.assessment.confidence}`);
}

function RowFacts({ report }: { report: WaterReport }) {
  const t = useTranslations('report.farm');

  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      <div className="flex flex-col">
        <dt className="text-muted-foreground">{t('headers.water')}</dt>
        <dd className="font-medium tabular-nums">
          <WaterValue report={report} />
        </dd>
      </div>
      <div className="flex flex-col">
        <dt className="text-muted-foreground">{t('headers.stress')}</dt>
        <dd className="font-medium tabular-nums">
          {report.assessment.rootZone
            ? t('stressValue', { days: report.assessment.rootZone.stressDays30 })
            : t('none')}
        </dd>
      </div>
      <div className="flex flex-col">
        <dt className="text-muted-foreground">{t('headers.confidence')}</dt>
        <dd className="font-medium">
          <Confidence report={report} />
        </dd>
      </div>
    </dl>
  );
}

function RowAction({ row, href }: { row: Row; href: AppHref }) {
  const t = useTranslations('report.farm');

  if (row.state === 'failed') {
    return (
      <Button variant="outline" size="xl" onClick={row.retry}>
        <RotateCcw aria-hidden="true" />
        {t('retry')}
      </Button>
    );
  }

  if (!row.report) return null;

  return (
    <Button asChild variant="outline" size="xl">
      <Link href={href} aria-label={t('openFor', { number: row.number })}>
        {t('open')}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

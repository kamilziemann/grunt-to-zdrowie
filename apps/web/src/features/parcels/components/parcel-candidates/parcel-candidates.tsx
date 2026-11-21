import type { ParcelCandidate, ParcelSearchResult } from '@app/contracts';
import { ChevronRight } from 'lucide-react';
import { useCallback, useId, useMemo, useState, type ChangeEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Input } from '@/components/ui/input';
import { normalizeText } from '@/lib/utils/normalize-text';

export interface ParcelCandidatesProps {
  result: ParcelSearchResult;
  onChoose: (candidate: ParcelCandidate) => void;
}

/** Od ilu kandydatow pokazujemy filtr - krotka liste szybciej przejrzec, niz zawezac. */
const FILTER_FROM = 8;

function CandidateItem({
  item,
  onChoose,
}: {
  item: ParcelCandidate;
  onChoose: (item: ParcelCandidate) => void;
}) {
  const t = useTranslations('parcels.candidates');
  const choose = useCallback(() => onChoose(item), [onChoose, item]);

  return (
    <li>
      <button
        type="button"
        onClick={choose}
        className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:bg-secondary [@media(hover:hover)]:hover:bg-secondary/60"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{t('item', { number: item.number, region: item.region })}</span>
          <span className="text-sm text-muted-foreground">
            {t('place', { commune: item.commune, county: item.county, voivodeship: item.voivodeship })}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Lista dzialek pasujacych do "obreb numer". Nazwy obrebow powtarzaja sie w calej Polsce ("Dabrowa 12" to
 * kilkadziesiat dzialek), wiec nic nie wybieramy za rolnika: pokazujemy gmine, powiat i wojewodztwo oraz filtr.
 */
export function ParcelCandidates({ result, onChoose }: ParcelCandidatesProps) {
  const t = useTranslations('parcels.candidates');
  const filterId = useId();
  const titleId = useId();
  const [filter, setFilter] = useState('');
  const changeFilter = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setFilter(event.target.value),
    [],
  );
  const visible = useMemo(() => {
    const needle = normalizeText(filter);

    if (needle === '') return result.items;

    return result.items.filter((item) =>
      normalizeText(`${item.commune} ${item.county} ${item.voivodeship} ${item.region}`).includes(needle),
    );
  }, [filter, result.items]);

  if (result.items.length === 0) {
    return <output className="block rounded-lg bg-muted px-3 py-3 text-sm">{t('none')}</output>;
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3" data-testid="parcel-candidates">
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-base font-semibold">
          {t('title')}
        </h2>
        <output className="block text-sm text-muted-foreground">
          {t('count', { total: result.total })}
          {result.total > result.items.length
            ? ` ${t('truncated', { shown: result.items.length, total: result.total })}`
            : ''}
        </output>
      </div>
      {result.items.length >= FILTER_FROM && (
        <div className="flex flex-col gap-1">
          <label htmlFor={filterId} className="text-sm font-medium">
            {t('filterLabel')}
          </label>
          <Input
            id={filterId}
            type="search"
            enterKeyHint="done"
            autoComplete="off"
            value={filter}
            placeholder={t('filterPlaceholder')}
            onChange={changeFilter}
            className="h-11 text-base"
          />
        </div>
      )}
      {visible.length === 0 ? (
        <output className="block text-sm text-muted-foreground">{t('noneFiltered')}</output>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {visible.map((item) => (
            <CandidateItem key={item.id} item={item} onChoose={onChoose} />
          ))}
        </ul>
      )}
    </section>
  );
}

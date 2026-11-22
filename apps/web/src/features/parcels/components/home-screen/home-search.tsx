import { PARCEL_ID_PATTERN, type ParcelCandidate, type Place } from '@app/contracts';
import { useQuery } from '@tanstack/react-query';
import { Map as MapIcon, SearchX, ServerCrash, type LucideIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SubmitEvent,
} from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/lib/navigation';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

import { parcelSearchQuery, placeSearchQuery } from '../../api/parcels.queries';
import { formatMapView } from '../../schemas/map-search.schema';
import { validateParcelSearch, type ParcelSearchError } from '../../schemas/parcel-search.schema';
import { ParcelCandidates } from '../parcel-candidates';
import { PlaceResults } from '../place-results';

/** Komunikat pod polem: co sie stalo i dokad dalej (do poprawy numeru albo na mape) - nigdy pusta strona. */
function SearchState({
  icon: Icon,
  title,
  text,
  children,
  tone = 'neutral',
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  children: ReactNode;
  tone?: 'neutral' | 'warning';
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border p-5 text-left',
        tone === 'warning' ? 'border-warning/40 bg-warning/10' : 'bg-muted',
      )}
      data-testid="home-search-state"
    >
      <h2 id={titleId} className="flex items-start gap-3 text-xl font-medium">
        <Icon
          aria-hidden="true"
          className={cn('mt-0.5 size-6 shrink-0', tone === 'warning' && 'text-warning')}
        />
        {title}
      </h2>
      <p>{text}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

/**
 * Pole "numer dzialki" na pierwszym ekranie. Pelny numer prowadzi prosto do kroku "Czy to Twoja dzialka?", "obreb
 * numer" pyta API o kandydatow (jedno trafienie = od razu dalej, kilka = lista do wyboru), a adres pokazuje miejsca,
 * ktore otwieraja mape w tej okolicy. Tekst 19 px, pole i przycisk 60 px.
 */
export function HomeSearch() {
  const t = useTranslations('parcels.home');
  const tSearch = useTranslations('parcels.search');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const inputId = useId();
  const messageId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<ParcelSearchError | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const search = useQuery({ ...parcelSearchQuery(submitted ?? ''), enabled: submitted !== null });
  const places = useQuery({ ...placeSearchQuery(submitted ?? ''), enabled: submitted !== null });
  const items = search.data?.items;
  const onlyMatch = items?.length === 1 ? items[0] : undefined;
  const hasPlaces = (places.data?.items.length ?? 0) > 0;

  // jedno trafienie jest jednoznaczne - od razu krok "Czy to Twoja dzialka?"
  useEffect(() => {
    if (onlyMatch) router.push(routes.analysis(onlyMatch.id));
  }, [onlyMatch, router]);

  const change = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    setError(null);
  }, []);

  const { refetch: refetchSearch } = search;
  const { refetch: refetchPlaces } = places;

  const submit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const input = validateParcelSearch(text);

      if (!input.ok) {
        setError(input.error);

        return;
      }

      setError(null);

      // pelny numer wskazuje jedna dzialke - bez listy kandydatow (jedno zapytanie mniej)
      if (PARCEL_ID_PATTERN.test(input.query)) {
        router.push(routes.analysis(input.query));

        return;
      }

      if (submitted === input.query) {
        void refetchSearch();
        void refetchPlaces();
      }

      setSubmitted(input.query);
    },
    [text, router, submitted, refetchSearch, refetchPlaces],
  );

  const retry = useCallback(() => {
    void refetchSearch();
    void refetchPlaces();
  }, [refetchSearch, refetchPlaces]);

  const fixNumber = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const chooseCandidate = useCallback(
    (candidate: ParcelCandidate) => router.push(routes.analysis(candidate.id)),
    [router],
  );

  const choosePlace = useCallback(
    (place: Place) => router.push(routes.map({ widok: formatMapView(place.bbox) })),
    [router],
  );

  const waiting = submitted !== null && !onlyMatch && (search.isFetching || places.isFetching);
  const settled = submitted !== null && !search.isFetching && !places.isFetching;
  const failed = settled && search.isError && !hasPlaces;
  const many = settled && items !== undefined && items.length > 1;
  const onlyPlaces = settled && items?.length === 0 && hasPlaces;
  const none = settled && items?.length === 0 && !hasPlaces;

  return (
    <div className="flex w-full flex-col gap-4">
      <search>
        <form id="szukaj" onSubmit={submit} noValidate className="flex flex-col gap-2 text-left">
          <label htmlFor={inputId} className="pl-2 text-lg font-medium md:pl-6">
            {t('search.label')}
          </label>
          <div className="flex flex-wrap gap-2.5">
            <input
              ref={inputRef}
              id={inputId}
              name="q"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={text}
              placeholder={t('search.placeholder')}
              aria-invalid={error ? true : undefined}
              aria-describedby={messageId}
              onChange={change}
              className="h-15 min-w-0 flex-[1_1_20rem] rounded-full border-2 border-foreground bg-card px-6 text-lg outline-none placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive"
            />
            <Button
              type="submit"
              size="xl"
              loading={waiting || onlyMatch !== undefined}
              className="h-15 flex-[1_0_auto] px-8"
            >
              {t('search.submit')}
            </Button>
          </div>
          <p
            id={messageId}
            role={error ? 'alert' : undefined}
            className={cn('pl-6 text-sm', error ? 'font-medium text-destructive' : 'text-muted-foreground')}
          >
            {error ? tSearch(error) : t('search.hint')}
          </p>
        </form>
      </search>

      {(waiting || onlyMatch) && (
        <output className="block rounded-2xl bg-muted px-5 py-4 text-left">
          {onlyMatch || !search.isFetching ? t('search.searching') : tSearch('slow')}
        </output>
      )}

      {failed && (
        <SearchState
          icon={ServerCrash}
          tone="warning"
          title={t('states.serviceTitle')}
          text={t('states.serviceText')}
        >
          <Button onClick={retry}>{tCommon('tryAgain')}</Button>
          <Button asChild variant="outline">
            <Link href={routes.map()}>
              <MapIcon aria-hidden="true" />
              {t('states.showMap')}
            </Link>
          </Button>
        </SearchState>
      )}

      {none && (
        <SearchState icon={SearchX} title={t('states.notFoundTitle')} text={t('states.notFoundText')}>
          <Button onClick={fixNumber}>{t('states.fixNumber')}</Button>
          <Button asChild variant="outline">
            <Link href={routes.map()}>
              <MapIcon aria-hidden="true" />
              {t('states.showMap')}
            </Link>
          </Button>
        </SearchState>
      )}

      {many && search.data && (
        <div className="rounded-2xl border bg-card p-4 text-left">
          <ParcelCandidates result={search.data} onChoose={chooseCandidate} />
        </div>
      )}

      {(onlyPlaces || (many && hasPlaces)) && places.data && (
        <div className="rounded-2xl border bg-card p-4 text-left">
          <PlaceResults places={places.data.items} onChoose={choosePlace} />
        </div>
      )}
    </div>
  );
}

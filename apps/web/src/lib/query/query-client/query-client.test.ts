// getQueryClient: jeden klient w przegladarce, nowy na kazde renderowanie serwerowe (bez wspolnej pamieci podrecznej
// miedzy zadaniami). Ponowienia: bledy klienta z API nie wracaja, reszta dostaje jedna druga probe, mutacje zadnej.
import { PROBLEM_CODES, problemType, type ProblemCode } from '@app/contracts';
import { RpcError } from '@app/rpc';
import { focusManager, MutationObserver, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getQueryClient } from './query-client';

function rpcError(status: number, code: ProblemCode): RpcError {
  return new RpcError({ type: problemType(code), title: code, status, code });
}

/** Zapytanie, ktore zawsze konczy sie bledem; zwraca liczbe prob (bez opoznienia miedzy ponowieniami). */
async function failingQueryAttempts(error: unknown): Promise<number> {
  const queryFn = vi.fn<() => Promise<never>>().mockRejectedValue(error);

  await expect(
    getQueryClient().query({ queryKey: ['fail', Math.random()], queryFn, retryDelay: 0 }),
  ).rejects.toBe(error);

  return queryFn.mock.calls.length;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});

describe('getQueryClient', () => {
  it('w przegladarce oddaje zawsze tego samego klienta', () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });

  it('na serwerze tworzy nowego klienta przy kazdym wywolaniu', () => {
    const browser = getQueryClient();

    vi.stubGlobal('window', undefined);

    const first = getQueryClient();
    const second = getQueryClient();

    expect(first).not.toBe(second);
    expect(first).not.toBe(browser);
  });
});

describe('ponowienia zapytan', () => {
  it.each([400, 401, 403, 404, 409, 413, 415, 422])('blad %i z API nie jest ponawiany', async (status) => {
    await expect(failingQueryAttempts(rpcError(status, PROBLEM_CODES.VALIDATION_FAILED))).resolves.toBe(1);
  });

  it.each([429, 500, 503])('blad %i z API dostaje jedna druga probe', async (status) => {
    await expect(failingQueryAttempts(rpcError(status, PROBLEM_CODES.UPSTREAM_FAILED))).resolves.toBe(2);
  });

  it('blad sieci dostaje jedna druga probe', async () => {
    await expect(failingQueryAttempts(new TypeError('fetch failed'))).resolves.toBe(2);
  });

  it('mutacja nie jest ponawiana', async () => {
    const error = rpcError(503, PROBLEM_CODES.UPSTREAM_FAILED);
    const mutationFn = vi.fn<() => Promise<never>>().mockRejectedValue(error);
    const observer = new MutationObserver(getQueryClient(), { mutationFn, retryDelay: 0 });

    await expect(observer.mutate()).rejects.toBe(error);
    expect(mutationFn).toHaveBeenCalledOnce();
  });
});

describe('swiezosc danych', () => {
  it('przez 30 s oddaje dane z pamieci, potem pyta API ponownie', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));

    const client = getQueryClient();
    const queryFn = vi.fn<() => Promise<string>>().mockResolvedValue('dane');
    const options = { queryKey: ['fresh'], queryFn };

    await client.query(options);
    vi.setSystemTime(new Date('2026-10-22T10:00:29Z'));
    await client.query(options);

    expect(queryFn).toHaveBeenCalledOnce();

    vi.setSystemTime(new Date('2026-10-22T10:00:31Z'));
    await client.query(options);

    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('powrot do karty nie odswieza nieswiezych danych', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T11:00:00Z'));

    // mount() robi to samo co QueryClientProvider: klient zaczyna sluchac zdarzen fokusu karty
    const client = getQueryClient();
    const queryFn = vi.fn<() => Promise<string>>().mockResolvedValue('dane');
    const observer = new QueryObserver(client, { queryKey: ['focus'], queryFn });

    client.mount();

    const unsubscribe = observer.subscribe(() => undefined);

    await vi.waitFor(() => expect(observer.getCurrentResult().status).toBe('success'));
    vi.setSystemTime(new Date('2026-10-22T11:05:00Z'));
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queryFn).toHaveBeenCalledOnce();
    unsubscribe();
    client.unmount();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger, isLogLevel } from './index';

describe('createLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('domyslnie kazdy poziom idzie wlasna metoda console (Workers Logs czyta z niej poziom)', () => {
    const spies = (['debug', 'info', 'warn', 'error'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const log = createLogger({ level: 'debug' });

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(spies.map((spy) => spy.mock.calls.length)).toEqual([1, 1, 1, 1]);
  });

  it('emituje JSON z czasem, poziomem i bindings', () => {
    const lines: string[] = [];
    const log = createLogger({
      level: 'debug',
      bindings: { app: 'test' },
      sink: (l) => lines.push(l),
      now: () => new Date('2026-01-01T00:00:00Z'),
    });

    log.info('hello', { a: 1 });
    expect(JSON.parse(lines[0] ?? '{}')).toEqual({
      time: '2026-01-01T00:00:00.000Z',
      level: 'info',
      msg: 'hello',
      app: 'test',
      a: 1,
    });
  });

  it('filtruje ponizej progu i dziedziczy bindings w child', () => {
    const lines: string[] = [];
    const log = createLogger({ level: 'warn', sink: (l) => lines.push(l) }).child({ requestId: 'r1' });

    log.info('ignored');
    log.error('boom', { err: new Error('x') });
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? '{}') as { requestId: string; err: { message: string } };

    expect(entry.requestId).toBe('r1');
    expect(entry.err.message).toBe('x');
  });

  it('rozpoznaje poziomy', () => {
    expect(isLogLevel('info')).toBe(true);
    expect(isLogLevel('loud')).toBe(false);
  });
});

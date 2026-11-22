// @app/logger - logger bez zaleznosci. Kazdy wpis to jedna linia JSON: {time, level, msg, ...bindings, ...data}.
// Logger jest przekazywany jawnie (DI), nie jako globalny singleton: w Workerze powstaje per request.

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogData = Record<string, unknown>;

export interface Logger {
  readonly level: LogLevel;
  debug(msg: string, data?: LogData): void;
  info(msg: string, data?: LogData): void;
  warn(msg: string, data?: LogData): void;
  error(msg: string, data?: LogData): void;
  /** Nowy logger z dodatkowymi polami (np. requestId, jobId) - nie mutuje rodzica. */
  child(bindings: LogData): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  bindings?: LogData;
  /** Dokad trafia gotowa linia. Domyslnie console z metoda wg poziomu (Workers Logs czyta z niej poziom). */
  sink?: (line: string, level: LogLevel) => void;
  /** Zrodlo czasu - do testow deterministycznych. */
  now?: () => Date;
}

const WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}

function describe(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);

  return value;
}

export function serializeError(err: unknown): LogData {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err.cause === undefined ? {} : { cause: describe(err.cause) }),
    };
  }

  return { value: describe(err) };
}

function normalize(data: LogData | undefined): LogData {
  if (!data) return {};
  const out: LogData = {};

  for (const [k, v] of Object.entries(data)) {
    out[k] = v instanceof Error ? serializeError(v) : v;
  }

  return out;
}

// Workers Logs bierze poziom z metody console, wiec kazdy poziom ma swoja metode (info nie moze isc jako warn).
const defaultSink = (line: string, level: LogLevel): void => {
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'info') console.info(line);
  else console.debug(line);
};

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const bindings = options.bindings ?? {};
  const sink = options.sink ?? defaultSink;
  const now = options.now ?? (() => new Date());
  const threshold = WEIGHT[level];

  const emit = (lvl: LogLevel, msg: string, data?: LogData): void => {
    if (WEIGHT[lvl] < threshold) return;
    const entry = { time: now().toISOString(), level: lvl, msg, ...bindings, ...normalize(data) };

    sink(JSON.stringify(entry), lvl);
  };

  return {
    level,
    debug: (msg, data) => emit('debug', msg, data),
    info: (msg, data) => emit('info', msg, data),
    warn: (msg, data) => emit('warn', msg, data),
    error: (msg, data) => emit('error', msg, data),
    child: (extra) => createLogger({ level, bindings: { ...bindings, ...extra }, sink, now }),
  };
}

export * from './trace';

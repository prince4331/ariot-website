import pg from 'pg';
import type { PoolConfig } from 'pg';

/**
 * server/db-timezone.ts — the single UTC session policy for every ARIOT
 * PostgreSQL connection (decision D-070).
 *
 * ARIOT stores `DateTime` in `TIMESTAMP(3) WITHOUT TIME ZONE` columns, and the
 * two drivers that read those columns disagree about what a naive timestamp
 * means:
 *
 *   - `@prisma/adapter-pg` interprets every timestamp value as UTC wall clock.
 *     It ignores the session offset entirely, so a `timestamptz` read under an
 *     `Asia/Dhaka` (+06) session is skewed by six hours (issue I-029), and a
 *     naive column is only correct if the database *stored* UTC wall clock.
 *   - `pg` interprets a naive timestamp as **process-local** time, so the same
 *     stored value decodes differently depending on the host `TZ`.
 *
 * Two central invariants make both drivers agree on one instant:
 *
 *   1. Every session runs with `timezone = UTC`, delivered as a libpq startup
 *      option so the server applies it before the session accepts its first
 *      query. This makes server-side writers (`NOW()`, `CURRENT_TIMESTAMP`,
 *      column defaults) store UTC wall clock, and makes `timestamptz` reads
 *      through PrismaPg correct.
 *   2. Raw `pg` consumers decode naive timestamps as UTC rather than as host
 *      local time, matching PrismaPg and removing the host-`TZ` dependency.
 *   3. Raw `pg` consumers encode `Date` parameters as UTC rather than as host
 *      local time, so an explicit write and the read that follows it describe
 *      the same instant on any host.
 *
 * All three are configured here and nowhere else. `process.env.TZ` is NOT the
 * control, and per-query `SET TIME ZONE` patches are prohibited — see
 * docs/07_DECISIONS.md (D-070).
 */

/** The one session time zone every ARIOT PostgreSQL connection runs in. */
export const DATABASE_SESSION_TIME_ZONE = 'UTC';

/**
 * libpq startup option pinning the session time zone. Sent in the startup
 * packet, so there is no window in which a query could run under the server's
 * default zone. Repeated `-c` switches are applied left to right, so appending
 * this last makes it authoritative over anything already in the URL.
 */
export const POSTGRES_UTC_SESSION_OPTION = `-c timezone=${DATABASE_SESSION_TIME_ZONE}`;

/** OID of `timestamp without time zone` (pg builtin `TIMESTAMP`). */
const TIMESTAMP_WITHOUT_TIME_ZONE_OID = pg.types.builtins.TIMESTAMP;

/** `YYYY-MM-DD HH:MM:SS[.ffffff]` — PostgreSQL's ISO text output for `timestamp`. */
const NAIVE_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;

type TypeFormat = NonNullable<Parameters<typeof pg.types.getTypeParser>[1]>;
type TypeParser = (value: string) => unknown;

const defaultGetTypeParser = pg.types.getTypeParser;

/**
 * Decodes a PostgreSQL naive `timestamp` literal as a UTC instant.
 *
 * Returns `null` when the value is not a plain ISO timestamp (`infinity`, a BC
 * date, a five-digit year); callers fall back to the driver's own parser rather
 * than guessing. Sub-millisecond digits are truncated, matching the
 * millisecond precision of `TIMESTAMP(3)`.
 */
export function parseNaiveTimestampAsUtc(value: string): Date | null {
  const match = NAIVE_TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;

  const fraction = match[7] ?? '';
  const milliseconds = fraction === '' ? 0 : Number(fraction.padEnd(3, '0').slice(0, 3));

  const epochMs = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
    milliseconds,
  );

  return Number.isNaN(epochMs) ? null : new Date(epochMs);
}

/**
 * Type-parser resolver that decodes naive `timestamp` values as UTC and
 * delegates every other OID to the driver default.
 *
 * `@prisma/adapter-pg` supplies its own resolver per query, so this only
 * governs raw `pg` reads on the same pool — which is exactly the disagreement
 * it exists to remove.
 */
export function getUtcTypeParser(oid: number, format?: TypeFormat): TypeParser {
  const fallback: TypeParser = defaultGetTypeParser(oid, format);

  if (oid !== TIMESTAMP_WITHOUT_TIME_ZONE_OID) return fallback;
  if (format !== undefined && format !== 'text') return fallback;

  return (value: string) => parseNaiveTimestampAsUtc(value) ?? fallback(value);
}

/**
 * Decodes one connection-string query-parameter value the way
 * `pg-connection-string` does (`+` for space, then percent-decoding), so a
 * pre-existing `options` value is preserved verbatim when it is merged.
 */
function decodeConnectionParam(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

interface UtcConnection {
  /** Connection string with any `options` parameter removed. */
  connectionString: string;
  /** Merged libpq options, always ending with the UTC time-zone switch. */
  options: string;
}

/**
 * Splits the UTC session option out of a connection string.
 *
 * `pg` lets a connection string's `options` parameter override the explicit
 * `options` config key, so an `options` already present in the URL is lifted
 * out and re-supplied through the config with the UTC switch appended. When the
 * URL carries no `options` (the normal case) the string is returned byte-for-
 * byte unchanged — credentials are never re-encoded.
 */
export function withUtcSessionOption(connectionString: string): UtcConnection {
  const queryStart = connectionString.indexOf('?');
  if (queryStart === -1) {
    return { connectionString, options: POSTGRES_UTC_SESSION_OPTION };
  }

  const base = connectionString.slice(0, queryStart);
  const pairs = connectionString.slice(queryStart + 1).split('&');
  const kept: string[] = [];
  const inherited: string[] = [];

  for (const pair of pairs) {
    const separator = pair.indexOf('=');
    const rawName = separator === -1 ? pair : pair.slice(0, separator);
    if (decodeConnectionParam(rawName).toLowerCase() !== 'options') {
      kept.push(pair);
      continue;
    }
    if (separator !== -1) {
      inherited.push(decodeConnectionParam(pair.slice(separator + 1)).trim());
    }
  }

  if (inherited.length === 0) {
    return { connectionString, options: POSTGRES_UTC_SESSION_OPTION };
  }

  return {
    connectionString: kept.length > 0 ? `${base}?${kept.join('&')}` : base,
    options: [...inherited, POSTGRES_UTC_SESSION_OPTION].filter(Boolean).join(' '),
  };
}

/**
 * Makes raw `pg` serialize `Date` parameters as UTC (`...+00:00`) instead of as
 * host-local time.
 *
 * This is the write-side twin of `getUtcTypeParser`. Without it, `pg` sends a
 * `Date` as local wall clock with an offset; casting that into a
 * `TIMESTAMP WITHOUT TIME ZONE` column discards the offset and stores local
 * wall clock, so the value read back is skewed by the host offset. With it, the
 * stored wall clock is UTC — the same convention PrismaPg uses.
 *
 * `parseInputDatesAsUTC` is a process-wide `pg` default rather than a per-pool
 * option, which is why it is set exactly once, here, at the module that owns the
 * policy. That process-wide scope is the intent: every ARIOT PostgreSQL session
 * in a process must agree on UTC. It is not a per-query patch and it is not
 * `process.env.TZ`.
 */
export function enforceUtcDateParameterEncoding(): void {
  pg.defaults.parseInputDatesAsUTC = true;
}

// Applied at module load so it covers any `pg` consumer in the process, not
// only pools built through `utcPoolConfig`.
enforceUtcDateParameterEncoding();

/** Pool settings that `utcPoolConfig` owns and callers must not supply. */
type ManagedPoolKeys = 'connectionString' | 'options' | 'types';

/**
 * The canonical `pg` pool configuration for ARIOT: a UTC session plus
 * UTC-consistent naive-timestamp decoding.
 *
 * Every runtime pool — the Prisma adapter in `server/db.ts` and the operational
 * CLIs under `scripts/` — is built from this one function, so the invariant
 * cannot drift between callers.
 */
export function utcPoolConfig(
  connectionString: string,
  extra?: Omit<PoolConfig, ManagedPoolKeys>,
): PoolConfig {
  const utc = withUtcSessionOption(connectionString);
  enforceUtcDateParameterEncoding();

  return {
    ...extra,
    connectionString: utc.connectionString,
    options: utc.options,
    types: { getTypeParser: getUtcTypeParser },
  };
}

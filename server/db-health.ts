import { prisma } from '@/server/db';
import { DATABASE_SESSION_TIME_ZONE } from '@/server/db-timezone';

/**
 * server/db-health.ts — database invariant checks for health probes and tests.
 *
 * The UTC session invariant (D-070) is enforced centrally in
 * `server/db-timezone.ts`, but enforcement is only half the story: a database
 * whose own default was never set to UTC will silently hand non-UTC sessions to
 * the Prisma CLI, the seed, and any connection opened outside the application.
 * This module verifies the invariant on a live session so a drift shows up as a
 * failed check rather than as timestamps that are quietly six hours wrong.
 *
 * Nothing here reads, logs, or returns `DATABASE_URL`, credentials, or host
 * details — a violation reports only the observed and expected time zone.
 */

/** Reads `SHOW TimeZone` from one live session. */
export type TimeZoneReader = () => Promise<string | null>;

export interface DatabaseTimezoneCheck {
  /** True when the session time zone matches the required invariant. */
  ok: boolean;
  /** The observed session time zone, or `null` when it could not be read. */
  observed: string | null;
  /** The required session time zone. */
  expected: string;
  /** Safe, non-secret summary suitable for a health-check response body. */
  detail: string;
}

/**
 * Default reader — asks the shared Prisma singleton, so the check observes the
 * same pool the application actually queries through.
 */
const readSessionTimeZone: TimeZoneReader = async () => {
  const rows = await prisma.$queryRaw<Array<{ TimeZone?: string | null }>>`SHOW TimeZone`;
  return rows[0]?.TimeZone ?? null;
};

/**
 * Non-throwing probe: reports whether the current database session runs in the
 * required time zone. Safe to expose through an authenticated admin health
 * endpoint — the result contains no connection details.
 */
export async function checkDatabaseTimezone(
  read: TimeZoneReader = readSessionTimeZone,
): Promise<DatabaseTimezoneCheck> {
  const expected = DATABASE_SESSION_TIME_ZONE;

  let observed: string | null;
  try {
    observed = await read();
  } catch {
    return {
      ok: false,
      observed: null,
      expected,
      detail: 'Database session time zone could not be read.',
    };
  }

  if (observed === null) {
    return {
      ok: false,
      observed: null,
      expected,
      detail: 'Database session time zone could not be read.',
    };
  }

  const ok = observed.toUpperCase() === expected.toUpperCase();

  return {
    ok,
    observed,
    expected,
    detail: ok
      ? `Database session time zone is ${expected}.`
      : `Database session time zone is ${observed}; ${expected} is required.`,
  };
}

/**
 * Throwing assertion for startup and test use. The error names the observed and
 * expected zone and points at the fix; it never includes a connection string.
 */
export async function assertDatabaseTimezoneUtc(read?: TimeZoneReader): Promise<void> {
  const result = await checkDatabaseTimezone(read);
  if (result.ok) return;

  throw new Error(
    `${result.detail} Every ARIOT PostgreSQL session must run in ` +
      `${result.expected} (D-070). Connections built through ` +
      '`utcPoolConfig` pin it via a libpq startup option; a database whose ' +
      'own default is not UTC must be corrected with ' +
      '`pnpm db:timezone -- --apply`.',
  );
}

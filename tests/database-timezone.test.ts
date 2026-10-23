/**
 * tests/database-timezone.test.ts — Step 2.4.6-0 (D-070).
 *
 * Executable proof that one instant survives every path ARIOT writes and reads
 * timestamps through: Prisma (`@prisma/adapter-pg`), raw `pg`, and PostgreSQL's
 * own column defaults. These are real round trips against a real PostgreSQL
 * database, not tests of a formatting helper.
 *
 * The disposable database is deliberately left with the server's own
 * `Asia/Dhaka` default — its database-level timezone is NOT set to UTC. Every
 * assertion here therefore proves that the application-level policy in
 * `server/db-timezone.ts` is sufficient on its own; the `ALTER DATABASE` applied
 * to the development database (scripts/set-database-timezone-utc.ts) only covers
 * connections that bypass it, such as the Prisma CLI and seeds.
 *
 * Run:
 *   node --import ./tests/helpers/register-hooks.mjs
 *        --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
 *        --test tests/database-timezone.test.ts
 *
 * The primary development database is NEVER touched: DATABASE_URL is repointed
 * to a disposable `ariot_timezone_test` database before `server/db.ts` loads.
 */

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

import { utcPoolConfig, DATABASE_SESSION_TIME_ZONE } from '@/server/db-timezone';

const { Pool, Client } = pg;

// ── Environment ──────────────────────────────────────────────────────────────

function loadEnvVar(key: string): string {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) throw new Error('.env not found');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\s*=\s*(.*)`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(`${key} not found in .env`);
}

const baseUrl = loadEnvVar('DATABASE_URL');
const TEST_DB_NAME = 'ariot_timezone_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);
const adminUrl = baseUrl.replace(/\/ariot(\?|$)/, '/postgres$1');

assert.ok(testUrl.includes('localhost') || testUrl.includes('127.0.0.1'), 'Test URL must be local');
assert.ok(testUrl.includes(TEST_DB_NAME), 'Test URL must point at the disposable database');

/** The one instant used for every explicit write. Chosen so that a host-offset
 *  or session-offset error lands on a visibly different wall clock. */
const INSTANT = new Date('2026-01-15T10:20:30.123Z');
const INSTANT_UTC_TEXT = '2026-01-15 10:20:30.123';

interface ProbeRow {
  explicitAt: Date | null;
  defaultAt: Date;
  groundTruth: Date;
  updatedAt: Date;
}

let pool: InstanceType<typeof Pool>;
let prisma: typeof import('@/server/db').prisma;

// ── Disposable database lifecycle ────────────────────────────────────────────

async function withAdmin(sql: string): Promise<void> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(sql);
  } finally {
    await admin.end();
  }
}

async function seedSchema(): Promise<void> {
  // `TIMESTAMP(3)` mirrors what every Prisma `DateTime` column in
  // prisma/schema.prisma actually is; `groundTruth` is a `TIMESTAMPTZ` written in
  // the same statement, giving an independent, offset-carrying record of the
  // instant to compare the naive columns against. It shares the naive columns'
  // millisecond precision so the two round identically and can be compared
  // exactly rather than within a tolerance.
  await pool.query(`
    CREATE TABLE "TimestampProbe" (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      "explicitAt" TIMESTAMP(3),
      "defaultAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "groundTruth" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

before(async () => {
  await withAdmin(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await withAdmin(`CREATE DATABASE "${TEST_DB_NAME}"`);
  // Force a non-UTC server default for the disposable database. The test's
  // premise is "the database itself is not UTC, so the app's UTC session
  // policy is what is under test" — a host whose PostgreSQL defaults to UTC
  // (e.g. a container) would otherwise make that premise untrue and the
  // assertion below meaningless. This is test-fixture setup only; it never
  // touches the primary database.
  await withAdmin(`ALTER DATABASE "${TEST_DB_NAME}" SET timezone TO 'Asia/Dhaka'`);
  pool = new Pool(utcPoolConfig(testUrl));
  await seedSchema();

  // Bind the Prisma singleton to the disposable database before server/db.ts is
  // evaluated; it reads DATABASE_URL at module load.
  process.env.DATABASE_URL = testUrl;
  ({ prisma } = await import('@/server/db'));
});

after(async () => {
  await prisma.$disconnect();
  await pool.end();
  await withAdmin(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
});

// ── Session invariant ────────────────────────────────────────────────────────

describe('UTC session invariant', () => {
  it('the disposable database itself is NOT UTC, so the app policy is what is under test', async () => {
    const bare = new Pool({ connectionString: testUrl });
    try {
      const { rows } = await bare.query<{ TimeZone: string }>('SHOW TimeZone');
      assert.notStrictEqual(
        rows[0].TimeZone.toUpperCase(),
        DATABASE_SESSION_TIME_ZONE,
        'a UTC database default would make the rest of this file prove nothing',
      );
    } finally {
      await bare.end();
    }
  });

  it('a new raw pg connection reports UTC', async () => {
    const fresh = new Pool(utcPoolConfig(testUrl));
    try {
      const { rows } = await fresh.query<{ TimeZone: string }>('SHOW TimeZone');
      assert.strictEqual(rows[0].TimeZone, DATABASE_SESSION_TIME_ZONE);
    } finally {
      await fresh.end();
    }
  });

  it('the Prisma connection reports UTC', async () => {
    const rows = await prisma.$queryRaw<Array<{ TimeZone: string }>>`SHOW TimeZone`;
    assert.strictEqual(rows[0].TimeZone, DATABASE_SESSION_TIME_ZONE);
  });

  it('the invariant helper agrees', async () => {
    const { checkDatabaseTimezone } = await import('@/server/db-health');
    const result = await checkDatabaseTimezone();
    assert.strictEqual(result.ok, true, result.detail);
    assert.strictEqual(result.observed, DATABASE_SESSION_TIME_ZONE);
    assert.ok(!result.detail.includes('://'), 'the detail must never carry a connection string');
  });
});

// ── The seven round trips ────────────────────────────────────────────────────

async function readViaPrisma(id: string): Promise<ProbeRow> {
  const rows = await prisma.$queryRaw<ProbeRow[]>`
    SELECT "explicitAt", "defaultAt", "groundTruth", "updatedAt"
      FROM "TimestampProbe" WHERE id = ${id}`;
  assert.strictEqual(rows.length, 1);
  return rows[0];
}

async function readViaPg(id: string): Promise<ProbeRow> {
  const { rows } = await pool.query<ProbeRow>(
    'SELECT "explicitAt", "defaultAt", "groundTruth", "updatedAt" FROM "TimestampProbe" WHERE id = $1',
    [id],
  );
  assert.strictEqual(rows.length, 1);
  return rows[0];
}

/** The wall clock PostgreSQL actually stored, read as text so neither driver's
 *  decoding can hide a skew. */
async function storedText(id: string, column: string): Promise<string> {
  const { rows } = await pool.query<{ text: string }>(
    `SELECT "${column}"::text AS text FROM "TimestampProbe" WHERE id = $1`,
    [id],
  );
  return rows[0].text;
}

describe('Timestamp round trips', () => {
  it('1. JS Date -> Prisma -> DB -> Prisma -> ISO is the same instant', async () => {
    const id = 'rt-1';
    await prisma.$executeRaw`
      INSERT INTO "TimestampProbe" (id, label, "explicitAt")
      VALUES (${id}, 'prisma-explicit', ${INSTANT}::timestamp(3))`;

    const row = await readViaPrisma(id);
    assert.ok(row.explicitAt);
    assert.strictEqual(row.explicitAt.toISOString(), INSTANT.toISOString());
    assert.strictEqual(await storedText(id, 'explicitAt'), INSTANT_UTC_TEXT);
  });

  it('2. JS Date -> raw pg -> DB -> raw pg is the same instant', async () => {
    const id = 'rt-2';
    await pool.query(
      'INSERT INTO "TimestampProbe" (id, label, "explicitAt") VALUES ($1, $2, $3::timestamp(3))',
      [id, 'pg-explicit', INSTANT],
    );

    const row = await readViaPg(id);
    assert.ok(row.explicitAt);
    assert.strictEqual(row.explicitAt.toISOString(), INSTANT.toISOString());
    // Without the UTC parameter encoding this stores the host wall clock (+06),
    // and without the UTC decoder it reads back six hours early.
    assert.strictEqual(await storedText(id, 'explicitAt'), INSTANT_UTC_TEXT);
  });

  it('3. DB DEFAULT CURRENT_TIMESTAMP read through Prisma is the true instant', async () => {
    const id = 'rt-3';
    await pool.query(`INSERT INTO "TimestampProbe" (id, label) VALUES ($1, 'db-default')`, [id]);

    const row = await readViaPrisma(id);
    // CURRENT_TIMESTAMP and NOW() in one statement are the same transaction
    // instant, so the naive column and the timestamptz ground truth must match
    // exactly — not approximately.
    assert.strictEqual(row.defaultAt.toISOString(), row.groundTruth.toISOString());
  });

  it('4. DB DEFAULT CURRENT_TIMESTAMP read through raw pg is the true instant', async () => {
    const id = 'rt-4';
    await pool.query(`INSERT INTO "TimestampProbe" (id, label) VALUES ($1, 'db-default')`, [id]);

    const row = await readViaPg(id);
    assert.strictEqual(row.defaultAt.toISOString(), row.groundTruth.toISOString());
  });

  it('5. the same row read through Prisma and through raw pg agrees', async () => {
    const id = 'rt-5';
    await pool.query(
      `INSERT INTO "TimestampProbe" (id, label, "explicitAt") VALUES ($1, 'both', $2::timestamp(3))`,
      [id, INSTANT],
    );

    const viaPrisma = await readViaPrisma(id);
    const viaPg = await readViaPg(id);
    assert.strictEqual(viaPrisma.explicitAt?.toISOString(), viaPg.explicitAt?.toISOString());
    assert.strictEqual(viaPrisma.defaultAt.toISOString(), viaPg.defaultAt.toISOString());
    assert.strictEqual(viaPrisma.groundTruth.toISOString(), viaPg.groundTruth.toISOString());
    assert.strictEqual(viaPrisma.updatedAt.toISOString(), viaPg.updatedAt.toISOString());
  });
});

describe('Concurrency token and API serialization', () => {
  it('6. an updatedAt token read through Prisma still matches the stored row', async () => {
    const id = 'rt-6';
    await pool.query(`INSERT INTO "TimestampProbe" (id, label) VALUES ($1, 'token')`, [id]);

    // This is exactly how the product/variant executors use Product.updatedAt:
    // Prisma reads it, the client returns it as an ISO string, and the guarded
    // UPDATE compares the stored value against it. A six-hour skew between the
    // two drivers is precisely what made this token unusable (I-029).
    const token = (await readViaPrisma(id)).updatedAt.toISOString();

    const guarded = await pool.query(
      `UPDATE "TimestampProbe" SET label = 'token-advanced'
        WHERE id = $1 AND "updatedAt" = $2::timestamp(3)`,
      [id, new Date(token)],
    );
    assert.strictEqual(guarded.rowCount, 1, 'the token read via Prisma must match the stored row');

    const stale = await pool.query(
      `UPDATE "TimestampProbe" SET label = 'should-not-happen'
        WHERE id = $1 AND "updatedAt" = $2::timestamp(3)`,
      [id, new Date(new Date(token).getTime() - 1000)],
    );
    assert.strictEqual(stale.rowCount, 0, 'a stale token must not match');

    // And the reverse direction: a token produced by raw pg is accepted by a
    // Prisma-issued guarded update.
    const pgToken = (await readViaPg(id)).updatedAt;
    const viaPrisma = await prisma.$executeRaw`
      UPDATE "TimestampProbe" SET label = 'token-prisma'
        WHERE id = ${id} AND "updatedAt" = ${pgToken}::timestamp(3)`;
    assert.strictEqual(viaPrisma, 1, 'a raw pg token must match through Prisma too');
  });

  it('7. an audit-style DB-default timestamp serializes as ISO-8601 Z on the same instant', async () => {
    const id = 'rt-7';
    // AuditLog.createdAt is written by the database default, then serialized to
    // JSON by an admin API route. That is the path this asserts.
    await pool.query(`INSERT INTO "TimestampProbe" (id, label) VALUES ($1, 'audit')`, [id]);

    const row = await readViaPrisma(id);
    const serialized = JSON.parse(JSON.stringify({ createdAt: row.defaultAt })) as {
      createdAt: string;
    };

    assert.match(serialized.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.strictEqual(new Date(serialized.createdAt).getTime(), row.groundTruth.getTime());
    // The instant must be plausibly "now" — a six-hour skew would fail this.
    assert.ok(
      Math.abs(Date.now() - new Date(serialized.createdAt).getTime()) < 5 * 60_000,
      `serialized instant ${serialized.createdAt} is not close to now`,
    );
  });
});

// ── Host time zone independence (the host stays as the operator set it) ──────

interface HostProbeResult {
  hostOffsetMinutes: number;
  hostTz: string | null;
  sessionTimeZone: string;
  explicitAt: string;
  defaultAt: string;
  groundTruth: string;
}

function probeWithHostTz(id: string, tz: string): HostProbeResult {
  const stdout = execFileSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      'tests/helpers/timezone-host-probe.ts',
      id,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, TZ: tz, DATABASE_URL: testUrl },
    },
  );
  return JSON.parse(stdout.trim()) as HostProbeResult;
}

describe('Host time zone independence', () => {
  const id = 'host-probe';

  before(async () => {
    await pool.query(
      `INSERT INTO "TimestampProbe" (id, label, "explicitAt") VALUES ($1, 'host', $2::timestamp(3))`,
      [id, INSTANT],
    );
  });

  it('this host is genuinely not UTC, so the test has something to prove', () => {
    // The operating system time zone is untouched by this work; it stays as the
    // operator set it (Asia/Dhaka, offset -360 minutes from getTimezoneOffset).
    assert.notStrictEqual(
      new Date().getTimezoneOffset(),
      0,
      'run this on a non-UTC host — that is the condition I-029 appeared under',
    );
  });

  it('reads the same instants from a child process in a far-away time zone', () => {
    const west = probeWithHostTz(id, 'America/Los_Angeles');
    const east = probeWithHostTz(id, 'Asia/Dhaka');
    const utc = probeWithHostTz(id, 'UTC');

    assert.notStrictEqual(west.hostOffsetMinutes, east.hostOffsetMinutes);
    assert.strictEqual(utc.hostOffsetMinutes, 0);

    for (const probe of [west, east, utc]) {
      assert.strictEqual(probe.sessionTimeZone, DATABASE_SESSION_TIME_ZONE, probe.hostTz ?? '');
      assert.strictEqual(probe.explicitAt, INSTANT.toISOString(), probe.hostTz ?? '');
      assert.strictEqual(probe.defaultAt, probe.groundTruth, probe.hostTz ?? '');
    }
  });

  it('agrees with what this process reads', async () => {
    const local = await readViaPg(id);
    const west = probeWithHostTz(id, 'America/Los_Angeles');
    assert.strictEqual(local.explicitAt?.toISOString(), west.explicitAt);
    assert.strictEqual(local.defaultAt.toISOString(), west.defaultAt);
  });
});

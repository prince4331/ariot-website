/**
 * scripts/set-database-timezone-utc.ts — Step 2.4.6-0 (decision D-070).
 *
 * Sets a PostgreSQL database's own default `timezone` to UTC, so that every
 * connection which does NOT go through `utcPoolConfig` — the Prisma CLI,
 * `prisma db execute` during seeding, `psql`, operational one-off scripts —
 * still inherits the UTC session invariant. Application connections pin UTC
 * themselves (see `server/db-timezone.ts`); this closes the gap for everything
 * else, including the server-side `NOW()` / `CURRENT_TIMESTAMP` column defaults
 * that the seed relies on.
 *
 * Usage:
 *   pnpm db:timezone                 # dry-run (default, safe — no writes)
 *   pnpm db:timezone -- --apply      # apply to a loopback database
 *
 * Safety:
 *   - Dry-run by default.
 *   - Refuses any non-loopback host, verified BOTH from the URL and from the
 *     server itself (`inet_server_addr()`), so a tunnelled remote is rejected.
 *   - Refuses database names that look like staging or production.
 *   - Refuses to apply when NODE_ENV=production.
 *   - Narrowest reversible scope: `ALTER DATABASE ... SET timezone`. The
 *     PostgreSQL server configuration is never touched. Reverse with
 *     `ALTER DATABASE <db> RESET timezone`.
 *   - Identifier quoting is done server-side with `format('%I', ...)`.
 *   - Never prints credentials or a connection string.
 *   - Idempotent: re-running changes nothing.
 *   - Touches no table data — no row, no timestamp, is rewritten.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { DATABASE_SESSION_TIME_ZONE } from '../server/db-timezone.ts';

const { Client } = pg;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const PROTECTED_NAME_PATTERN = /stag|prod|live/i;

function loadDotEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)/);
    if (!m) continue;
    const key = m[1];
    const raw = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = raw;
  }
}

/** Host from the URL, lowercased, brackets kept as written. */
function urlHost(connectionString: string): string | null {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the server-reported address is a loopback address. */
function isLoopbackAddress(address: string | null): boolean {
  if (address === null) return true; // Unix socket / same-machine: no inet peer.
  const bare = address.replace(/\/\d+$/, '').toLowerCase();
  return bare === '127.0.0.1' || bare === '::1' || bare.startsWith('127.');
}

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

interface Identity {
  database: string;
  serverAddress: string | null;
  serverVersion: string;
  databaseDefault: string | null;
  sessionTimeZone: string;
}

async function readIdentity(client: pg.Client): Promise<Identity> {
  const { rows } = await client.query<{
    database: string;
    address: string | null;
    version: string;
  }>(
    `SELECT current_database() AS database,
            host(inet_server_addr()) AS address,
            current_setting('server_version') AS version`,
  );
  const tz = await client.query<{ TimeZone: string }>('SHOW TimeZone');
  // The database's own stored default (pg_db_role_setting), independent of
  // this session and of any libpq startup option the caller passed.
  const stored = await client.query<{ setting: string }>(
    `SELECT split_part(s, '=', 2) AS setting
       FROM pg_db_role_setting r
       CROSS JOIN unnest(r.setconfig) AS s
      WHERE r.setdatabase = (SELECT oid FROM pg_database
                              WHERE datname = current_database())
        AND r.setrole = 0
        AND lower(split_part(s, '=', 1)) = 'timezone'`,
  );
  return {
    database: rows[0].database,
    serverAddress: rows[0].address,
    serverVersion: rows[0].version,
    databaseDefault: stored.rows[0]?.setting ?? null,
    sessionTimeZone: tz.rows[0].TimeZone,
  };
}

async function main(): Promise<void> {
  loadDotEnv();

  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const expected = DATABASE_SESSION_TIME_ZONE;

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`  ARIOT database timezone → ${expected}  [${apply ? 'APPLY' : 'DRY-RUN'}]`);
  console.log('──────────────────────────────────────────────────────');

  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) fail('DATABASE_URL is not set.');

  const host = urlHost(connectionString);
  if (host === null) fail('DATABASE_URL is not a parseable connection string.');
  console.log(`  URL host        : ${host}`);
  if (!LOOPBACK_HOSTS.has(host)) {
    fail(
      `Host "${host}" is not a loopback address. This script only ever ` +
        'touches a local development database. Refusing.',
    );
  }

  if (apply && process.env['NODE_ENV'] === 'production') {
    fail('NODE_ENV=production. Refusing to alter a database in a production environment.');
  }

  // Deliberately a bare connection: no `utcPoolConfig`, no `options`. We must
  // observe what an ordinary caller (Prisma CLI, psql, seed) actually inherits.
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const identity = await readIdentity(client);

    console.log(`  Server address  : ${identity.serverAddress ?? '(local socket)'}`);
    console.log(`  PostgreSQL      : ${identity.serverVersion}`);
    console.log(`  Database        : ${identity.database}`);
    console.log(`  Database default: ${identity.databaseDefault ?? '(none — inherits server)'}`);
    console.log(`  Session TimeZone: ${identity.sessionTimeZone}`);

    if (!isLoopbackAddress(identity.serverAddress)) {
      fail(
        `The server reports its own address as ${identity.serverAddress}, which is ` +
          'not loopback. The URL host may be a tunnel to a remote database. Refusing.',
      );
    }
    if (PROTECTED_NAME_PATTERN.test(identity.database)) {
      fail(
        `Database "${identity.database}" has a name that looks like staging or ` +
          'production. Refusing. Alter it manually if that is genuinely wrong.',
      );
    }
    console.log('  Identity        : ✓ loopback local development database');

    if (identity.databaseDefault?.toUpperCase() === expected.toUpperCase()) {
      console.log(`\n  ✓ Database default is already ${expected}. Nothing to do.\n`);
      return;
    }

    console.log('\n── Plan ──────────────────────────────────────────────');
    console.log(`  ALTER DATABASE ${identity.database} SET timezone TO '${expected}'`);
    console.log('  Scope    : this database only (server config untouched)');
    console.log(`  Reverse  : ALTER DATABASE ${identity.database} RESET timezone`);
    console.log('  Row data : NOT touched — no timestamp is rewritten');

    if (!apply) {
      console.log('\n── DRY-RUN complete — nothing written. ──');
      console.log('   Add --apply to execute the plan above.\n');
      return;
    }

    // `ALTER DATABASE` accepts no bind parameters and cannot be wrapped in a
    // DO block, so the statement is composed server-side by `format`: `%I`
    // quotes the database name and `%L` the time zone, so neither can break
    // out of the statement. The result is shape-checked before it is run.
    const { rows: composed } = await client.query<{ stmt: string }>(
      `SELECT format('ALTER DATABASE %I SET timezone TO %L',
                     current_database(), $1::text) AS stmt`,
      [expected],
    );
    const statement = composed[0]?.stmt ?? '';
    if (!/^ALTER DATABASE .+ SET timezone TO '[A-Za-z/_+-]+'$/.test(statement)) {
      fail('Composed statement failed its shape check. Nothing was executed.');
    }
    await client.query(statement);
    console.log('\n  ✓ ALTER DATABASE executed.');
  } finally {
    await client.end();
  }

  // Verify on a genuinely NEW bare connection — the altered default applies at
  // connection start, so the session above cannot prove it.
  const verify = new Client({ connectionString });
  await verify.connect();
  try {
    const after = await readIdentity(verify);
    console.log('\n── Verification (new connection) ─────────────────────');
    console.log(`  Database default: ${after.databaseDefault ?? '(none)'}`);
    console.log(`  Session TimeZone: ${after.sessionTimeZone}`);
    if (after.sessionTimeZone.toUpperCase() !== expected.toUpperCase()) {
      fail(`A new connection still reports TimeZone=${after.sessionTimeZone}.`);
    }
    console.log(`\n  ✓ New connections inherit TimeZone=${expected}.\n`);
  } finally {
    await verify.end();
  }
}

main().catch((err: unknown) => {
  // Never log the raw error object — it can carry connection details.
  console.error('\nFailed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

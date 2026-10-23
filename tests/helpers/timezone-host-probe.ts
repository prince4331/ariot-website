/**
 * tests/helpers/timezone-host-probe.ts — Step 2.4.6-0 (D-070).
 *
 * Reads one `TimestampProbe` row through raw `pg` and prints the result as JSON
 * on stdout. tests/database-timezone.test.ts spawns this in a child process with
 * a deliberately different `TZ` so it can prove that stored instants are
 * independent of the host time zone — without touching the operating system's
 * own setting.
 *
 * Usage (invoked by the test, not by hand):
 *   DATABASE_URL=... TZ=America/Los_Angeles \
 *     node --experimental-strip-types tests/helpers/timezone-host-probe.ts <rowId>
 */

import pg from 'pg';
import { utcPoolConfig } from '../../server/db-timezone.ts';

const { Pool } = pg;

interface ProbeRow {
  explicitAt: Date;
  defaultAt: Date;
  groundTruth: Date;
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  const id = process.argv[2];
  if (!url) throw new Error('DATABASE_URL is required');
  if (!id) throw new Error('a probe row id is required');

  const pool = new Pool(utcPoolConfig(url));
  try {
    const { rows } = await pool.query<ProbeRow>(
      'SELECT "explicitAt", "defaultAt", "groundTruth" FROM "TimestampProbe" WHERE id = $1',
      [id],
    );
    if (rows.length !== 1) throw new Error(`probe row ${id} not found`);

    const tz = await pool.query<{ TimeZone: string }>('SHOW TimeZone');

    process.stdout.write(
      `${JSON.stringify({
        hostOffsetMinutes: new Date().getTimezoneOffset(),
        hostTz: process.env['TZ'] ?? null,
        sessionTimeZone: tz.rows[0].TimeZone,
        explicitAt: rows[0].explicitAt.toISOString(),
        defaultAt: rows[0].defaultAt.toISOString(),
        groundTruth: rows[0].groundTruth.toISOString(),
      })}\n`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

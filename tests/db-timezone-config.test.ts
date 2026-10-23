/**
 * tests/db-timezone-config.test.ts — Step 2.4.6-0 (D-070).
 *
 * Pure-configuration tests for `server/db-timezone.ts`: the connection-string
 * merge, the naive-timestamp decoder, the type-parser dispatch, and the pool
 * config shape. These are the guards around the central UTC policy; the
 * behavioural proof that real timestamps survive a database round trip lives in
 * tests/database-timezone.test.ts.
 *
 * Run:
 *   node --import ./tests/helpers/register-hooks.mjs
 *        --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
 *        --test tests/db-timezone-config.test.ts
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import pg from 'pg';
import {
  DATABASE_SESSION_TIME_ZONE,
  POSTGRES_UTC_SESSION_OPTION,
  enforceUtcDateParameterEncoding,
  getUtcTypeParser,
  parseNaiveTimestampAsUtc,
  utcPoolConfig,
  withUtcSessionOption,
} from '../server/db-timezone.ts';

const BASE = 'postgresql://user:secret@localhost:5432/ariot';

describe('parseNaiveTimestampAsUtc', () => {
  it('reads a naive timestamp as UTC, not as host local time', () => {
    const parsed = parseNaiveTimestampAsUtc('2026-01-15 10:20:30.123');
    assert.ok(parsed);
    assert.strictEqual(parsed.toISOString(), '2026-01-15T10:20:30.123Z');
  });

  it('accepts the ISO "T" separator and a missing fraction', () => {
    assert.strictEqual(
      parseNaiveTimestampAsUtc('2026-01-15T10:20:30')?.toISOString(),
      '2026-01-15T10:20:30.000Z',
    );
  });

  it('truncates microseconds to millisecond precision', () => {
    assert.strictEqual(
      parseNaiveTimestampAsUtc('2026-01-15 10:20:30.123456')?.toISOString(),
      '2026-01-15T10:20:30.123Z',
    );
  });

  it('pads a short fraction rather than misreading its magnitude', () => {
    assert.strictEqual(
      parseNaiveTimestampAsUtc('2026-01-15 10:20:30.5')?.toISOString(),
      '2026-01-15T10:20:30.500Z',
    );
  });

  it('returns null for values it must not guess at', () => {
    for (const value of ['infinity', '-infinity', '0044-03-15 00:00:00 BC', 'not a timestamp']) {
      assert.strictEqual(parseNaiveTimestampAsUtc(value), null, value);
    }
  });
});

describe('getUtcTypeParser', () => {
  const TIMESTAMP = pg.types.builtins.TIMESTAMP;
  const TIMESTAMPTZ = pg.types.builtins.TIMESTAMPTZ;

  it('decodes naive timestamps as UTC', () => {
    const parsed = getUtcTypeParser(TIMESTAMP)('2026-01-15 10:20:30.123') as Date;
    assert.strictEqual(parsed.toISOString(), '2026-01-15T10:20:30.123Z');
  });

  it('leaves timestamptz to the driver, which already honours the offset', () => {
    assert.strictEqual(getUtcTypeParser(TIMESTAMPTZ), pg.types.getTypeParser(TIMESTAMPTZ));
  });

  it('leaves unrelated types untouched', () => {
    assert.strictEqual(
      getUtcTypeParser(pg.types.builtins.INT4),
      pg.types.getTypeParser(pg.types.builtins.INT4),
    );
  });

  it('falls back to the driver parser for values it cannot decode', () => {
    assert.strictEqual(
      getUtcTypeParser(TIMESTAMP)('infinity'),
      pg.types.getTypeParser(TIMESTAMP)('infinity'),
    );
  });

  it('does not claim binary results', () => {
    assert.strictEqual(
      getUtcTypeParser(TIMESTAMP, 'binary'),
      pg.types.getTypeParser(TIMESTAMP, 'binary'),
    );
  });
});

describe('withUtcSessionOption', () => {
  it('leaves a plain URL alone and supplies the option separately', () => {
    const result = withUtcSessionOption(BASE);
    assert.strictEqual(result.connectionString, BASE);
    assert.strictEqual(result.options, POSTGRES_UTC_SESSION_OPTION);
  });

  it('keeps unrelated query parameters in place', () => {
    const result = withUtcSessionOption(`${BASE}?schema=public&connect_timeout=5`);
    assert.strictEqual(result.connectionString, `${BASE}?schema=public&connect_timeout=5`);
    assert.strictEqual(result.options, POSTGRES_UTC_SESSION_OPTION);
  });

  it('lifts a URL-supplied options parameter out, so pg cannot override us', () => {
    // pg-connection-string copies a URL `options` over PoolConfig.options, which
    // would silently drop the UTC switch. Moving it into the merged string keeps
    // the caller's switches and leaves UTC authoritative.
    const result = withUtcSessionOption(`${BASE}?options=-c%20statement_timeout%3D7000`);
    assert.strictEqual(result.connectionString, BASE);
    assert.strictEqual(result.options, `-c statement_timeout=7000 ${POSTGRES_UTC_SESSION_OPTION}`);
  });

  it('appends UTC last when the URL already pins a different zone', () => {
    const result = withUtcSessionOption(`${BASE}?options=-c%20timezone%3DAsia%2FDhaka`);
    // PostgreSQL applies repeated -c switches left to right, so ours wins.
    assert.strictEqual(result.options, `-c timezone=Asia/Dhaka ${POSTGRES_UTC_SESSION_OPTION}`);
    assert.ok(result.options.endsWith(POSTGRES_UTC_SESSION_OPTION));
  });

  it('decodes "+" as a space, matching libpq query decoding', () => {
    const result = withUtcSessionOption(`${BASE}?options=-c+statement_timeout%3D7000`);
    assert.strictEqual(result.options, `-c statement_timeout=7000 ${POSTGRES_UTC_SESSION_OPTION}`);
  });

  it('preserves other parameters while lifting options out', () => {
    const result = withUtcSessionOption(`${BASE}?schema=public&options=-c%20lock_timeout%3D100`);
    assert.strictEqual(result.connectionString, `${BASE}?schema=public`);
    assert.strictEqual(result.options, `-c lock_timeout=100 ${POSTGRES_UTC_SESSION_OPTION}`);
  });

  it('does not re-encode the URL, so credentials survive verbatim', () => {
    const withSymbols = 'postgresql://user:p%40ss%3Aword@localhost:5432/ariot';
    assert.strictEqual(withUtcSessionOption(withSymbols).connectionString, withSymbols);
  });
});

describe('utcPoolConfig', () => {
  it('pins the session zone and the naive-timestamp decoder together', () => {
    const config = utcPoolConfig(BASE);
    assert.strictEqual(config.connectionString, BASE);
    assert.strictEqual(config.options, POSTGRES_UTC_SESSION_OPTION);
    assert.strictEqual(config.types?.getTypeParser, getUtcTypeParser);
  });

  it('carries extra pool settings through', () => {
    const config = utcPoolConfig(BASE, { max: 3, application_name: 'ariot-test' });
    assert.strictEqual(config.max, 3);
    assert.strictEqual(config.application_name, 'ariot-test');
    assert.strictEqual(config.options, POSTGRES_UTC_SESSION_OPTION);
  });

  it('enforces UTC encoding of Date parameters as a side effect', () => {
    pg.defaults.parseInputDatesAsUTC = false;
    utcPoolConfig(BASE);
    assert.strictEqual(pg.defaults.parseInputDatesAsUTC, true);
  });

  it('is already enforced at module load, before any pool is built', () => {
    // The module sets it on import; this only re-asserts the invariant after the
    // test above deliberately flipped it off.
    enforceUtcDateParameterEncoding();
    assert.strictEqual(pg.defaults.parseInputDatesAsUTC, true);
  });

  it('names UTC as the one session time zone', () => {
    assert.strictEqual(DATABASE_SESSION_TIME_ZONE, 'UTC');
    assert.strictEqual(POSTGRES_UTC_SESSION_OPTION, '-c timezone=UTC');
  });
});

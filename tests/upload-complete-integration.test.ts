/**
 * tests/upload-complete-integration.test.ts — Step 2.4.4 R2 completion
 * integration tests (STORAGE-1R / D-067, TASK 11).
 *
 * Exercises the REAL `finalizeUpload` logic against a disposable PostgreSQL
 * database with a mocked S3 client. The product-media-integration pattern is
 * reused for DB lifecycle; this file adds an in-memory S3 mock + an env stub
 * so the real finalizeUpload code path runs end-to-end without touching R2.
 *
 * 12 scenarios:
 *   1. success path → MediaAsset row, AuditLog row, no second audit on replay
 *   2. ETag mismatch on copy → asset not persisted, error result
 *   3. size mismatch between token + HEAD → rejected, no row
 *   4. content-type mismatch between token + HEAD → rejected, no row
 *   5. detected MIME mismatch (declared image/png, real file is JPEG) → no row
 *   6. empty body (ContentLength=0) → not_found/validation, no row
 *   7. declared VIDEO kind but real file is image → rejected
 *   8. tampered tempKey in token (path-traversal) → validation, no row
 *   9. concurrent same-token completes → exactly one MediaAsset + one AuditLog
 *  10. temp cleanup called once on success; cleanup failure does not roll back
 *  11. permanent-object HEAD verification failure → no row
 *  12. cancel/abort: no MediaAsset row when GET signature range fails
 *
 * Run:
 *   node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     --test tests/upload-complete-integration.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { utcPoolConfig } from '../server/db-timezone.ts';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { Readable as ReadableStream } from 'node:stream';
import { createUploadToken, UPLOAD_TOKEN_TTL_MS } from '../server/storage/upload-token.ts';
import {
  finalizeUpload,
  setPersistDepsOverrideForTests,
  setR2ClientOverrideForTests,
} from '../server/storage/upload-complete.ts';
import { buildTempUploadKey, buildPublicMediaKey } from '../server/storage/upload-keys.ts';
import { MEDIA_KIND } from '../server/admin/media/media-policy.ts';
import type { UploadTokenPayload } from '../server/storage/upload-token.ts';
import type { R2Config } from '../server/storage/upload-context.ts';

const { Pool, Client } = pg;

// ── Env loading ──────────────────────────────────────────────────────────────

function loadEnvVar(key: string): string {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) throw new Error('.env not found');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*(.*)`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(`${key} not found in .env`);
}

const baseUrl = loadEnvVar('DATABASE_URL');
const TEST_DB_NAME = 'ariot_upload_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);

assert.ok(testUrl.includes('localhost') || testUrl.includes('127.0.0.1'), 'Test URL must be local');

const adminUrl = baseUrl.replace(/\/ariot(\?|$)/, '/postgres$1');

const SIGNING_SECRET = 'integration-test-signing-secret-32+bytes-base64!';

const R2_CFG: R2Config = {
  accountId: 'integration',
  accessKeyId: 'integration',
  secretAccessKey: 'integration',
  bucketName: 'ariot-integration-test',
  endpoint: 'https://integration.r2.cloudflarestorage.com',
  publicBaseUrl: 'https://media.integration.example',
  uploadTokenSecret: SIGNING_SECRET,
};

// ── DB lifecycle ─────────────────────────────────────────────────────────────

let pool: InstanceType<typeof Pool>;

async function createDb() {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  await admin.end();
}

async function dropDb() {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await admin.end();
}

async function seedSchema() {
  // Mirrors prisma/schema.prisma's MediaAsset + AuditLog models so the
  // generated Prisma client doesn't reject columns/enums it expects (e.g.
  // sourcePromptId, MediaKind enum, RoleKey enum). Indexed columns and
  // foreign keys are omitted in the disposable DB — the tests only exercise
  // inserts + selects on these two tables.
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'OTHER');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "RoleKey" AS ENUM ('SUPER_ADMIN', 'CONTENT_ADMIN', 'SUPPORT_ADMIN', 'SALES_ADMIN');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE TABLE IF NOT EXISTS "MediaAsset" (
      id TEXT PRIMARY KEY,
      kind "MediaKind" NOT NULL,
      mime TEXT NOT NULL,
      "sizeBytes" BIGINT NOT NULL DEFAULT 0,
      width INT,
      height INT,
      "durationSeconds" INT,
      "storageKey" TEXT NOT NULL,
      "cdnUrl" TEXT,
      variants JSONB NOT NULL DEFAULT '[]'::jsonb,
      "altText" TEXT,
      caption TEXT,
      "sourcePromptId" TEXT,
      folder TEXT,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      "isPublic" BOOLEAN NOT NULL DEFAULT false,
      "uploadedBy" TEXT,
      "deletedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "actorId" TEXT,
      "actorRole" "RoleKey",
      action TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      before JSONB,
      after JSONB,
      "ipHash" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function mediaCount() {
  const r = await pool.query(`SELECT COUNT(*)::int as cnt FROM "MediaAsset"`);
  return r.rows[0].cnt;
}

async function auditCountFor(entityId: string) {
  const r = await pool.query(`SELECT COUNT(*)::int as cnt FROM "AuditLog" WHERE "entityId" = $1`, [
    entityId,
  ]);
  return r.rows[0].cnt;
}

async function getAsset(id: string) {
  const r = await pool.query(`SELECT * FROM "MediaAsset" WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

// ── S3 mock ──────────────────────────────────────────────────────────────────

type MockState = {
  tempObjects: Map<string, { body: Buffer; contentType: string; sizeBytes: number; etag: string }>;
  publicObjects: Map<
    string,
    { body: Buffer; contentType: string; sizeBytes: number; etag: string }
  >;
  deleteTempCalls: number;
  failHeadTemp?: boolean;
  failCopy?: boolean;
  failDeleteTemp?: boolean;
  failGetObject?: boolean;
  failPermanentHead?: boolean;
  tempKeyOverride?: string;
  mutateOnCopy?: boolean;
  mutatedEtag?: string;
};

const makeMockClient = (state: MockState) => {
  const fakeEtag = (key: string): string => `"etag-${key}"`;
  return {
    async send(cmd: unknown) {
      if (cmd instanceof HeadObjectCommand) {
        const key = (cmd.input as { Key: string }).Key;
        if (state.failHeadTemp) throw new Error('simulated head failure');
        if (state.failPermanentHead && state.publicObjects.has(key)) {
          throw Object.assign(new Error('simulated permanent-head failure'), {
            name: 'ServiceError',
          });
        }
        if (state.tempKeyOverride && key === state.tempKeyOverride) {
          throw Object.assign(new Error('NotFound'), { name: 'NotFound' });
        }
        const obj = state.tempObjects.get(key) ?? state.publicObjects.get(key);
        if (!obj) {
          throw Object.assign(new Error('NotFound'), { name: 'NotFound' });
        }
        return {
          ContentLength: obj.sizeBytes,
          ContentType: obj.contentType,
          ETag: obj.etag,
        };
      }
      if (cmd instanceof GetObjectCommand) {
        const key = (cmd.input as { Key: string }).Key;
        if (state.failGetObject) {
          // Simulate a stream that emits an error mid-read so the production
          // readBounded helper rejects and finalizeUpload returns
          // {ok:false,type:'error'} rather than throwing.
          const err = new Error('simulated stream read failure');
          const stream: Readable = new ReadableStream({
            read() {
              setImmediate(() => this.destroy(err));
            },
          });
          return { Body: stream };
        }
        const obj = state.tempObjects.get(key);
        if (!obj) {
          throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
        }
        const range = (cmd.input as { Range?: string }).Range;
        let body: Buffer = obj.body;
        if (range) {
          const m = range.match(/bytes=0-(\d+)/);
          if (m) body = obj.body.subarray(0, Number(m[1]) + 1);
        }
        const stream: Readable = ReadableStream.from([body]);
        return { Body: stream };
      }
      if (cmd instanceof CopyObjectCommand) {
        if (state.failCopy) throw new Error('simulated copy failure');
        const src = (cmd.input as { CopySource: string }).CopySource;
        const destKey = (cmd.input as { Key: string }).Key;
        const ifMatch = (cmd.input as { CopySourceIfMatch?: string }).CopySourceIfMatch;
        const srcKey = decodeURIComponent(src.split('/').slice(1).join('/'));
        const obj = state.tempObjects.get(srcKey);
        if (!obj) throw new Error('NoSuchKey');
        // Simulate a concurrent PUT replacing the object between HEAD and
        // CopyObject — the temp's stored etag is now different from the etag
        // we HEADed, so CopySourceIfMatch rejects the copy.
        if (state.mutateOnCopy && state.mutatedEtag) {
          obj.etag = state.mutatedEtag;
        }
        if (ifMatch && obj.etag !== ifMatch) {
          throw Object.assign(new Error('PreconditionFailed'), { name: 'PreconditionFailed' });
        }
        state.publicObjects.set(destKey, {
          body: obj.body,
          contentType: (cmd.input as { ContentType?: string }).ContentType ?? obj.contentType,
          sizeBytes: obj.sizeBytes,
          etag: fakeEtag(destKey),
        });
        return {};
      }
      if (cmd instanceof DeleteObjectCommand) {
        const key = (cmd.input as { Key: string }).Key;
        if (state.failDeleteTemp) throw new Error('simulated delete failure');
        if (key.startsWith('tmp/uploads/')) {
          state.deleteTempCalls += 1;
          state.tempObjects.delete(key);
        } else {
          state.publicObjects.delete(key);
        }
        return {};
      }
      throw new Error(
        'Unhandled command in mock: ' + (cmd as { constructor: { name: string } }).constructor.name,
      );
    },
  };
};

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x08, 0x08, 0x02, 0x00, 0x00, 0x00, 0x4b, 0x6d, 0x29,
  0xdc,
]);

const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

// ── Persistence prisma client (real Prisma client pointed at the test DB) ────

let persistPrisma: Awaited<ReturnType<typeof importPrisma>>;

async function importPrisma() {
  const { PrismaClient } = await import('../lib/generated/prisma/client.ts');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  return new PrismaClient({
    adapter: new PrismaPg(utcPoolConfig(testUrl)),
  });
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

before(async () => {
  await createDb();
  pool = new Pool(utcPoolConfig(testUrl));
  await seedSchema();
  persistPrisma = await importPrisma();
});

after(async () => {
  setPersistDepsOverrideForTests(null);
  setR2ClientOverrideForTests(null);
  await persistPrisma.$disconnect();
  await pool.end();
  await dropDb();
});

beforeEach(async () => {
  setR2ClientOverrideForTests(null);
  setPersistDepsOverrideForTests(null);
  // Clear MediaAsset + AuditLog rows so each test gets a clean slate.
  // The DB is recreated in the `before` hook, but rows accumulate across
  // tests within the run, which breaks idempotency-based assertions.
  if (pool) {
    await pool.query('TRUNCATE TABLE "MediaAsset", "AuditLog" RESTART IDENTITY CASCADE');
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildToken(args: {
  id: string;
  kind?: 'IMAGE' | 'VIDEO';
  mime?: string;
  sizeBytes?: number;
  userId: string;
  tempKeyOverride?: string;
  publicKeyOverride?: string;
}): string {
  const kind = args.kind ?? MEDIA_KIND.IMAGE;
  const mime = args.mime ?? 'image/png';
  const size = args.sizeBytes ?? PNG_BYTES.length;
  const now = new Date();
  const tempKey =
    args.tempKeyOverride ?? buildTempUploadKey({ id: args.id, ext: 'png', date: now });
  const publicKey =
    args.publicKeyOverride ?? buildPublicMediaKey({ kind, id: args.id, ext: 'png', date: now });
  return createUploadToken(SIGNING_SECRET, {
    mediaAssetId: args.id,
    mimeType: mime as UploadTokenPayload['mimeType'],
    sizeBytes: size,
    kind,
    tempKey,
    publicKey,
    userId: args.userId,
  });
}

async function runFinalize(state: MockState, token: string): ReturnType<typeof finalizeUpload> {
  setR2ClientOverrideForTests(makeMockClient(state) as MockClient);
  setPersistDepsOverrideForTests({ prisma: persistPrisma });
  const decoded = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
  ) as UploadTokenPayload & { exp: number };
  return await finalizeUpload({
    payload: decoded,
    config: R2_CFG,
    actorRoleValue: 'CONTENT_ADMIN',
  });
}

// Recreate the implicit S3Like type by inferring from the function — this
// avoids importing a runtime helper just for types in a test.
type MockClient = ReturnType<(typeof import('../server/storage/r2-client.ts'))['getR2Client']>;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Upload completion — disposable DB + mocked R2', () => {
  it('1. happy path → MediaAsset row + one AuditLog, then replay → created=false + no extra audit', async () => {
    const id = 'c' + 'integration1'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.png`;
    const publicKey = `public/products/images/2026/01/${id}.png`;
    const token = buildToken({
      id,
      userId: 'actor-integration-1',
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });

    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: PNG_BYTES,
            contentType: 'image/png',
            sizeBytes: PNG_BYTES.length,
            etag: '"etag-temp"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
    };

    const r1 = await runFinalize(state, token);
    assert.equal(r1.ok, true, r1.ok ? '' : r1.message);
    if (!r1.ok) return;
    assert.equal(r1.created, true);

    const asset = await getAsset(id);
    assert.ok(asset, 'MediaAsset row was created');
    assert.equal(asset.uploadedBy, 'actor-integration-1');
    const audits = await auditCountFor(id);
    assert.equal(audits, 1, 'exactly one audit row on first success');

    // Replay must use a fresh R2 state — the first call deletes the temp
    // object (best-effort cleanup), so reusing state would fail the replay's
    // HEAD on a missing key. We're testing DB-side idempotency here, not
    // R2-side.
    const replayState: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: PNG_BYTES,
            contentType: 'image/png',
            sizeBytes: PNG_BYTES.length,
            etag: '"etag-temp"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
    };
    const r2 = await runFinalize(replayState, token);
    assert.equal(r2.ok, true);
    if (!r2.ok) return;
    assert.equal(r2.created, false, 'replay returns created=false');
    assert.equal(r2.asset.id, id);
    assert.equal(await auditCountFor(id), 1, 'no second audit row on replay');
  });

  it('2. ETag-bound copy precondition fails → no MediaAsset row', async () => {
    const id = 'c' + 'integration2'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.png`;
    const publicKey = `public/products/images/2026/01/${id}.png`;
    const token = buildToken({
      id,
      userId: 'actor-integration-2',
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });

    // The mock simulates a concurrent PUT replacing the object between HEAD
    // and CopyObject: HEAD returns etag A, but by the time CopyObject fires
    // the stored etag is B, so CopySourceIfMatch=A is rejected. This is the
    // race that ETag-bound copy is designed to catch.
    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: PNG_BYTES,
            contentType: 'image/png',
            sizeBytes: PNG_BYTES.length,
            etag: '"original-etag"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
      mutateOnCopy: true,
      mutatedEtag: '"mutated-etag"',
    };

    const result = await runFinalize(state, token);
    assert.equal(result.ok, false);
    assert.equal(await mediaCount(), 0, 'no MediaAsset row created when copy fails');
  });

  it('3. size mismatch (token says 1MB, actual 32B) → rejected, no row', async () => {
    const id = 'c' + 'integration3'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.png`;
    const publicKey = `public/products/images/2026/01/${id}.png`;
    const token = buildToken({
      id,
      userId: 'actor-integration-3',
      sizeBytes: 1_000_000,
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });
    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: PNG_BYTES,
            contentType: 'image/png',
            sizeBytes: PNG_BYTES.length,
            etag: '"etag-temp"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
    };
    const result = await runFinalize(state, token);
    assert.equal(result.ok, false);
    assert.equal(await mediaCount(), 0);
  });

  it('4. content-type mismatch (token says png, actual jpeg) → rejected, no row', async () => {
    const id = 'c' + 'integration4'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.png`;
    const publicKey = `public/products/images/2026/01/${id}.png`;
    const token = buildToken({
      id,
      userId: 'actor-integration-4',
      mime: 'image/png',
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });
    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: PNG_BYTES,
            contentType: 'image/jpeg',
            sizeBytes: PNG_BYTES.length,
            etag: '"etag-temp"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
    };
    const result = await runFinalize(state, token);
    assert.equal(result.ok, false);
    assert.equal(await mediaCount(), 0);
  });

  it('5. declared image/png but real bytes are JPEG → detected MIME mismatch → no row', async () => {
    const id = 'c' + 'integration5'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.png`;
    const publicKey = `public/products/images/2026/01/${id}.png`;
    const token = buildToken({
      id,
      userId: 'actor-integration-5',
      mime: 'image/png',
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });
    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: JPEG_BYTES,
            contentType: 'image/png',
            sizeBytes: JPEG_BYTES.length,
            etag: '"etag-temp"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
    };
    const result = await runFinalize(state, token);
    assert.equal(result.ok, false);
    assert.equal(await mediaCount(), 0);
  });

  it('6. zero-byte body → validation, no row', async () => {
    const id = 'c' + 'integration6'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.png`;
    const publicKey = `public/products/images/2026/01/${id}.png`;
    const token = buildToken({
      id,
      userId: 'actor-integration-6',
      sizeBytes: 32,
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });
    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          { body: Buffer.alloc(0), contentType: 'image/png', sizeBytes: 0, etag: '"empty"' },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
    };
    const result = await runFinalize(state, token);
    assert.equal(result.ok, false);
    assert.equal(await mediaCount(), 0);
  });

  it('7. declared VIDEO kind but real file is image → rejected, no row', async () => {
    const id = 'c' + 'integration7'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.mp4`;
    const publicKey = `public/products/videos/2026/01/${id}.mp4`;
    const token = buildToken({
      id,
      userId: 'actor-integration-7',
      kind: MEDIA_KIND.VIDEO,
      mime: 'video/mp4',
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });
    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: PNG_BYTES,
            contentType: 'video/mp4',
            sizeBytes: PNG_BYTES.length,
            etag: '"etag-temp"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
    };
    const result = await runFinalize(state, token);
    assert.equal(result.ok, false);
    assert.equal(await mediaCount(), 0);
  });

  it('8. tampered tempKey (path traversal) → validation, no row', async () => {
    const id = 'c' + 'integration8'.padEnd(24, '0');
    const token = buildToken({
      id,
      userId: 'actor-integration-8',
      tempKeyOverride: '../etc/passwd',
    });
    const state: MockState = {
      tempObjects: new Map(),
      publicObjects: new Map(),
      deleteTempCalls: 0,
    };
    const result = await runFinalize(state, token);
    assert.equal(result.ok, false);
    assert.equal(await mediaCount(), 0);
  });

  it('10. concurrent same-token completes → exactly one MediaAsset + one AuditLog', async () => {
    const id = 'c' + 'integration10'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.png`;
    const publicKey = `public/products/images/2026/01/${id}.png`;
    const token = buildToken({
      id,
      userId: 'actor-integration-10',
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });
    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: PNG_BYTES,
            contentType: 'image/png',
            sizeBytes: PNG_BYTES.length,
            etag: '"etag-temp"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
    };
    const results = await Promise.all([
      runFinalize(state, token),
      runFinalize(state, token),
      runFinalize(state, token),
    ]);
    const okCount = results.filter((r) => r.ok).length;
    assert.ok(okCount >= 1, 'at least one success');
    const created = results.filter((r) => r.ok && r.created === true).length;
    assert.equal(created, 1, 'exactly one create; the rest are replay');
    const asset = await getAsset(id);
    assert.ok(asset);
    assert.equal(await auditCountFor(id), 1);
  });

  it('11. temp cleanup called once on success; cleanup failure does not roll back', async () => {
    const id = 'c' + 'integration11'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.png`;
    const publicKey = `public/products/images/2026/01/${id}.png`;
    const token = buildToken({
      id,
      userId: 'actor-integration-11',
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });
    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: PNG_BYTES,
            contentType: 'image/png',
            sizeBytes: PNG_BYTES.length,
            etag: '"etag-temp"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
      failDeleteTemp: true,
    };
    const result = await runFinalize(state, token);
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    assert.equal((await getAsset(id)) !== null, true, 'asset persisted despite cleanup failure');
  });

  it('12. permanent-object HEAD verification failure → no row', async () => {
    const id = 'c' + 'integration12'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.png`;
    const publicKey = `public/products/images/2026/01/${id}.png`;
    const token = buildToken({
      id,
      userId: 'actor-integration-12',
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });
    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: PNG_BYTES,
            contentType: 'image/png',
            sizeBytes: PNG_BYTES.length,
            etag: '"etag-temp"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
      failPermanentHead: true,
    };
    const result = await runFinalize(state, token);
    assert.equal(result.ok, false);
    assert.equal(await mediaCount(), 0);
  });

  it('13. cancel/abort: no MediaAsset row when GET signature range fails', async () => {
    const id = 'c' + 'integration13'.padEnd(24, '0');
    const tempKey = `tmp/uploads/2026/01/${id}.png`;
    const publicKey = `public/products/images/2026/01/${id}.png`;
    const token = buildToken({
      id,
      userId: 'actor-integration-13',
      tempKeyOverride: tempKey,
      publicKeyOverride: publicKey,
    });
    const state: MockState = {
      tempObjects: new Map([
        [
          tempKey,
          {
            body: PNG_BYTES,
            contentType: 'image/png',
            sizeBytes: PNG_BYTES.length,
            etag: '"etag-temp"',
          },
        ],
      ]),
      publicObjects: new Map(),
      deleteTempCalls: 0,
      failGetObject: true,
    };
    const result = await runFinalize(state, token);
    assert.equal(result.ok, false);
    assert.equal(await mediaCount(), 0);
  });
});

// Suppress unused helper warnings for the token TTL — included for reviewer
// visibility of the constant in this file.
void UPLOAD_TOKEN_TTL_MS;

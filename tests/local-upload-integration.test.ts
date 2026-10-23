/**
 * tests/local-upload-integration.test.ts — Step 2.4.4 local provider (D-068).
 *
 * Exercises the REAL `localUploadFromForm` pipeline against a disposable
 * PostgreSQL database and an isolated temp provider root. The upload-complete
 * integration pattern is reused for the DB lifecycle.
 *
 * 10 scenarios:
 *   1. happy path → MediaAsset + AuditLog rows, file promoted on disk, temp
 *      cleaned, provider-neutral storageKey + site-relative cdnUrl
 *   2. two identical uploads → two distinct server-generated assets
 *   3. no permission → forbidden, no row, no files
 *   4. declared image/png but real JPEG bytes → validation, no row, no files
 *   5. declared VIDEO but real PNG bytes → validation, no row
 *   6. file too small to identify → validation, no row
 *   7. more than one file → validation, no row
 *   8. unexpected form field → validation, no row
 *   9. image over size cap → validation, no row
 *  10. public file stat matches the uploaded bytes after promote
 *
 * Run:
 *   node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/local-upload-integration.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import { utcPoolConfig } from '../server/db-timezone.ts';
import { localUploadFromForm } from '../server/storage/local-upload.ts';
import { statPublicKey } from '../server/storage/local-storage-fs.ts';
import { parsePublicMediaKey } from '../server/storage/upload-keys.ts';
import {
  clearAuthContextOverride,
  setAuthContextOverride,
} from '../server/storage/upload-context.ts';
import { MAX_IMAGE_SIZE_BYTES } from '../server/admin/media/media-policy.ts';

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
const TEST_DB_NAME = 'ariot_local_upload_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);

assert.ok(testUrl.includes('localhost') || testUrl.includes('127.0.0.1'), 'Test URL must be local');

const adminUrl = baseUrl.replace(/\/ariot(\?|$)/, '/postgres$1');

// ── Disposable DB lifecycle ──────────────────────────────────────────────────

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

// ── Isolated temp provider root ──────────────────────────────────────────────

let tempRoot: string;

async function walkFiles(dir: string): Promise<string[]> {
  const { readdir, stat } = await import('node:fs/promises');
  const out: string[] = [];
  const entries = await readdir(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

const tempFiles = async (): Promise<string[]> =>
  (await walkFiles(tempRoot)).map((p) => p.slice(tempRoot.length));

// ── Prisma client (real client pointed at the test DB) ───────────────────────

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
  tempRoot = mkdtempSync(join(tmpdir(), 'ariot-local-integration-'));
});

after(async () => {
  clearAuthContextOverride();
  await persistPrisma.$disconnect();
  await pool.end();
  await dropDb();
  rmSync(tempRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  clearAuthContextOverride();
  rmSync(tempRoot, { recursive: true, force: true });
  mkdirSync(tempRoot, { recursive: true });
  if (pool) {
    await pool.query('TRUNCATE TABLE "MediaAsset", "AuditLog" RESTART IDENTITY CASCADE');
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function installAuthStub(userId: string): void {
  setAuthContextOverride(async () => ({
    userId,
    email: `${userId}@test.local`,
    roles: ['CONTENT_ADMIN'],
    permissions: ['media.write'],
  }));
}

function buildForm(file: File, mimeType: string, kind: string): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('mimeType', mimeType);
  form.append('kind', kind);
  return form;
}

/** Buffer → BlobPart (typed for File construction under TS 5 lib). */
function toBlobPart(bytes: Buffer): BlobPart {
  return new Uint8Array(bytes);
}

const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x08, 0x08, 0x02, 0x00, 0x00, 0x00, 0x4b, 0x6d, 0x29,
  0xdc,
]);

const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

async function runUpload(file: File, mimeType: string, kind: string) {
  return await localUploadFromForm(buildForm(file, mimeType, kind), undefined, {
    prisma: persistPrisma,
    root: tempRoot,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Local upload — disposable DB + isolated temp root (D-068)', () => {
  it('1. happy path → rows persisted, file promoted, temp cleaned, URLs correct', async () => {
    installAuthStub('actor-local-1');
    const file = new File([toBlobPart(TINY_PNG)], 'hero.png', { type: 'image/png' });
    const result = await runUpload(file, 'image/png', 'IMAGE');
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    if (!result.ok) return;
    assert.equal(result.created, true);

    const asset = await getAsset(result.asset.id);
    assert.ok(asset, 'MediaAsset row was created');
    assert.equal(asset.uploadedBy, 'actor-local-1');
    assert.ok(
      String(asset.storageKey).startsWith('public/products/images/'),
      'storageKey is provider-neutral and under public/products/images',
    );
    assert.equal(asset.cdnUrl, `/media/${String(asset.storageKey).replace('public/', '')}`);
    assert.equal(await auditCountFor(result.asset.id), 1, 'exactly one audit row');

    // File exists at the promoted public path; temp side is empty.
    const publicParsed = parsePublicMediaKey(String(asset.storageKey));
    assert.ok(publicParsed, 'storageKey parses as a canonical public key');
    const publicPath = join(tempRoot, String(asset.storageKey));
    const onDisk = readFileSync(publicPath);
    assert.ok(onDisk.equals(TINY_PNG), 'promoted file matches uploaded bytes');
    assert.equal(
      (await tempFiles()).filter((p) => p.includes('tmp')).length,
      0,
      'no temp leftovers',
    );

    // Delivery path resolves under the root and serves the same bytes.
    const deliveryPath = join(tempRoot, String(asset.storageKey));
    assert.ok(existsSync(deliveryPath), 'delivery path resolves under the root');
  });

  it('2. two identical uploads produce two distinct server-generated assets', async () => {
    installAuthStub('actor-local-2');
    const file = new File([toBlobPart(TINY_PNG)], 'dup.png', { type: 'image/png' });
    const r1 = await runUpload(file, 'image/png', 'IMAGE');
    const r2 = await runUpload(file, 'image/png', 'IMAGE');
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    if (!r1.ok || !r2.ok) return;
    assert.notEqual(r1.asset.id, r2.asset.id, 'server mints a fresh id per upload');
    assert.equal(await mediaCount(), 2);
  });

  it('3. no permission → forbidden, no row, no files', async () => {
    // Null auth override simulates a denied caller; the real RBAC path is
    // covered by product-api-route-security tests.
    setAuthContextOverride(async () => null);
    const file = new File([toBlobPart(TINY_PNG)], 'nope.png', { type: 'image/png' });
    const result = await runUpload(file, 'image/png', 'IMAGE');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.type, 'forbidden');
    assert.equal(await mediaCount(), 0);
    assert.equal((await tempFiles()).length, 0);
  });

  it('4. declared image/png but real JPEG bytes → validation, no row, temp cleaned', async () => {
    installAuthStub('actor-local-4');
    const file = new File([toBlobPart(JPEG_BYTES)], 'fake.png', { type: 'image/png' });
    const result = await runUpload(file, 'image/png', 'IMAGE');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.type, 'validation');
    assert.equal(await mediaCount(), 0);
    assert.equal((await tempFiles()).length, 0, 'no files remain after rejection');
  });

  it('5. declared VIDEO but real PNG bytes → validation, no row', async () => {
    installAuthStub('actor-local-5');
    const file = new File([toBlobPart(TINY_PNG)], 'fake.mp4', { type: 'video/mp4' });
    const result = await runUpload(file, 'video/mp4', 'VIDEO');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.type, 'validation');
    assert.equal(await mediaCount(), 0);
  });

  it('6. file too small to identify → validation, no row', async () => {
    installAuthStub('actor-local-6');
    const file = new File([toBlobPart(Buffer.alloc(6))], 'tiny.png', { type: 'image/png' });
    const result = await runUpload(file, 'image/png', 'IMAGE');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.type, 'validation');
    assert.equal(await mediaCount(), 0);
  });

  it('7. more than one file → validation, no row', async () => {
    installAuthStub('actor-local-7');
    const form = new FormData();
    form.append('file', new File([toBlobPart(TINY_PNG)], 'a.png', { type: 'image/png' }));
    form.append('file', new File([toBlobPart(TINY_PNG)], 'b.png', { type: 'image/png' }));
    form.append('mimeType', 'image/png');
    form.append('kind', 'IMAGE');
    const result = await localUploadFromForm(form, undefined, {
      prisma: persistPrisma,
      root: tempRoot,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.type, 'validation');
    assert.equal(await mediaCount(), 0);
  });

  it('8. unexpected form field → validation, no row', async () => {
    installAuthStub('actor-local-8');
    const form = buildForm(
      new File([toBlobPart(TINY_PNG)], 'a.png', { type: 'image/png' }),
      'image/png',
      'IMAGE',
    );
    form.append('storageKey', 'public/products/x.png');
    const result = await localUploadFromForm(form, undefined, {
      prisma: persistPrisma,
      root: tempRoot,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.type, 'validation');
    assert.equal(await mediaCount(), 0);
  });

  it('9. image over the size cap → validation, no row', async () => {
    installAuthStub('actor-local-9');
    const file = new File([toBlobPart(Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1))], 'big.png', {
      type: 'image/png',
    });
    const result = await runUpload(file, 'image/png', 'IMAGE');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.type, 'validation');
    assert.equal(await mediaCount(), 0);
  });

  it('10. promoted public file stat matches the uploaded bytes', async () => {
    installAuthStub('actor-local-10');
    const file = new File([toBlobPart(TINY_PNG)], 'stat.png', { type: 'image/png' });
    const result = await runUpload(file, 'image/png', 'IMAGE');
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    if (!result.ok) return;
    const asset = await getAsset(result.asset.id);
    const publicKey = String(asset.storageKey);
    const statResult = await statPublicKey(tempRoot, publicKey);
    assert.ok(statResult, 'public key resolves on disk');
    assert.equal(statResult?.sizeBytes, TINY_PNG.length);
  });
});

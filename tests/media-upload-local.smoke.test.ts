/**
 * tests/media-upload-local.smoke.test.ts — Step 2.4.4 local provider smoke
 * test (D-068).
 *
 * Always-on end-to-end smoke of the `local` provider. Unlike the R2 smoke
 * test (tests/media-upload-r2.smoke.test.ts) this needs NO external
 * credentials: it is fully self-contained (isolated temp root + disposable
 * local PostgreSQL DB), so it runs in every inventory.
 *
 * Flow exercised through the real app boundary (`localUploadFromForm` — the
 * function behind POST /api/admin/media/uploads/local):
 *   temp write → signature verify → atomic promote → permanent verify →
 *   transactional MediaAsset + AuditLog persist → delivery resolution.
 *
 * Run:
 *   node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     --test tests/media-upload-local.smoke.test.ts
 */

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import { utcPoolConfig } from '../server/db-timezone.ts';
import { localUploadFromForm } from '../server/storage/local-upload.ts';
import { LocalMediaStorageProvider } from '../server/storage/local-media-storage.ts';
import { deleteOwnedKey, resolveKeyPath } from '../server/storage/local-storage-fs.ts';
import { parsePublicMediaKey } from '../server/storage/upload-keys.ts';
import {
  clearAuthContextOverride,
  setAuthContextOverride,
} from '../server/storage/upload-context.ts';

const { Pool, Client } = pg;

function loadEnvVar(key: string): string {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) throw new Error('.env not found');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*(.*)`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(`${key} not found in .env`);
}

const baseUrl = loadEnvVar('DATABASE_URL');
const TEST_DB_NAME = 'ariot_media_smoke_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);
const adminUrl = baseUrl.replace(/\/ariot(\?|$)/, '/postgres$1');

assert.ok(testUrl.includes('localhost') || testUrl.includes('127.0.0.1'), 'Test URL must be local');

// Tiny PNG (8x8 magenta square) — sufficient for file-type sniffing.
const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x08, 0x08, 0x02, 0x00, 0x00, 0x00, 0x4b, 0x6d, 0x29,
  0xdc,
]);

let pool: InstanceType<typeof Pool>;
let persistPrisma: Awaited<ReturnType<typeof importPrisma>>;
let tempRoot: string;

/** Buffer → BlobPart (typed for File construction under TS 5 lib). */
function toBlobPart(bytes: Buffer): BlobPart {
  return new Uint8Array(bytes);
}

async function importPrisma() {
  const { PrismaClient } = await import('../lib/generated/prisma/client.ts');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  return new PrismaClient({ adapter: new PrismaPg(utcPoolConfig(testUrl)) });
}

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

before(async () => {
  await createDb();
  pool = new Pool(utcPoolConfig(testUrl));
  await seedSchema();
  persistPrisma = await importPrisma();
  tempRoot = mkdtempSync(join(tmpdir(), 'ariot-local-smoke-'));
});

after(async () => {
  clearAuthContextOverride();
  await persistPrisma.$disconnect();
  await pool.end();
  await dropDb();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe('Local provider end-to-end smoke (D-068)', () => {
  it('real small image through the app boundary: write → verify → promote → persist → deliver', async () => {
    const userId = `smoke-${Date.now()}`;
    setAuthContextOverride(async () => ({
      userId,
      email: `${userId}@smoke.local`,
      roles: ['CONTENT_ADMIN'],
      permissions: ['media.write'],
    }));

    // 1. Upload a real PNG through the app boundary (what the route calls).
    const file = new File([toBlobPart(TINY_PNG)], 'smoke.png', { type: 'image/png' });
    const form = new FormData();
    form.append('file', file);
    form.append('mimeType', 'image/png');
    form.append('kind', 'IMAGE');

    const result = await localUploadFromForm(form, undefined, {
      prisma: persistPrisma,
      root: tempRoot,
    });
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    if (!result.ok) return;
    assert.equal(result.created, true);

    // 2. DB row: provider-neutral storageKey + site-relative cdnUrl.
    const row = await pool.query(`SELECT * FROM "MediaAsset" WHERE id = $1`, [result.asset.id]);
    const asset = row.rows[0];
    assert.ok(asset, 'MediaAsset persisted');
    assert.ok(String(asset.storageKey).startsWith('public/products/images/'));
    assert.equal(asset.cdnUrl, `/media/${String(asset.storageKey).replace('public/', '')}`);
    assert.equal(asset.uploadedBy, userId);
    assert.equal(asset.kind, 'IMAGE');

    // 3. Audit row written.
    const audit = await pool.query(
      `SELECT COUNT(*)::int as cnt FROM "AuditLog" WHERE "entityId" = $1`,
      [result.asset.id],
    );
    assert.equal(audit.rows[0].cnt, 1);

    // 4. File promoted on disk at the canonical public key.
    const parsed = parsePublicMediaKey(String(asset.storageKey));
    assert.ok(parsed, 'storageKey parses as canonical public key');
    const publicFile = join(tempRoot, String(asset.storageKey));
    assert.ok(existsSync(publicFile), 'public file exists');
    assert.ok(readFileSync(publicFile).equals(TINY_PNG), 'bytes match');

    // 5. No temp leftovers (the empty tmp/ dir may remain; no files under it).
    const { readdir, stat } = await import('node:fs/promises');
    const walk = async (dir: string): Promise<string[]> => {
      const out: string[] = [];
      const entries = await readdir(dir);
      for (const entry of entries) {
        const full = join(dir, entry);
        const info = await stat(full);
        if (info.isDirectory()) out.push(...(await walk(full)));
        else out.push(full);
      }
      return out;
    };
    const allFiles = (await walk(tempRoot)).map((p) => p.slice(tempRoot.length));
    assert.ok(!allFiles.some((p) => p.includes('tmp')), 'no temp files remain after promote');

    // 6. Delivery path resolves under the provider root (traversal-safe).
    const deliveryPath = resolveKeyPath(tempRoot, String(asset.storageKey));
    assert.equal(deliveryPath, publicFile);
    assert.ok(readFileSync(deliveryPath).equals(TINY_PNG));

    // 7. Public URL generation matches the delivery route contract.
    const provider = new LocalMediaStorageProvider({ root: tempRoot });
    const url = provider.getPublicUrl(String(asset.storageKey), asset.cdnUrl);
    assert.equal(url, `/media/${String(asset.storageKey).replace('public/', '')}`);
    assert.ok(
      url.startsWith('/media/products/images/'),
      'public URL starts with /media/products/images/',
    );

    // 8. Idempotency note: a second identical upload gets a fresh server id
    //    (no key collision) and creates a second, distinct row.
    const form2 = new FormData();
    form2.append('file', new File([toBlobPart(TINY_PNG)], 'smoke2.png', { type: 'image/png' }));
    form2.append('mimeType', 'image/png');
    form2.append('kind', 'IMAGE');
    const second = await localUploadFromForm(form2, undefined, {
      prisma: persistPrisma,
      root: tempRoot,
    });
    assert.equal(second.ok, true, second.ok ? '' : second.message);
    if (!second.ok) return;
    assert.notEqual(second.asset.id, result.asset.id);

    // 9. Best-effort cleanup of smoke artifacts.
    await deleteOwnedKey(tempRoot, String(asset.storageKey)).catch(() => undefined);
    await deleteOwnedKey(
      tempRoot,
      String(
        (await pool.query(`SELECT "storageKey" FROM "MediaAsset" WHERE id = $1`, [second.asset.id]))
          .rows[0].storageKey,
      ),
    ).catch(() => undefined);
  });
});

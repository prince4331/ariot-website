/**
 * tests/product-variants-integration.test.ts — Step 2.4.5 variants DB integration.
 *
 * Exercises the product variant mutation rules against a disposable PostgreSQL
 * database: create / update / archive, global SKU uniqueness, per-product option
 * combination uniqueness, optimistic concurrency on Product.updatedAt, default
 * variant handling, no-op behavior, and audit logging.
 *
 * The mutation mirror follows the service rules exactly (importing the real
 * normalize helpers from the schema module) — the same approach used by
 * product-media-integration and product-denied-write.
 *
 * Run:
 *   node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/product-variants-integration.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { utcPoolConfig } from '../server/db-timezone.ts';
import {
  normalizeSku,
  normalizeOptionValues,
  optionCombinationKey,
} from '../server/admin/products/product-variant-schema.ts';

const { Pool, Client } = pg;

// ── Load .env ────────────────────────────────────────────────────────────────

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
const TEST_DB_NAME = 'ariot_variants_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);

assert.ok(testUrl.includes('localhost') || testUrl.includes('127.0.0.1'), 'Test URL must be local');

const adminUrl = baseUrl.replace(/\/ariot(\?|$)/, '/postgres$1');
let pool: InstanceType<typeof Pool>;

// ── Disposable DB lifecycle ──────────────────────────────────────────────────

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
    CREATE TABLE IF NOT EXISTS "Category" (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      "deletedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "Product" (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      brand TEXT NOT NULL DEFAULT 'ARIOT',
      "categoryId" TEXT NOT NULL,
      "salesType" TEXT NOT NULL DEFAULT 'B2C',
      status TEXT NOT NULL DEFAULT 'DRAFT',
      stock INT NOT NULL DEFAULT 0,
      "stockPolicy" TEXT NOT NULL DEFAULT 'MADE_TO_ORDER',
      "updatedBy" TEXT,
      "deletedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "ProductVariant" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "productId" TEXT NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      "optionValues" JSONB NOT NULL,
      "priceMinor" BIGINT,
      currency TEXT,
      stock INT NOT NULL DEFAULT 0,
      barcode TEXT,
      "isDefault" BOOLEAN NOT NULL DEFAULT false,
      "deletedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "actorId" TEXT NOT NULL,
      "actorRole" TEXT,
      action TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      before JSONB,
      after JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function seedData() {
  await pool.query(`
    INSERT INTO "Category" (id, slug, name) VALUES ('cat1', 'robots', 'Robots');
    INSERT INTO "Product" (id, slug, name, sku, "categoryId")
    VALUES
      ('prod1', 'base-product', 'Base Product', 'BASE-001', 'cat1'),
      ('prod2', 'other-product', 'Other Product', 'OTHER-001', 'cat1');
  `);
}

const BASE_TOKEN = '2026-01-01T00:00:00.000Z';

async function resetState() {
  await pool.query(`TRUNCATE TABLE "ProductVariant", "AuditLog" RESTART IDENTITY CASCADE`);
  await pool.query(`UPDATE "Product" SET "updatedAt" = $1 WHERE id IN ('prod1', 'prod2')`, [
    BASE_TOKEN,
  ]);
}

// ── DB helpers ───────────────────────────────────────────────────────────────

async function getProductToken(productId: string): Promise<string> {
  const r = await pool.query(
    `SELECT "updatedAt" FROM "Product" WHERE id = $1 AND "deletedAt" IS NULL`,
    [productId],
  );
  assert.ok(r.rows.length === 1, 'product must exist');
  return r.rows[0].updatedAt.toISOString();
}

async function listVariants(productId: string) {
  const r = await pool.query(
    `SELECT id, sku, name, "optionValues", "priceMinor", currency, stock, barcode, "isDefault", "deletedAt"
     FROM "ProductVariant" WHERE "productId" = $1`,
    [productId],
  );
  return r.rows;
}

async function countAudit(action?: string): Promise<number> {
  const q = action
    ? `SELECT COUNT(*)::int as cnt FROM "AuditLog" WHERE action = $1`
    : `SELECT COUNT(*)::int as cnt FROM "AuditLog"`;
  const r = await pool.query(q, action ? [action] : []);
  return r.rows[0].cnt;
}

// ── Mutation mirror (mirrors service rules) ──────────────────────────────────

type VariantData = {
  name: string;
  sku: string;
  optionValues: Record<string, string>;
  priceMinor: string | null;
  currency: string | null;
  stock: number;
  barcode: string | null;
  isDefault: boolean;
};

type MirrorResult =
  | { ok: true; updatedAt: string; variantId?: string }
  | { ok: false; type: string; field?: string };

async function skuConflict(sku: string, excludeVariantId: string | null): Promise<boolean> {
  const varQ = await pool.query(
    `SELECT id FROM "ProductVariant" WHERE sku = $1 ${excludeVariantId ? 'AND id <> $2' : ''} LIMIT 1`,
    excludeVariantId ? [sku, excludeVariantId] : [sku],
  );
  const prodQ = await pool.query(
    `SELECT id FROM "Product" WHERE sku = $1 AND "deletedAt" IS NULL LIMIT 1`,
    [sku],
  );
  return varQ.rows.length > 0 || prodQ.rows.length > 0;
}

async function combinationConflict(
  productId: string,
  optionValues: Record<string, string>,
  excludeVariantId: string | null,
): Promise<boolean> {
  const q = await pool.query(
    `SELECT "optionValues" FROM "ProductVariant"
     WHERE "productId" = $1 AND "deletedAt" IS NULL ${excludeVariantId ? 'AND id <> $2' : ''}`,
    excludeVariantId ? [productId, excludeVariantId] : [productId],
  );
  const targetKey = optionCombinationKey(optionValues);
  for (const row of q.rows) {
    const normalized = normalizeOptionValues(row.optionValues);
    if (normalized.ok && optionCombinationKey(normalized.data) === targetKey) {
      return true;
    }
  }
  return false;
}

async function bumpProduct(productId: string, actorId: string): Promise<string> {
  const r = await pool.query(
    `UPDATE "Product" SET "updatedBy" = $1, "updatedAt" = NOW()
     WHERE id = $2 RETURNING "updatedAt"`,
    [actorId, productId],
  );
  return r.rows[0].updatedAt.toISOString();
}

async function writeAudit(
  actorId: string,
  action: string,
  productId: string,
  before: unknown,
  after: unknown,
) {
  await pool.query(
    `INSERT INTO "AuditLog" (id, "actorId", "actorRole", action, "entityType", "entityId", before, after, "createdAt")
     VALUES (gen_random_uuid(), $1, 'CONTENT_ADMIN', $2, 'Product', $3, $4, $5, NOW())`,
    [actorId, action, productId, JSON.stringify(before), JSON.stringify(after)],
  );
}

async function mirrorCreate(
  productId: string,
  data: VariantData,
  token: string,
): Promise<MirrorResult> {
  const current = await getProductToken(productId);
  if (current !== token) return { ok: false, type: 'conflict' };
  const normalizedOptions = normalizeOptionValues(data.optionValues);
  if (!normalizedOptions.ok) return { ok: false, type: 'validation' };
  if (await skuConflict(normalizeSku(data.sku), null)) {
    return { ok: false, type: 'duplicate', field: 'sku' };
  }
  if (await combinationConflict(productId, normalizedOptions.data, null)) {
    return { ok: false, type: 'duplicate', field: 'combination' };
  }

  if (data.isDefault) {
    await pool.query(
      `UPDATE "ProductVariant" SET "isDefault" = false
       WHERE "productId" = $1 AND "deletedAt" IS NULL AND "isDefault" = true`,
      [productId],
    );
  }

  const inserted = await pool.query(
    `INSERT INTO "ProductVariant" ("productId", sku, name, "optionValues", "priceMinor", currency, stock, barcode, "isDefault")
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      productId,
      normalizeSku(data.sku),
      data.name,
      JSON.stringify(normalizedOptions.data),
      data.priceMinor !== null ? BigInt(data.priceMinor) : null,
      data.currency,
      data.stock,
      data.barcode,
      data.isDefault,
    ],
  );

  const updatedAt = await bumpProduct(productId, 'actor1');
  await writeAudit('actor1', 'PRODUCT_VARIANT_CREATED', productId, null, data);
  return { ok: true, updatedAt, variantId: inserted.rows[0].id };
}

async function mirrorUpdate(
  productId: string,
  variantId: string,
  data: VariantData,
  token: string,
): Promise<MirrorResult> {
  const current = await getProductToken(productId);
  if (current !== token) return { ok: false, type: 'conflict' };
  const normalizedOptions = normalizeOptionValues(data.optionValues);
  if (!normalizedOptions.ok) return { ok: false, type: 'validation' };

  const variant = await pool.query(
    `SELECT sku, name, "optionValues", "priceMinor", currency, stock, barcode, "isDefault"
     FROM "ProductVariant" WHERE id = $1 AND "productId" = $2 AND "deletedAt" IS NULL`,
    [variantId, productId],
  );
  if (variant.rows.length === 0) return { ok: false, type: 'validation' };

  const row = variant.rows[0];
  const normalizedSku = normalizeSku(data.sku);
  const noop =
    row.name === data.name &&
    row.sku === normalizedSku &&
    optionCombinationKey(row.optionValues) === optionCombinationKey(normalizedOptions.data) &&
    (row.priceMinor?.toString() ?? null) === (data.priceMinor ?? null) &&
    (row.currency ?? null) === (data.currency ?? null) &&
    row.stock === data.stock &&
    (row.barcode ?? null) === (data.barcode ?? null) &&
    row.isDefault === data.isDefault;

  if (noop) return { ok: true, updatedAt: current, variantId };

  if (await skuConflict(normalizedSku, variantId)) {
    return { ok: false, type: 'duplicate', field: 'sku' };
  }
  if (await combinationConflict(productId, normalizedOptions.data, variantId)) {
    return { ok: false, type: 'duplicate', field: 'combination' };
  }

  if (data.isDefault) {
    await pool.query(
      `UPDATE "ProductVariant" SET "isDefault" = false
       WHERE "productId" = $1 AND "deletedAt" IS NULL AND "isDefault" = true AND id <> $2`,
      [productId, variantId],
    );
  }

  await pool.query(
    `UPDATE "ProductVariant" SET sku = $1, name = $2, "optionValues" = $3::jsonb,
       "priceMinor" = $4, currency = $5, stock = $6, barcode = $7, "isDefault" = $8
     WHERE id = $9`,
    [
      normalizedSku,
      data.name,
      JSON.stringify(normalizedOptions.data),
      data.priceMinor !== null ? BigInt(data.priceMinor) : null,
      data.currency,
      data.stock,
      data.barcode,
      data.isDefault,
      variantId,
    ],
  );

  const updatedAt = await bumpProduct(productId, 'actor1');
  await writeAudit('actor1', 'PRODUCT_VARIANT_UPDATED', productId, row, data);
  return { ok: true, updatedAt, variantId };
}

async function mirrorArchive(
  productId: string,
  variantId: string,
  token: string,
): Promise<MirrorResult> {
  const current = await getProductToken(productId);
  if (current !== token) return { ok: false, type: 'conflict' };

  const variant = await pool.query(
    `SELECT sku, name, "deletedAt" FROM "ProductVariant" WHERE id = $1 AND "productId" = $2`,
    [variantId, productId],
  );
  if (variant.rows.length === 0) return { ok: false, type: 'validation' };

  if (variant.rows[0].deletedAt !== null) {
    return { ok: true, updatedAt: current, variantId };
  }

  await pool.query(`UPDATE "ProductVariant" SET "deletedAt" = NOW() WHERE id = $1`, [variantId]);
  const updatedAt = await bumpProduct(productId, 'actor1');
  await writeAudit('actor1', 'PRODUCT_VARIANT_ARCHIVED', productId, null, {
    sku: variant.rows[0].sku,
    name: variant.rows[0].name,
  });
  return { ok: true, updatedAt, variantId };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

before(async () => {
  await createDb();
  pool = new Pool(utcPoolConfig(testUrl));
  await seedSchema();
  await seedData();
});

beforeEach(async () => {
  await resetState();
});

after(async () => {
  await pool.end();
  await dropDb();
});

// ── Test data ────────────────────────────────────────────────────────────────

const black12v: VariantData = {
  name: 'Black, 12V',
  sku: 'TS-001',
  optionValues: { color: 'Black', voltage: '12V' },
  priceMinor: '25000',
  currency: 'BDT',
  stock: 4,
  barcode: '0123456789012',
  isDefault: true,
};

const white12v: VariantData = {
  name: 'White, 12V',
  sku: 'TS-002',
  optionValues: { color: 'White', voltage: '12V' },
  priceMinor: '26000',
  currency: 'BDT',
  stock: 6,
  barcode: '0123456789013',
  isDefault: false,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Product variant mutations — disposable DB', () => {
  it('1. create variant: row + audit + product token bumped + normalization', async () => {
    const auditBefore = await countAudit('PRODUCT_VARIANT_CREATED');

    const result = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;

    const variants = await listVariants('prod1');
    assert.strictEqual(variants.length, 1);
    assert.strictEqual(variants[0].sku, 'TS-001');
    assert.strictEqual(variants[0].priceMinor, '25000');
    assert.strictEqual(variants[0].isDefault, true);
    assert.deepStrictEqual(variants[0].optionValues, { color: 'Black', voltage: '12V' });
    assert.notStrictEqual(result.updatedAt, BASE_TOKEN);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_CREATED'), auditBefore + 1);
  });

  it("2. create with SKU colliding with another product's variant: duplicate, no rows", async () => {
    await mirrorCreate('prod1', black12v, BASE_TOKEN);
    const auditBefore = await countAudit('PRODUCT_VARIANT_CREATED');

    const result = await mirrorCreate('prod2', { ...black12v, name: 'Dup' }, BASE_TOKEN);
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.field, 'sku');

    assert.strictEqual((await listVariants('prod2')).length, 0);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_CREATED'), auditBefore);
  });

  it('3. create with SKU colliding with the product SKU: duplicate', async () => {
    const result = await mirrorCreate('prod1', { ...black12v, sku: 'BASE-001' }, BASE_TOKEN);
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.field, 'sku');
    assert.strictEqual((await listVariants('prod1')).length, 0);
  });

  it('4. create duplicate combination (different key order): duplicate', async () => {
    const created = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!created.ok) return assert.fail('first create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_CREATED');

    const reordered: VariantData = {
      ...black12v,
      sku: 'TS-999',
      optionValues: { voltage: '12V', color: 'Black' },
    };
    const result = await mirrorCreate('prod1', reordered, created.updatedAt);
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.field, 'combination');
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_CREATED'), auditBefore);
  });

  it('5. create with invalid option values: rejected', async () => {
    const invalid: VariantData = {
      ...black12v,
      sku: 'TS-BAD',
      optionValues: { color: '' },
    };
    const result = await mirrorCreate('prod1', invalid, BASE_TOKEN);
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'validation');
    assert.strictEqual((await listVariants('prod1')).length, 0);
  });

  it('6. create isDefault=true clears an existing default', async () => {
    const first = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!first.ok) return assert.fail('first create failed');

    const result = await mirrorCreate('prod1', { ...white12v, isDefault: true }, first.updatedAt);
    assert.strictEqual(result.ok, true);

    const variants = await listVariants('prod1');
    const defaults = variants.filter((v) => v.isDefault);
    assert.strictEqual(defaults.length, 1);
    assert.strictEqual(defaults[0].sku, 'TS-002');
  });

  it('7. update variant: row + audit + token bumped', async () => {
    const created = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_UPDATED');

    const updated: VariantData = {
      ...black12v,
      name: 'Black, 12V (v2)',
      stock: 9,
      priceMinor: '27000',
    };
    const result = await mirrorUpdate('prod1', created.variantId, updated, created.updatedAt);
    assert.strictEqual(result.ok, true);

    const variants = await listVariants('prod1');
    assert.strictEqual(variants[0].name, 'Black, 12V (v2)');
    assert.strictEqual(variants[0].stock, 9);
    assert.strictEqual(variants[0].priceMinor, '27000');
    assert.notStrictEqual(result.updatedAt, created.updatedAt);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_UPDATED'), auditBefore + 1);
  });

  it('8. update no-op: success, no audit, token unchanged', async () => {
    const created = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_UPDATED');

    const result = await mirrorUpdate('prod1', created.variantId, black12v, created.updatedAt);
    assert.strictEqual(result.ok, true);
    if (result.ok) assert.strictEqual(result.updatedAt, created.updatedAt);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_UPDATED'), auditBefore);
  });

  it("9. update to another variant's SKU: duplicate, row unchanged", async () => {
    const v1 = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!v1.ok || !v1.variantId) return assert.fail('create failed');
    const v2 = await mirrorCreate('prod1', white12v, v1.updatedAt);
    if (!v2.ok || !v2.variantId) return assert.fail('create failed');

    const result = await mirrorUpdate(
      'prod1',
      v2.variantId,
      { ...white12v, sku: 'TS-001' },
      v2.updatedAt,
    );
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.field, 'sku');

    const variants = await listVariants('prod1');
    assert.strictEqual(variants.find((v) => v.id === v2.variantId).sku, 'TS-002');
  });

  it('10. update to duplicate combination (excluding self): duplicate', async () => {
    const v1 = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!v1.ok || !v1.variantId) return assert.fail('create failed');
    const v2 = await mirrorCreate('prod1', white12v, v1.updatedAt);
    if (!v2.ok || !v2.variantId) return assert.fail('create failed');

    const result = await mirrorUpdate(
      'prod1',
      v2.variantId,
      { ...white12v, optionValues: { color: 'Black', voltage: '12V' } },
      v2.updatedAt,
    );
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.field, 'combination');
  });

  it('11. update with stale token: conflict, no change, no audit', async () => {
    const created = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_UPDATED');

    const result = await mirrorUpdate('prod1', created.variantId, white12v, BASE_TOKEN);
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'conflict');
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_UPDATED'), auditBefore);
  });

  it('12. update missing variant: validation', async () => {
    const result = await mirrorUpdate('prod1', 'does-not-exist', black12v, BASE_TOKEN);
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'validation');
  });

  it('13. archive variant: deletedAt set + audit + token bumped', async () => {
    const created = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_ARCHIVED');

    const result = await mirrorArchive('prod1', created.variantId, created.updatedAt);
    assert.strictEqual(result.ok, true);

    const variants = await listVariants('prod1');
    assert.notStrictEqual(variants[0].deletedAt, null);
    assert.notStrictEqual(result.updatedAt, created.updatedAt);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_ARCHIVED'), auditBefore + 1);
  });

  it('14. archive already-archived variant: idempotent no-op, no audit', async () => {
    const created = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const first = await mirrorArchive('prod1', created.variantId, created.updatedAt);
    if (!first.ok) return assert.fail('first archive failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_ARCHIVED');

    const second = await mirrorArchive('prod1', created.variantId, first.updatedAt);
    assert.strictEqual(second.ok, true);
    if (second.ok) assert.strictEqual(second.updatedAt, first.updatedAt);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_ARCHIVED'), auditBefore);
  });

  it('15. archived variant is excluded from the loader-equivalent query', async () => {
    const created = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    await mirrorArchive('prod1', created.variantId, created.updatedAt);

    const active = await pool.query(
      `SELECT id FROM "ProductVariant" WHERE "productId" = 'prod1' AND "deletedAt" IS NULL`,
    );
    assert.strictEqual(active.rows.length, 0);
  });

  it('16. archived SKU stays reserved: new variant with same SKU is a duplicate', async () => {
    const created = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const archived = await mirrorArchive('prod1', created.variantId, created.updatedAt);
    if (!archived.ok) return assert.fail('archive failed');

    const result = await mirrorCreate('prod1', black12v, archived.updatedAt);
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.field, 'sku');
  });

  it('17. create without isDefault stores false', async () => {
    const result = await mirrorCreate('prod1', { ...black12v, isDefault: false }, BASE_TOKEN);
    assert.strictEqual(result.ok, true);
    assert.strictEqual((await listVariants('prod1'))[0].isDefault, false);
  });

  it('18. final integrity: products intact, audit trail complete, both DBs isolated', async () => {
    const created = await mirrorCreate('prod1', black12v, BASE_TOKEN);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    await mirrorCreate('prod2', white12v, BASE_TOKEN);
    await mirrorUpdate('prod1', created.variantId, { ...black12v, stock: 11 }, created.updatedAt);
    const products = await pool.query(`SELECT id, sku FROM "Product" ORDER BY id`);
    assert.strictEqual(products.rows.length, 2);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_CREATED'), 2);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_UPDATED'), 1);

    const prod1Token = await getProductToken('prod1');
    const prod2Token = await getProductToken('prod2');
    assert.notStrictEqual(prod1Token, BASE_TOKEN);
    assert.notStrictEqual(prod2Token, BASE_TOKEN);
  });
});

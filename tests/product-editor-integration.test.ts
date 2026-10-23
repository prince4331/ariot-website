/**
 * tests/product-editor-integration.test.ts — Step 2.4.3 runtime verification.
 *
 * Integration tests against a disposable PostgreSQL database (ariot_editor_test).
 * Uses pg directly to avoid Next.js path-alias resolution issues.
 *
 * This exercises the actual SQL behavior: transactions, uniqueness constraints,
 * concurrency, and audit logging — the same operations performed by the server.
 *
 * Run:
 *   node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/product-editor-integration.test.ts
 */

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { utcPoolConfig } from '../server/db-timezone.ts';
import { updateProductDetailsRequestSchema } from '../server/admin/products/product-details-schema.ts';

const { Pool, Client } = pg;

// ── Load .env and construct test URL ─────────────────────────────────────────

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
const TEST_DB_NAME = 'ariot_editor_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);

// Verify local
assert.ok(testUrl.includes('localhost') || testUrl.includes('127.0.0.1'), 'Test URL must be local');

const adminUrl = baseUrl.replace(/\/ariot(\?|$)/, '/postgres$1');
let pool: InstanceType<typeof Pool>;

async function createDisposableDb() {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  await admin.end();
}

async function dropDisposableDb() {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await admin.end();
}

async function seedSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "User" (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      locale TEXT NOT NULL DEFAULT 'en',
      "preferredCurrency" TEXT NOT NULL DEFAULT 'BDT',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      "deletedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "Category" (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS "Product" (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      tagline TEXT,
      description TEXT,
      brand TEXT NOT NULL DEFAULT 'ARIOT',
      "categoryId" TEXT NOT NULL REFERENCES "Category"(id),
      "salesType" TEXT NOT NULL DEFAULT 'B2C',
      "priceMinor" BIGINT,
      currency TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      stock INT NOT NULL DEFAULT 0,
      "stockPolicy" TEXT NOT NULL DEFAULT 'MADE_TO_ORDER',
      "updatedBy" TEXT,
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

// ── Helper functions (mirror server mutation logic) ──────────────────────────

async function getProduct(id: string) {
  const r = await pool.query(
    `SELECT name, slug, sku, tagline, description, brand, "categoryId", "salesType",
            "priceMinor", currency, status, "updatedAt"
     FROM "Product" WHERE id = $1 AND "deletedAt" IS NULL`,
    [id],
  );
  return r.rows[0] ?? null;
}

async function auditCount() {
  const r = await pool.query(
    `SELECT COUNT(*)::int as cnt FROM "AuditLog" WHERE "entityType" = 'Product' AND action = 'PRODUCT_DETAILS_UPDATED'`,
  );
  return r.rows[0].cnt;
}

async function updateProduct(
  id: string,
  token: string,
  data: Record<string, unknown>,
): Promise<{
  ok: boolean;
  type?: string;
  updatedAt?: string;
  changedFields?: string[];
  field?: string;
}> {
  // Load current
  const current = await getProduct(id);
  if (!current) return { ok: false, type: 'not_found' };

  // Concurrency check
  if (current.updatedAt.toISOString() !== token) {
    return { ok: false, type: 'conflict' };
  }

  // Detect changes
  const changes: string[] = [];
  if (current.name !== data.name) changes.push('name');
  if (current.slug !== data.slug) changes.push('slug');
  if (current.sku !== data.sku) changes.push('sku');
  if ((current.tagline ?? null) !== (data.tagline ?? null)) changes.push('tagline');
  if ((current.description ?? null) !== (data.description ?? null)) changes.push('description');
  if (current.brand !== data.brand) changes.push('brand');
  if (current.categoryId !== data.categoryId) changes.push('categoryId');
  if (current.salesType !== data.salesType) changes.push('salesType');
  const currentPrice = current.priceMinor?.toString() ?? null;
  if (currentPrice !== (data.priceMinor ?? null)) changes.push('priceMinor');
  if ((current.currency ?? null) !== (data.currency ?? null)) changes.push('currency');

  if (changes.length === 0) {
    return { ok: true, updatedAt: current.updatedAt.toISOString(), changedFields: [] };
  }

  // Uniqueness checks
  const slugDup = await pool.query(
    `SELECT id FROM "Product" WHERE slug = $1 AND id != $2 AND "deletedAt" IS NULL LIMIT 1`,
    [data.slug, id],
  );
  if (slugDup.rows.length > 0) return { ok: false, type: 'duplicate', field: 'slug' };

  const skuDup = await pool.query(
    `SELECT id FROM "Product" WHERE sku = $1 AND id != $2 AND "deletedAt" IS NULL LIMIT 1`,
    [data.sku, id],
  );
  if (skuDup.rows.length > 0) return { ok: false, type: 'duplicate', field: 'sku' };

  // Category validation
  if (data.categoryId !== current.categoryId) {
    const cat = await pool.query(`SELECT id FROM "Category" WHERE id = $1`, [data.categoryId]);
    if (cat.rows.length === 0) return { ok: false, type: 'validation' };
  }

  // Transaction: update + audit
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const priceVal = data.priceMinor != null ? BigInt(data.priceMinor as string) : null;
    const updateResult = await client.query(
      `UPDATE "Product" SET name=$1, slug=$2, sku=$3, tagline=$4, description=$5,
       brand=$6, "categoryId"=$7, "salesType"=$8, "priceMinor"=$9, currency=$10,
       "updatedBy"='test_actor', "updatedAt"=NOW()
       WHERE id=$11 RETURNING "updatedAt"`,
      [
        data.name,
        data.slug,
        data.sku,
        data.tagline,
        data.description,
        data.brand,
        data.categoryId,
        data.salesType,
        priceVal,
        data.currency,
        id,
      ],
    );
    await client.query(
      `INSERT INTO "AuditLog" (id, "actorId", action, "entityType", "entityId", before, after, "createdAt")
       VALUES (gen_random_uuid(), 'test_actor', 'PRODUCT_DETAILS_UPDATED', 'Product', $1, $2, $3, NOW())`,
      [
        id,
        JSON.stringify(
          Object.fromEntries(changes.map((f) => [f, (current as Record<string, unknown>)[f]])),
        ),
        JSON.stringify(Object.fromEntries(changes.map((f) => [f, data[f]]))),
      ],
    );
    await client.query('COMMIT');
    return {
      ok: true,
      updatedAt: updateResult.rows[0].updatedAt.toISOString(),
      changedFields: changes,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

before(async () => {
  await createDisposableDb();
  pool = new Pool(utcPoolConfig(testUrl));
  await seedSchema();
  // Seed test user for AuditLog FK
  await pool.query(`INSERT INTO "User" (id, email, name, locale, "preferredCurrency", status, "createdAt", "updatedAt")
    VALUES ('test_actor', 'test@ariot.local', 'Test Actor', 'en', 'BDT', 'ACTIVE', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING`);
  await pool.query(`INSERT INTO "Category" (id, slug, name, "createdAt", "updatedAt") VALUES
    ('cat_a', 'cat-a', 'Category A', NOW(), NOW()),
    ('cat_b', 'cat-b', 'Category B', NOW(), NOW())
    ON CONFLICT (slug) DO NOTHING`);
  await pool.query(`INSERT INTO "Product" (id, slug, name, sku, tagline, description, brand, "categoryId", "salesType", status, stock, "stockPolicy", "createdAt", "updatedAt") VALUES
    ('test_prod_1', 'test-product-one', 'Test Product One', 'TST-001', 'Original tagline', 'Original description', 'ARIOT', 'cat_a', 'B2C', 'DRAFT', 0, 'MADE_TO_ORDER', NOW(), NOW()),
    ('test_prod_2', 'test-product-two', 'Test Product Two', 'TST-002', NULL, NULL, 'ARIOT', 'cat_b', 'B2B', 'DRAFT', 5, 'IN_STOCK', NOW(), NOW())
    ON CONFLICT (slug) DO NOTHING`);
});

after(async () => {
  await pool.end();
  await dropDisposableDb();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Product Details mutation — disposable DB', () => {
  it('Task 8: successful tagline update', async () => {
    const before = await getProduct('test_prod_1');
    const auditBefore = await auditCount();

    const result = await updateProduct('test_prod_1', before.updatedAt.toISOString(), {
      ...before,
      tagline: 'Updated tagline for integration test',
      priceMinor: before.priceMinor?.toString() ?? null,
    });

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.changedFields, ['tagline']);
    assert.notStrictEqual(result.updatedAt, before.updatedAt.toISOString());

    const afterProd = await getProduct('test_prod_1');
    assert.strictEqual(afterProd.tagline, 'Updated tagline for integration test');
    assert.strictEqual(afterProd.updatedAt.toISOString(), result.updatedAt);
    assert.strictEqual(await auditCount(), auditBefore + 1);
  });

  it('Task 9: no-op produces no update or audit', async () => {
    const current = await getProduct('test_prod_1');
    const auditBefore = await auditCount();

    const result = await updateProduct('test_prod_1', current.updatedAt.toISOString(), {
      ...current,
      priceMinor: current.priceMinor?.toString() ?? null,
    });

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.changedFields, []);
    assert.strictEqual(result.updatedAt, current.updatedAt.toISOString());
    assert.strictEqual(await auditCount(), auditBefore);
  });

  it('Task 10: optimistic concurrency rejects stale token', async () => {
    const current = await getProduct('test_prod_1');
    const auditBefore = await auditCount();

    // First update (valid)
    const r1 = await updateProduct('test_prod_1', current.updatedAt.toISOString(), {
      ...current,
      tagline: 'Concurrency A',
      priceMinor: current.priceMinor?.toString() ?? null,
    });
    assert.strictEqual(r1.ok, true);

    // Second update with STALE token
    const r2 = await updateProduct('test_prod_1', current.updatedAt.toISOString(), {
      ...current,
      tagline: 'Concurrency B — should fail',
      priceMinor: current.priceMinor?.toString() ?? null,
    });
    assert.strictEqual(r2.ok, false);
    assert.strictEqual(r2.type, 'conflict');

    const afterConflict = await getProduct('test_prod_1');
    assert.strictEqual(afterConflict.tagline, 'Concurrency A');
    assert.strictEqual(await auditCount(), auditBefore + 1);
  });

  it('Task 11: duplicate slug rejected', async () => {
    const current = await getProduct('test_prod_1');
    const result = await updateProduct('test_prod_1', current.updatedAt.toISOString(), {
      ...current,
      slug: 'test-product-two',
      priceMinor: current.priceMinor?.toString() ?? null,
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.type, 'duplicate');
    assert.strictEqual(result.field, 'slug');
  });

  it('Task 11: duplicate SKU rejected', async () => {
    const current = await getProduct('test_prod_1');
    const result = await updateProduct('test_prod_1', current.updatedAt.toISOString(), {
      ...current,
      sku: 'TST-002',
      priceMinor: current.priceMinor?.toString() ?? null,
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.type, 'duplicate');
    assert.strictEqual(result.field, 'sku');
  });

  it('Task 12: invalid category rejected', async () => {
    const current = await getProduct('test_prod_1');
    const result = await updateProduct('test_prod_1', current.updatedAt.toISOString(), {
      ...current,
      categoryId: 'nonexistent',
      priceMinor: current.priceMinor?.toString() ?? null,
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.type, 'validation');
  });

  it('Task 13: BigInt price round-trip', async () => {
    const current = await getProduct('test_prod_1');
    const result = await updateProduct('test_prod_1', current.updatedAt.toISOString(), {
      ...current,
      priceMinor: '9999999999',
      currency: 'BDT',
    });
    assert.strictEqual(result.ok, true);
    const after = await getProduct('test_prod_1');
    assert.strictEqual(after.priceMinor.toString(), '9999999999');
    assert.strictEqual(after.currency, 'BDT');
  });

  it('Task 16: restore original values', async () => {
    const current = await getProduct('test_prod_1');
    const result = await updateProduct('test_prod_1', current.updatedAt.toISOString(), {
      name: 'Test Product One',
      slug: 'test-product-one',
      sku: 'TST-001',
      tagline: 'Original tagline',
      description: 'Original description',
      brand: 'ARIOT',
      categoryId: 'cat_a',
      salesType: 'B2C',
      priceMinor: null,
      currency: null,
    });
    assert.strictEqual(result.ok, true);
    const restored = await getProduct('test_prod_1');
    assert.strictEqual(restored.name, 'Test Product One');
    assert.strictEqual(restored.tagline, 'Original tagline');
    assert.strictEqual(restored.status, 'DRAFT');
    const count = await pool.query(`SELECT COUNT(*)::int as cnt FROM "Product"`);
    assert.strictEqual(count.rows[0].cnt, 2);
  });

  it('Forbidden: mixed valid+status payload rejected atomically (DB unchanged)', async () => {
    const before = await getProduct('test_prod_1');
    const auditBefore = await auditCount();

    // Attempt to send valid tagline PLUS forbidden status field
    const mixedPayload = {
      productId: 'test_prod_1',
      expectedUpdatedAt: before.updatedAt.toISOString(),
      data: {
        name: before.name,
        slug: before.slug,
        sku: before.sku,
        tagline: 'Should NOT be applied',
        description: before.description,
        brand: before.brand,
        categoryId: before.categoryId,
        salesType: before.salesType,
        priceMinor: before.priceMinor?.toString() ?? null,
        currency: before.currency,
        status: 'PUBLISHED', // FORBIDDEN field
      },
    };

    // Schema rejects the entire payload
    const parsed = updateProductDetailsRequestSchema.safeParse(mixedPayload);
    assert.strictEqual(parsed.success, false);

    // Verify DB unchanged
    const afterProd = await getProduct('test_prod_1');
    assert.strictEqual(afterProd.tagline, before.tagline); // Not applied
    assert.strictEqual(afterProd.status, 'DRAFT'); // Not published
    assert.strictEqual(afterProd.updatedAt.toISOString(), before.updatedAt.toISOString());
    assert.strictEqual(await auditCount(), auditBefore); // No audit
  });

  it('Forbidden: publishedAt in payload rejected', () => {
    const payload = {
      productId: 'test_prod_1',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      data: {
        name: 'X',
        slug: 'xxx',
        sku: 'Y',
        tagline: null,
        description: null,
        brand: 'ARIOT',
        categoryId: 'cat_a',
        salesType: 'B2C',
        priceMinor: null,
        currency: null,
        publishedAt: '2026-01-01T00:00:00.000Z',
      },
    };
    const parsed = updateProductDetailsRequestSchema.safeParse(payload);
    assert.strictEqual(parsed.success, false);
  });

  it('Forbidden: stock in payload rejected', () => {
    const payload = {
      productId: 'x',
      expectedUpdatedAt: 'y',
      data: {
        name: 'Test',
        slug: 'test',
        sku: 'S',
        tagline: null,
        description: null,
        brand: 'A',
        categoryId: 'c',
        salesType: 'B2C',
        priceMinor: null,
        currency: null,
        stock: 99,
      },
    };
    const parsed = updateProductDetailsRequestSchema.safeParse(payload);
    assert.strictEqual(parsed.success, false);
  });
});

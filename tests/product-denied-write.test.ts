/**
 * tests/product-denied-write.test.ts — Step 2.4.3 denied-write integration.
 *
 * Proves that the shared authorization orchestration (createAuthorizedProductDetailsUpdater)
 * blocks a database write when the actor holds only products.read.
 *
 * Uses a disposable local PostgreSQL database (ariot_auth_denial_test).
 * Does NOT touch the primary ariot database.
 *
 * Run:
 *   node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/product-denied-write.test.ts
 */

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { utcPoolConfig } from '../server/db-timezone.ts';
import {
  createAuthorizedProductDetailsUpdater,
  type ExecuteUpdateFn,
} from '../server/admin/products/authorized-product-update.ts';
import { hasPermission, PERMISSIONS } from '../server/auth/permission-catalog.ts';
import { AuthorizationError } from '../server/auth/errors.ts';

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
const TEST_DB_NAME = 'ariot_auth_denial_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);

// Verify local only
assert.ok(testUrl.includes('localhost') || testUrl.includes('127.0.0.1'), 'Test URL must be local');

// ── Disposable database lifecycle ────────────────────────────────────────────

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
  // Minimal schema for the test — matches the relevant Prisma models
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

async function seedTestData() {
  await pool.query(`
    INSERT INTO "User" (id, email, name) VALUES
      ('reader_actor', 'reader@ariot.local', 'Reader'),
      ('admin_actor', 'admin@ariot.local', 'Admin')
    ON CONFLICT DO NOTHING;

    INSERT INTO "Category" (id, slug, name) VALUES
      ('deny_cat', 'denial-cat', 'Denial Category')
    ON CONFLICT DO NOTHING;

    INSERT INTO "Product" (id, slug, name, sku, tagline, brand, "categoryId", "salesType")
    VALUES ('deny_prod', 'denial-product', 'Denial Test Product', 'DENY-001',
            'Original tagline', 'ARIOT', 'deny_cat', 'B2C')
    ON CONFLICT DO NOTHING;
  `);
}

// ── Real DB executor (mirrors production mutation logic) ──────────────────────

let executorCallCount = 0;

function createRealDbExecutor(): ExecuteUpdateFn {
  return async (rawInput, actor) => {
    executorCallCount++;
    const input = rawInput as {
      productId: string;
      expectedUpdatedAt: string;
      data: Record<string, unknown>;
    };

    const { productId, expectedUpdatedAt, data } = input;

    // Load current
    const current = await pool.query(
      `SELECT name, slug, sku, tagline, description, brand, "categoryId",
              "salesType", "priceMinor", currency, "updatedAt"
       FROM "Product" WHERE id = $1 AND "deletedAt" IS NULL`,
      [productId],
    );
    if (current.rows.length === 0) {
      return { ok: false, type: 'not_found', message: 'Product not found.' };
    }

    const row = current.rows[0];

    // Concurrency check
    if (row.updatedAt.toISOString() !== expectedUpdatedAt) {
      return { ok: false, type: 'conflict', message: 'Stale token.' };
    }

    // Detect changes
    const changes: string[] = [];
    if (row.name !== data.name) changes.push('name');
    if (row.slug !== data.slug) changes.push('slug');
    if (row.sku !== data.sku) changes.push('sku');
    if ((row.tagline ?? null) !== (data.tagline ?? null)) changes.push('tagline');
    if ((row.description ?? null) !== (data.description ?? null)) changes.push('description');
    if (row.brand !== data.brand) changes.push('brand');
    if (row.categoryId !== data.categoryId) changes.push('categoryId');
    if (row.salesType !== data.salesType) changes.push('salesType');
    const currentPrice = row.priceMinor?.toString() ?? null;
    if (currentPrice !== (data.priceMinor ?? null)) changes.push('priceMinor');
    if ((row.currency ?? null) !== (data.currency ?? null)) changes.push('currency');

    if (changes.length === 0) {
      return { ok: true, updatedAt: row.updatedAt.toISOString(), changedFields: [] };
    }

    // Transaction: update + audit
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const priceVal = data.priceMinor != null ? BigInt(data.priceMinor as string) : null;
      const updateResult = await client.query(
        `UPDATE "Product" SET name=$1, slug=$2, sku=$3, tagline=$4, description=$5,
         brand=$6, "categoryId"=$7, "salesType"=$8, "priceMinor"=$9, currency=$10,
         "updatedBy"=$11, "updatedAt"=NOW()
         WHERE id=$12 RETURNING "updatedAt"`,
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
          actor.userId,
          productId,
        ],
      );
      await client.query(
        `INSERT INTO "AuditLog" (id, "actorId", action, "entityType", "entityId", before, after, "createdAt")
         VALUES (gen_random_uuid(), $1, 'PRODUCT_DETAILS_UPDATED', 'Product', $2, $3, $4, NOW())`,
        [
          actor.userId,
          productId,
          JSON.stringify(
            Object.fromEntries(changes.map((f) => [f, (row as Record<string, unknown>)[f]])),
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
  };
}

// ── Authorize functions (mirror requirePermission behavior) ──────────────────

function createAuthorize(grantedPermissions: readonly string[], actorId: string) {
  return async () => {
    if (!hasPermission(grantedPermissions, PERMISSIONS.products.write)) {
      throw new AuthorizationError();
    }
    return { userId: actorId, roles: ['CONTENT_ADMIN'] as string[] };
  };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

before(async () => {
  await createDisposableDb();
  pool = new Pool(utcPoolConfig(testUrl));
  await seedSchema();
  await seedTestData();
});

after(async () => {
  await pool.end();
  await dropDisposableDb();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Denied-write database integration (shared orchestration)', () => {
  it('products.read-only denies update — Product and AuditLog unchanged', async () => {
    executorCallCount = 0;

    // Capture state before
    const beforeProd = await pool.query(
      `SELECT name, tagline, "updatedAt" FROM "Product" WHERE id = 'deny_prod'`,
    );
    const beforeAudit = await pool.query(`SELECT COUNT(*)::int as cnt FROM "AuditLog"`);
    const beforeProdCount = await pool.query(`SELECT COUNT(*)::int as cnt FROM "Product"`);

    const originalUpdatedAt = beforeProd.rows[0].updatedAt.toISOString();
    const originalTagline = beforeProd.rows[0].tagline;

    // Build valid update payload
    const validPayload = {
      productId: 'deny_prod',
      expectedUpdatedAt: originalUpdatedAt,
      data: {
        name: 'Denial Test Product',
        slug: 'denial-product',
        sku: 'DENY-001',
        tagline: 'SHOULD NOT BE APPLIED',
        description: null,
        brand: 'ARIOT',
        categoryId: 'deny_cat',
        salesType: 'B2C',
        priceMinor: null,
        currency: null,
      },
    };

    // Create orchestration with products.read ONLY
    const updater = createAuthorizedProductDetailsUpdater({
      authorize: createAuthorize(['products.read'], 'reader_actor'),
      executeUpdate: createRealDbExecutor(),
    });

    const result = await updater(validPayload);

    // Authorization denied
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.type, 'forbidden');
      const msg = 'message' in result ? result.message : '';
      assert.strictEqual(msg, 'Insufficient permissions.');
      // No raw security or database error
      assert.ok(!String(msg).includes('P2002'));
      assert.ok(!String(msg).includes('SQL'));
      assert.ok(!String(msg).includes('stack'));
    }

    // Executor never called
    assert.strictEqual(executorCallCount, 0);

    // Product field unchanged
    const afterProd = await pool.query(
      `SELECT name, tagline, "updatedAt" FROM "Product" WHERE id = 'deny_prod'`,
    );
    assert.strictEqual(afterProd.rows[0].tagline, originalTagline);
    assert.strictEqual(afterProd.rows[0].updatedAt.toISOString(), originalUpdatedAt);

    // AuditLog count unchanged
    const afterAudit = await pool.query(`SELECT COUNT(*)::int as cnt FROM "AuditLog"`);
    assert.strictEqual(afterAudit.rows[0].cnt, beforeAudit.rows[0].cnt);

    // Product row count unchanged
    const afterProdCount = await pool.query(`SELECT COUNT(*)::int as cnt FROM "Product"`);
    assert.strictEqual(afterProdCount.rows[0].cnt, beforeProdCount.rows[0].cnt);
  });

  it('empty permissions deny update — no transaction performed', async () => {
    executorCallCount = 0;

    const beforeProd = await pool.query(
      `SELECT tagline, "updatedAt" FROM "Product" WHERE id = 'deny_prod'`,
    );
    const originalUpdatedAt = beforeProd.rows[0].updatedAt.toISOString();

    const validPayload = {
      productId: 'deny_prod',
      expectedUpdatedAt: originalUpdatedAt,
      data: {
        name: 'Denial Test Product',
        slug: 'denial-product',
        sku: 'DENY-001',
        tagline: 'EMPTY PERMS ATTEMPT',
        description: null,
        brand: 'ARIOT',
        categoryId: 'deny_cat',
        salesType: 'B2C',
        priceMinor: null,
        currency: null,
      },
    };

    const updater = createAuthorizedProductDetailsUpdater({
      authorize: createAuthorize([], 'reader_actor'),
      executeUpdate: createRealDbExecutor(),
    });

    const result = await updater(validPayload);
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'forbidden');
    assert.strictEqual(executorCallCount, 0);

    const afterProd = await pool.query(
      `SELECT tagline, "updatedAt" FROM "Product" WHERE id = 'deny_prod'`,
    );
    assert.strictEqual(afterProd.rows[0].updatedAt.toISOString(), originalUpdatedAt);
  });

  it('products.* denied — no database change', async () => {
    executorCallCount = 0;

    const beforeProd = await pool.query(
      `SELECT tagline, "updatedAt" FROM "Product" WHERE id = 'deny_prod'`,
    );
    const originalUpdatedAt = beforeProd.rows[0].updatedAt.toISOString();

    const validPayload = {
      productId: 'deny_prod',
      expectedUpdatedAt: originalUpdatedAt,
      data: {
        name: 'Denial Test Product',
        slug: 'denial-product',
        sku: 'DENY-001',
        tagline: 'NAMESPACE WILDCARD ATTEMPT',
        description: null,
        brand: 'ARIOT',
        categoryId: 'deny_cat',
        salesType: 'B2C',
        priceMinor: null,
        currency: null,
      },
    };

    const updater = createAuthorizedProductDetailsUpdater({
      authorize: createAuthorize(['products.*'], 'reader_actor'),
      executeUpdate: createRealDbExecutor(),
    });

    const result = await updater(validPayload);
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'forbidden');
    assert.strictEqual(executorCallCount, 0);

    const afterProd = await pool.query(
      `SELECT tagline, "updatedAt" FROM "Product" WHERE id = 'deny_prod'`,
    );
    assert.strictEqual(afterProd.rows[0].updatedAt.toISOString(), originalUpdatedAt);
  });

  it('global "*" permits valid update — proves approved path works', async () => {
    executorCallCount = 0;

    const beforeProd = await pool.query(
      `SELECT tagline, "updatedAt" FROM "Product" WHERE id = 'deny_prod'`,
    );
    const originalUpdatedAt = beforeProd.rows[0].updatedAt.toISOString();
    const originalTagline = beforeProd.rows[0].tagline;
    const beforeAudit = await pool.query(`SELECT COUNT(*)::int as cnt FROM "AuditLog"`);

    const validPayload = {
      productId: 'deny_prod',
      expectedUpdatedAt: originalUpdatedAt,
      data: {
        name: 'Denial Test Product',
        slug: 'denial-product',
        sku: 'DENY-001',
        tagline: 'Updated by global wildcard',
        description: null,
        brand: 'ARIOT',
        categoryId: 'deny_cat',
        salesType: 'B2C',
        priceMinor: null,
        currency: null,
      },
    };

    const updater = createAuthorizedProductDetailsUpdater({
      authorize: createAuthorize(['*'], 'admin_actor'),
      executeUpdate: createRealDbExecutor(),
    });

    const result = await updater(validPayload);

    // Authorized + executed
    assert.strictEqual(result.ok, true);
    assert.strictEqual(executorCallCount, 1);

    // Database changed
    const afterProd = await pool.query(
      `SELECT tagline, "updatedAt" FROM "Product" WHERE id = 'deny_prod'`,
    );
    assert.strictEqual(afterProd.rows[0].tagline, 'Updated by global wildcard');
    assert.notStrictEqual(afterProd.rows[0].updatedAt.toISOString(), originalUpdatedAt);

    // AuditLog increased
    const afterAudit = await pool.query(`SELECT COUNT(*)::int as cnt FROM "AuditLog"`);
    assert.strictEqual(afterAudit.rows[0].cnt, beforeAudit.rows[0].cnt + 1);

    // Restore original value through approved path
    const currentAfter = await pool.query(
      `SELECT "updatedAt" FROM "Product" WHERE id = 'deny_prod'`,
    );
    const restorePayload = {
      productId: 'deny_prod',
      expectedUpdatedAt: currentAfter.rows[0].updatedAt.toISOString(),
      data: {
        name: 'Denial Test Product',
        slug: 'denial-product',
        sku: 'DENY-001',
        tagline: originalTagline,
        description: null,
        brand: 'ARIOT',
        categoryId: 'deny_cat',
        salesType: 'B2C',
        priceMinor: null,
        currency: null,
      },
    };

    const restoreUpdater = createAuthorizedProductDetailsUpdater({
      authorize: createAuthorize(['*'], 'admin_actor'),
      executeUpdate: createRealDbExecutor(),
    });
    const restoreResult = await restoreUpdater(restorePayload);
    assert.strictEqual(restoreResult.ok, true);

    const restored = await pool.query(`SELECT tagline FROM "Product" WHERE id = 'deny_prod'`);
    assert.strictEqual(restored.rows[0].tagline, originalTagline);
  });
});

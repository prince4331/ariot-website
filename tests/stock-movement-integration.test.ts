/**
 * tests/stock-movement-integration.test.ts — Step 2.4.6A3 (StockMovement ledger)
 * Immutable stock-movement history against a disposable PostgreSQL database.
 *
 * Executes the REAL production inventory executors (`adjustInventoryWithContext`
 * + `listStockMovementsWithContext`) through the shared authorization boundary.
 * Every successful adjustment must write one immutable `StockMovement` row inside
 * the same transaction as the stock update and the AuditLog row (D-075).
 *
 * Run (Node 24 native TS + alias/extensionless resolver):
 *   node --import ./tests/helpers/register-hooks.mjs
 *        --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
 *        --test tests/stock-movement-integration.test.ts
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

import { utcPoolConfig } from '@/server/db-timezone';
import type { AuthorizationContext } from '@/server/auth/permissions';
import { AuthorizationError } from '@/server/auth/errors';
import type { InventoryResult } from '@/server/admin/inventory/inventory-helpers';
import type {
  ListStockMovementsParams,
  StockMovementListResult,
} from '@/server/admin/inventory/inventory-schema';

const { Pool, Client } = pg;

function loadEnvVar(key: string): string {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) throw new Error('.env not found');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    if (!line.startsWith(`${key}=`)) continue;
    let val = line.slice(key.length + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    return val;
  }
  throw new Error(`${key} not found in .env`);
}

const baseUrl = loadEnvVar('DATABASE_URL');
const TEST_DB_NAME = 'ariot_stock_movement_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);

assert.ok(testUrl.includes('localhost') || testUrl.includes('127.0.0.1'), 'Test URL must be local');

const adminUrl = baseUrl.replace(/\/ariot(\?|$)/, '/postgres$1');
let pool: InstanceType<typeof Pool>;
// prisma is imported AFTER DATABASE_URL is repointed at the disposable DB.
let prisma: typeof import('@/server/db').prisma;

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
    CREATE TYPE "Currency" AS ENUM ('BDT', 'USD');
    CREATE TYPE "SalesType" AS ENUM ('B2C', 'B2B', 'HYBRID');
    CREATE TYPE "StockPolicy" AS ENUM ('IN_STOCK', 'BACKORDER', 'MADE_TO_ORDER');
    CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
    CREATE TYPE "RoleKey" AS ENUM ('SUPER_ADMIN', 'CONTENT_ADMIN', 'SUPPORT_ADMIN', 'SALES_ADMIN');
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
      "salesType" "SalesType" NOT NULL DEFAULT 'B2C',
      status "ProductStatus" NOT NULL DEFAULT 'DRAFT',
      currency "Currency",
      stock INT NOT NULL DEFAULT 0,
      "stockPolicy" "StockPolicy" NOT NULL DEFAULT 'MADE_TO_ORDER',
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
      currency "Currency",
      stock INT NOT NULL DEFAULT 0,
      barcode TEXT,
      "isDefault" BOOLEAN NOT NULL DEFAULT false,
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
    CREATE TABLE IF NOT EXISTS "StockMovement" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "productId" TEXT NOT NULL,
      "variantId" TEXT,
      "deltaQty" INTEGER NOT NULL,
      "quantityBefore" INTEGER NOT NULL,
      "quantityAfter" INTEGER NOT NULL,
      reason TEXT NOT NULL,
      note TEXT,
      "referenceType" TEXT,
      "referenceId" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdBy" TEXT NOT NULL
    );
    CREATE OR REPLACE FUNCTION "deny_stock_movement_write"() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'StockMovement records are immutable and cannot be updated or deleted.';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER "stock_movement_immutable"
      BEFORE UPDATE OR DELETE ON "StockMovement"
      FOR EACH ROW EXECUTE FUNCTION "deny_stock_movement_write"();
  `);
}

async function seedData() {
  await pool.query(`
    INSERT INTO "Category" (id, slug, name) VALUES ('cat1', 'robots', 'Robots');
    INSERT INTO "Product" (id, slug, name, sku, "categoryId", stock)
    VALUES
      ('prod1', 'base-product', 'Base Product', 'BASE-001', 'cat1', 10),
      ('prod2', 'other-product', 'Other Product', 'OTHER-001', 'cat1', 5);
    INSERT INTO "ProductVariant" (id, "productId", sku, name, "optionValues", stock)
    VALUES ('var1', 'prod2', 'VAR-001', 'Black 12V', '{"color":"Black"}', 7);
  `);
}

async function resetState() {
  await pool.query(
    `TRUNCATE TABLE "ProductVariant", "AuditLog", "StockMovement" RESTART IDENTITY CASCADE`,
  );
  await pool.query(`UPDATE "Product" SET stock = 10 WHERE id = 'prod1'`);
  await pool.query(`UPDATE "Product" SET stock = 5 WHERE id = 'prod2'`);
  await pool.query(
    `INSERT INTO "ProductVariant" (id, "productId", sku, name, "optionValues", stock)
     VALUES ('var1', 'prod2', 'VAR-001', 'Black 12V', '{"color":"Black"}', 7)`,
  );
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function productStock(productId: string): Promise<number> {
  const r = await pool.query(`SELECT stock FROM "Product" WHERE id = $1`, [productId]);
  return r.rows[0].stock;
}

async function variantStock(variantId: string): Promise<number> {
  const r = await pool.query(`SELECT stock FROM "ProductVariant" WHERE id = $1`, [variantId]);
  return r.rows[0].stock;
}

async function countStockMovements(productId?: string): Promise<number> {
  const q = productId
    ? `SELECT COUNT(*)::int as cnt FROM "StockMovement" WHERE "productId" = $1`
    : `SELECT COUNT(*)::int as cnt FROM "StockMovement"`;
  const r = await pool.query(q, productId ? [productId] : []);
  return r.rows[0].cnt;
}

async function latestMovement(productId: string): Promise<Record<string, unknown>> {
  const r = await pool.query(
    `SELECT * FROM "StockMovement" WHERE "productId" = $1 ORDER BY "createdAt" DESC, id DESC LIMIT 1`,
    [productId],
  );
  return r.rows[0];
}

// ── Production executors (dynamically imported AFTER env is set) ─────────────

type Adjust = (ctx: AuthorizationContext, raw: unknown) => Promise<InventoryResult>;
type ListMovements = (
  ctx: AuthorizationContext,
  params?: ListStockMovementsParams,
) => Promise<StockMovementListResult>;

let adjust: Adjust;
let listMovements: ListMovements;

async function loadExecutors(): Promise<void> {
  const adjMod = await import('../server/admin/inventory/adjust-inventory-executor.ts');
  const listMod = await import('../server/admin/inventory/list-movements-executor.ts');
  adjust = adjMod.adjustInventoryWithContext;
  listMovements = listMod.listStockMovementsWithContext;
}

// ── Controlled authorization contexts ────────────────────────────────────────

const superCtx: AuthorizationContext = {
  userId: 'actor1',
  email: 'super@ariot.test',
  roles: ['SUPER_ADMIN'],
  permissions: ['*'],
};

const readerCtx: AuthorizationContext = {
  userId: 'actor2',
  email: 'reader@ariot.test',
  roles: ['CONTENT_ADMIN'],
  permissions: ['inventory.read'],
};

const noneCtx: AuthorizationContext = {
  userId: 'actor4',
  email: 'none@ariot.test',
  roles: [],
  permissions: [],
};

// ── Setup / teardown ─────────────────────────────────────────────────────────

before(async () => {
  await createDb();
  pool = new Pool(utcPoolConfig(testUrl));
  await seedSchema();
  await seedData();

  process.env.DATABASE_URL = testUrl;
  prisma = (await import('@/server/db')).prisma;
  await loadExecutors();
});

beforeEach(async () => {
  await resetState();
});

after(async () => {
  await prisma.$disconnect();
  await pool.end();
  await dropDb();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StockMovement ledger — Step 2.4.6A3', () => {
  it('1. successful product stock adjustment creates a StockMovement', async () => {
    const before = await countStockMovements();
    const result = await adjust(superCtx, {
      productId: 'prod1',
      deltaQty: 5,
      reason: 'Received shipment',
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(await countStockMovements(), before + 1);
    const m = await latestMovement('prod1');
    assert.strictEqual(m.productId, 'prod1');
    assert.strictEqual(m.variantId, null);
  });

  it('2. successful variant stock adjustment creates a StockMovement', async () => {
    const result = await adjust(superCtx, {
      productId: 'prod2',
      variantId: 'var1',
      deltaQty: -2,
      reason: 'Damaged units',
      note: 'spill',
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(await variantStock('var1'), 5);
    const m = await latestMovement('prod2');
    assert.strictEqual(m.productId, 'prod2');
    assert.strictEqual(m.variantId, 'var1');
    assert.strictEqual(m.note, 'spill');
  });

  it('3. quantityBefore is the stock prior to the adjustment', async () => {
    await adjust(superCtx, { productId: 'prod1', deltaQty: 5, reason: 'r' });
    const m = await latestMovement('prod1');
    assert.strictEqual(m.quantityBefore, 10);
  });

  it('4. quantityAfter is the stock after the adjustment', async () => {
    await adjust(superCtx, { productId: 'prod1', deltaQty: 5, reason: 'r' });
    const m = await latestMovement('prod1');
    assert.strictEqual(m.quantityAfter, 15);
    assert.strictEqual(await productStock('prod1'), 15);
  });

  it('5. deltaQty is recorded exactly', async () => {
    await adjust(superCtx, { productId: 'prod1', deltaQty: 5, reason: 'r' });
    const m = await latestMovement('prod1');
    assert.strictEqual(m.deltaQty, 5);
  });

  it('6. negative resulting stock is rejected — no StockMovement, no write', async () => {
    const before = await countStockMovements();
    const result = await adjust(superCtx, {
      productId: 'prod1',
      deltaQty: -20,
      reason: 'Shrinkage',
    });
    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.type, 'negative_stock');
    assert.strictEqual(await countStockMovements(), before);
    assert.strictEqual(await productStock('prod1'), 10);
  });

  it('7. failed adjustment (forbidden) creates no StockMovement', async () => {
    const before = await countStockMovements();
    await assert.rejects(
      () => adjust(readerCtx, { productId: 'prod1', deltaQty: 1, reason: 'r' }),
      AuthorizationError,
    );
    assert.strictEqual(await countStockMovements(), before);
  });

  it('8. failed adjustment (validation: missing reason) creates no AuditLog and no StockMovement', async () => {
    const movesBefore = await countStockMovements();
    const result = await adjust(superCtx, {
      productId: 'prod1',
      deltaQty: 1,
      // reason omitted
    } as unknown);
    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.type, 'validation');
    assert.strictEqual(await countStockMovements(), movesBefore);
    assert.strictEqual(await productStock('prod1'), 10);
  });

  it('9. concurrent adjustments preserve quantity (no lost updates)', async () => {
    const [a, b] = await Promise.all([
      adjust(superCtx, { productId: 'prod1', deltaQty: 10, reason: 'a' }),
      adjust(superCtx, { productId: 'prod1', deltaQty: 20, reason: 'b' }),
    ]);
    assert.strictEqual(a.ok, true);
    assert.strictEqual(b.ok, true);
    // 10 + 10 + 20 = 40 (NOT 20 or 30).
    assert.strictEqual(await productStock('prod1'), 40);
    assert.strictEqual(await countStockMovements('prod1'), 2);
  });

  it('10. StockMovement cannot be modified (immutable ledger)', async () => {
    await adjust(superCtx, { productId: 'prod1', deltaQty: 7, reason: 'cycle count' });
    const m = await latestMovement('prod1');
    const id = m.id as string;

    // UPDATE is blocked by the DB trigger.
    await assert.rejects(() =>
      prisma.stockMovement.update({ where: { id }, data: { deltaQty: 999 } }),
    );
    // DELETE is blocked by the DB trigger.
    await assert.rejects(() => prisma.stockMovement.delete({ where: { id } }));

    // Value is unchanged.
    const after = await pool.query(`SELECT "deltaQty" FROM "StockMovement" WHERE id = $1`, [id]);
    assert.strictEqual(Number(after.rows[0].deltaQty), 7);
  });

  it('11. unauthorized user (no inventory.adjust) cannot create a movement', async () => {
    const before = await countStockMovements();
    await assert.rejects(
      () => adjust(noneCtx, { productId: 'prod1', deltaQty: 1, reason: 'r' }),
      AuthorizationError,
    );
    assert.strictEqual(await countStockMovements(), before);
  });

  it('12. read-only user (inventory.read only) cannot adjust', async () => {
    const before = await countStockMovements();
    await assert.rejects(
      () => adjust(readerCtx, { productId: 'prod1', deltaQty: 1, reason: 'r' }),
      AuthorizationError,
    );
    assert.strictEqual(await countStockMovements(), before);
  });

  it('13. archived/deleted product: adjustment rejected, history preserved', async () => {
    await adjust(superCtx, { productId: 'prod1', deltaQty: 5, reason: 'initial' });
    assert.strictEqual(await countStockMovements('prod1'), 1);

    // Archive the product (soft delete).
    await pool.query(`UPDATE "Product" SET "deletedAt" = NOW() WHERE id = 'prod1'`);

    // Further adjustment is rejected (authoritative row not found).
    const result = await adjust(superCtx, {
      productId: 'prod1',
      deltaQty: 3,
      reason: 'after archive',
    });
    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.type, 'not_found');
    assert.strictEqual(await countStockMovements('prod1'), 1);

    // History is still readable.
    const history = await listMovements(superCtx, { productId: 'prod1' });
    assert.strictEqual(history.rows.length, 1);
    assert.strictEqual(history.rows[0].deltaQty, 5);
  });
});

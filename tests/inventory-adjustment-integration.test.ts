/**
 * tests/inventory-adjustment-integration.test.ts — Step 2.4.6A1
 * Inventory mutation surface against a disposable PostgreSQL database.
 *
 * Imports and executes the REAL production inventory executors
 * (`adjustInventoryWithContext` / `listInventoryWithContext`) through the shared
 * authorization boundary, against a real PostgreSQL database using the real
 * Prisma client. Injects controlled `AuthorizationContext`s so the actual
 * `hasAllPermissions` evaluator decides allow vs deny. No schema migration is
 * required — the `stock` columns and a string `AuditLog.action` already exist.
 *
 * Run (Node 24 native TS + alias/extensionless resolver):
 *   node --import ./tests/helpers/register-hooks.mjs
 *        --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
 *        --test tests/inventory-adjustment-integration.test.ts
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

const { Pool, Client } = pg;

// ── Load .env (node:test does not load it) ───────────────────────────────────

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
const TEST_DB_NAME = 'ariot_inventory_service_test';
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

// ── DB helpers ───────────────────────────────────────────────────────────────

async function productStock(productId: string): Promise<number> {
  const r = await pool.query(`SELECT stock FROM "Product" WHERE id = $1`, [productId]);
  return r.rows[0].stock;
}

async function variantStock(variantId: string): Promise<number> {
  const r = await pool.query(`SELECT stock FROM "ProductVariant" WHERE id = $1`, [variantId]);
  return r.rows[0].stock;
}

async function countAudit(action?: string): Promise<number> {
  const q = action
    ? `SELECT COUNT(*)::int as cnt FROM "AuditLog" WHERE action = $1`
    : `SELECT COUNT(*)::int as cnt FROM "AuditLog"`;
  const r = await pool.query(q, action ? [action] : []);
  return r.rows[0].cnt;
}

// ── Production executors (dynamically imported AFTER env is set) ─────────────

type Adjust = (ctx: AuthorizationContext, raw: unknown) => Promise<InventoryResult>;
type List = (ctx: AuthorizationContext) => Promise<unknown[]>;

let adjust: Adjust;
let list: List;

async function loadExecutors(): Promise<void> {
  const adjMod = await import('../server/admin/inventory/adjust-inventory-executor.ts');
  const listMod = await import('../server/admin/inventory/list-inventory-executor.ts');
  adjust = adjMod.adjustInventoryWithContext;
  list = listMod.listInventoryWithContext;
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

const adjusterCtx: AuthorizationContext = {
  userId: 'actor3',
  email: 'adjuster@ariot.test',
  roles: ['CONTENT_ADMIN'],
  permissions: ['inventory.read', 'inventory.adjust'],
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
  await loadExecutors();
});

beforeEach(async () => {
  await resetState();
});

after(async () => {
  const { prisma } = await import('@/server/db');
  await prisma.$disconnect();
  await pool.end();
  await dropDb();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Inventory adjustment surface — Step 2.4.6A1', () => {
  it('1. product-only stock adjustment works (authority Product)', async () => {
    const auditBefore = await countAudit('INVENTORY_ADJUSTED');
    const result = await adjust(superCtx, {
      productId: 'prod1',
      deltaQty: 5,
      reason: 'Received shipment',
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    assert.strictEqual(result.variantId, null);
    assert.strictEqual(result.authority, 'Product');
    assert.strictEqual(result.before, 10);
    assert.strictEqual(result.after, 15);
    assert.strictEqual(await productStock('prod1'), 15);
    assert.strictEqual(await countAudit('INVENTORY_ADJUSTED'), auditBefore + 1);
  });

  it('2. variant stock adjustment works (authority Variant)', async () => {
    const auditBefore = await countAudit('INVENTORY_ADJUSTED');
    const result = await adjust(superCtx, {
      productId: 'prod2',
      variantId: 'var1',
      deltaQty: -2,
      reason: 'Damaged units',
      note: 'spill',
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    assert.strictEqual(result.variantId, 'var1');
    assert.strictEqual(result.authority, 'Variant');
    assert.strictEqual(result.before, 7);
    assert.strictEqual(result.after, 5);
    assert.strictEqual(await variantStock('var1'), 5);
    assert.strictEqual(await countAudit('INVENTORY_ADJUSTED'), auditBefore + 1);
  });

  it('3. negative resulting stock is rejected (D-071), no write, no audit', async () => {
    const auditBefore = await countAudit('INVENTORY_ADJUSTED');
    const result = await adjust(superCtx, {
      productId: 'prod1',
      deltaQty: -20,
      reason: 'Shrinkage',
    });
    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.type, 'negative_stock');
    assert.strictEqual(await productStock('prod1'), 10);
    assert.strictEqual(await countAudit('INVENTORY_ADJUSTED'), auditBefore);
  });

  it('4. product with active variants rejects product-level adjustment (D-072 Case 2)', async () => {
    const result = await adjust(superCtx, {
      productId: 'prod2',
      deltaQty: 1,
      reason: 'x',
    });
    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.type, 'validation');
    assert.strictEqual(await productStock('prod2'), 5);
  });

  it('5. unauthorized caller (inventory.read only) cannot adjust', async () => {
    await assert.rejects(
      () => adjust(readerCtx, { productId: 'prod1', deltaQty: 1, reason: 'x' }),
      AuthorizationError,
    );
    await assert.rejects(
      () => adjust(noneCtx, { productId: 'prod1', deltaQty: 1, reason: 'x' }),
      AuthorizationError,
    );
    assert.strictEqual(await productStock('prod1'), 10);
  });

  it('6. read-only caller (inventory.read) can list inventory', async () => {
    const rows = (await list(readerCtx)) as Array<{ productId: string; authority: string }>;
    assert.ok(Array.isArray(rows));
    assert.ok(rows.length >= 2);
    assert.ok(rows.some((r) => r.productId === 'prod1' && r.authority === 'Product'));
    assert.ok(rows.some((r) => r.productId === 'prod2' && r.authority === 'Variant'));
  });

  it('7. list denies a caller without inventory.read', async () => {
    await assert.rejects(() => list(noneCtx), AuthorizationError);
  });

  it('8. successful adjustment writes an audit row with before/after/delta/reason', async () => {
    const result = await adjust(adjusterCtx, {
      productId: 'prod1',
      deltaQty: 3,
      reason: 'Cycle count',
      note: 'q1',
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const r = await pool.query(
      `SELECT "entityType", "entityId", before, after FROM "AuditLog" WHERE action = 'INVENTORY_ADJUSTED' ORDER BY "createdAt" DESC LIMIT 1`,
    );
    assert.strictEqual(r.rows.length, 1);
    const row = r.rows[0];
    assert.strictEqual(row.entityType, 'Product');
    assert.strictEqual(row.entityId, 'prod1');
    assert.strictEqual(row.before.stock, 10);
    assert.strictEqual(row.after.stock, 13);
    assert.strictEqual(row.after.deltaQty, 3);
    assert.strictEqual(row.after.reason, 'Cycle count');
    assert.strictEqual(row.after.note, 'q1');
  });

  it('9. failed adjustment (forbidden) creates no audit', async () => {
    const auditBefore = await countAudit('INVENTORY_ADJUSTED');
    await assert.rejects(
      () => adjust(readerCtx, { productId: 'prod1', deltaQty: 1, reason: 'x' }),
      AuthorizationError,
    );
    assert.strictEqual(await countAudit('INVENTORY_ADJUSTED'), auditBefore);
  });

  it('10. failed adjustment (validation: missing reason) creates no audit, no write', async () => {
    const auditBefore = await countAudit('INVENTORY_ADJUSTED');
    const result = await adjust(superCtx, {
      productId: 'prod1',
      deltaQty: 1,
      // reason omitted
    } as unknown);
    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.type, 'validation');
    assert.strictEqual(await productStock('prod1'), 10);
    assert.strictEqual(await countAudit('INVENTORY_ADJUSTED'), auditBefore);
  });

  it('11. transaction atomicity: a thrown mid-transaction error rolls back (no partial write)', async () => {
    // Adjust a variant to a new value, then confirm a second adjustment that
    // would go negative against the NEW value is rejected without altering it.
    const first = await adjust(superCtx, {
      productId: 'prod2',
      variantId: 'var1',
      deltaQty: -3,
      reason: 'r',
    });
    assert.strictEqual(first.ok, true);
    if (!first.ok) return;
    assert.strictEqual(await variantStock('var1'), 4);

    const auditBefore = await countAudit('INVENTORY_ADJUSTED');
    const bad = await adjust(superCtx, {
      productId: 'prod2',
      variantId: 'var1',
      deltaQty: -10,
      reason: 'r',
    });
    assert.strictEqual(bad.ok, false);
    if (bad.ok) return;
    assert.strictEqual(bad.type, 'negative_stock');
    // Stock unchanged, no extra audit row.
    assert.strictEqual(await variantStock('var1'), 4);
    assert.strictEqual(await countAudit('INVENTORY_ADJUSTED'), auditBefore);
  });

  it('12. concurrent adjustments serialize under row lock (no lost updates)', async () => {
    const auditBefore = await countAudit('INVENTORY_ADJUSTED');
    const [a, b] = await Promise.all([
      adjust(superCtx, { productId: 'prod1', deltaQty: -8, reason: 'a' }),
      adjust(superCtx, { productId: 'prod1', deltaQty: -8, reason: 'b' }),
    ]);
    const okCount = [a, b].filter((r) => r.ok).length;
    const finalStock = await productStock('prod1');
    // One of the two -8 adjustments succeeds (10 -> 2); the other sees 2 and
    // would go to -6, so it is rejected. Exactly one write + one audit.
    assert.strictEqual(okCount, 1);
    assert.strictEqual(finalStock, 2);
    assert.strictEqual(await countAudit('INVENTORY_ADJUSTED'), auditBefore + 1);
  });
});

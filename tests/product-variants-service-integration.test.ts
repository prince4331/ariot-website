/**
 * tests/product-variants-service-integration.test.ts — Step 2.4.5 FINAL
 * production-service verification against a disposable PostgreSQL database.
 *
 * This test replaces the SQL-mirror approach (option B) for business-rule
 * coverage: it imports and executes the REAL production variant executors
 * (create / update / archive / loader) through the shared authorization
 * boundary (`authorizeProductWrite` / `authorizeProductRead`), against a real
 * PostgreSQL database using the real Prisma client. It injects controlled
 * `AuthorizationContext`s (writer / reader / super / namespace-wildcard /
 * none) so the actual `hasAllPermissions` evaluator decides allow vs deny.
 *
 * The session layer (`variant-auth.ts` → Better Auth → `next/headers`) is
 * intentionally NOT imported: executors receive the context as data, exactly
 * as the production wrappers hand it over after session resolution.
 *
 * Run (Node 24 native TS + alias/extensionless resolver):
 *   node --import ./tests/helpers/register-hooks.mjs
 *        --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
 *        --test tests/product-variants-service-integration.test.ts
 *
 * The primary development database is NEVER touched: DATABASE_URL is set to a
 * disposable `ariot_variants_service_test` database BEFORE the executor chain
 * is dynamically imported, so `server/db.ts` binds Prisma to the test DB only.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

import { utcPoolConfig } from '@/server/db-timezone';
import type { AuthorizationContext } from '@/server/auth/permissions';
import { AuthorizationError } from '@/server/auth/errors';
import type { VariantMutationResult } from '@/server/admin/products/product-variant-mutation-helpers';
import type { AdminProductVariantsDto } from '@/server/admin/products/get-product-variants-executor';

const { Pool, Client } = pg;

// ── Load .env (node:test does not load it) ───────────────────────────────────

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
const TEST_DB_NAME = 'ariot_variants_service_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);

assert.ok(testUrl.includes('localhost') || testUrl.includes('127.0.0.1'), 'Test URL must be local');

// PrismaPg reads timestamps as wall-clock UTC (ignoring the session offset)
// while the raw pg driver honors the session — so a +06:00 session skews
// Product.updatedAt by 6h and breaks the concurrency token (I-029). The UTC
// session invariant now comes from the one central policy rather than an
// ad-hoc connection-string edit here. See `server/db-timezone.ts` (D-070).

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
  assert.strictEqual(r.rows.length, 1, 'product must exist');
  return r.rows[0].updatedAt.toISOString();
}

async function listVariants(productId: string) {
  const r = await pool.query(
    `SELECT id, sku, name, "optionValues", "priceMinor", currency, stock, barcode, "isDefault", "deletedAt"
     FROM "ProductVariant" WHERE "productId" = $1 ORDER BY "createdAt", id`,
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

/** Narrow the VariantMutationResult union to read the duplicate field. */
function duplicateField(result: VariantMutationResult): string | undefined {
  return result.ok === false && result.type === 'duplicate' ? result.field : undefined;
}

// ── Production executors (dynamically imported AFTER env is set) ─────────────

type Executors = {
  create: (ctx: AuthorizationContext, raw: unknown) => Promise<VariantMutationResult>;
  update: (ctx: AuthorizationContext, raw: unknown) => Promise<VariantMutationResult>;
  archive: (ctx: AuthorizationContext, raw: unknown) => Promise<VariantMutationResult>;
  load: (ctx: AuthorizationContext, productId: string) => Promise<AdminProductVariantsDto | null>;
};

let service: Executors;

async function loadExecutors(): Promise<Executors> {
  const createMod = await import('../server/admin/products/create-product-variant-executor.ts');
  const updateMod = await import('../server/admin/products/update-product-variant-executor.ts');
  const archiveMod = await import('../server/admin/products/archive-product-variant-executor.ts');
  const loadMod = await import('../server/admin/products/get-product-variants-executor.ts');
  return {
    create: createMod.createProductVariantWithContext,
    update: updateMod.updateProductVariantWithContext,
    archive: archiveMod.archiveProductVariantWithContext,
    load: loadMod.getProductVariantsWithContext,
  };
}

// ── Controlled authorization contexts ────────────────────────────────────────

const writerCtx: AuthorizationContext = {
  userId: 'actor1',
  email: 'writer@ariot.test',
  roles: ['CONTENT_ADMIN'],
  permissions: ['products.read', 'products.write'],
};

const readerCtx: AuthorizationContext = {
  userId: 'actor2',
  email: 'reader@ariot.test',
  roles: ['CONTENT_ADMIN'],
  permissions: ['products.read'],
};

const superCtx: AuthorizationContext = {
  userId: 'actor3',
  email: 'super@ariot.test',
  roles: ['SUPER_ADMIN'],
  permissions: ['*'],
};

const namespaceWildcardCtx: AuthorizationContext = {
  userId: 'actor4',
  email: 'wildcard@ariot.test',
  roles: ['CONTENT_ADMIN'],
  permissions: ['products.*'],
};

const noneCtx: AuthorizationContext = {
  userId: 'actor5',
  email: 'none@ariot.test',
  roles: [],
  permissions: [],
};

// ── Valid variant payloads ───────────────────────────────────────────────────

const black12v = {
  productId: 'prod1',
  expectedUpdatedAt: BASE_TOKEN,
  data: {
    name: 'Black, 12V',
    sku: 'ts-001 ',
    optionValues: { color: 'Black', voltage: '12V' },
    priceMinor: '25000',
    currency: 'BDT',
    stock: 4,
    barcode: '0123456789012',
    isDefault: true,
  },
};

const white12v = {
  productId: 'prod1',
  expectedUpdatedAt: BASE_TOKEN,
  data: {
    name: 'White, 12V',
    sku: 'TS-002',
    optionValues: { color: 'White', voltage: '12V' },
    priceMinor: '26000',
    currency: 'BDT',
    stock: 6,
    barcode: '0123456789013',
    isDefault: false,
  },
};

// ── Setup / teardown ─────────────────────────────────────────────────────────

before(async () => {
  await createDb();
  pool = new Pool(utcPoolConfig(testUrl));
  await seedSchema();
  await seedData();

  // Bind the Prisma singleton to the TEST database before the executor chain
  // is loaded (server/db.ts reads DATABASE_URL at module evaluation). Prisma
  // pins its own UTC session through `utcPoolConfig`, so the plain URL is
  // enough here and both drivers read the same instants for Product.updatedAt.
  process.env.DATABASE_URL = testUrl;
  service = await loadExecutors();
});

beforeEach(async () => {
  await resetState();
});

after(async () => {
  // Close the real Prisma pool (created by the executor chain) so the test
  // process can exit; then close the raw pool and drop the disposable DB.
  const { prisma } = await import('@/server/db');
  await prisma.$disconnect();
  await pool.end();
  await dropDb();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Real variant services against disposable PostgreSQL', () => {
  // ── Authorization boundary (shared production evaluator) ──────────────────

  it('1. create denies a caller without products.write (AuthorizationError)', async () => {
    await assert.rejects(() => service.create(readerCtx, black12v), AuthorizationError);
    assert.strictEqual((await listVariants('prod1')).length, 0);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_CREATED'), 0);
  });

  it('2. create denies a namespace wildcard ("products.*") per D-060', async () => {
    await assert.rejects(() => service.create(namespaceWildcardCtx, black12v), AuthorizationError);
    assert.strictEqual((await listVariants('prod1')).length, 0);
  });

  it('3. create denies an empty-permission caller', async () => {
    await assert.rejects(() => service.create(noneCtx, black12v), AuthorizationError);
  });

  it('4. create allows a global "*" caller (SUPER_ADMIN convention)', async () => {
    const result = await service.create(superCtx, black12v);
    assert.strictEqual(result.ok, true);
  });

  // ── Loader ─────────────────────────────────────────────────────────────────

  it('5. loader with products.read returns the DTO (canEdit=false)', async () => {
    const dto = await service.load(readerCtx, 'prod1');
    assert.ok(dto);
    assert.strictEqual(dto.productId, 'prod1');
    assert.strictEqual(dto.productStatus, 'DRAFT');
    assert.strictEqual(dto.updatedAt, BASE_TOKEN);
    assert.strictEqual(dto.canEditVariants, false);
    assert.deepStrictEqual(dto.variants, []);
  });

  it('6. loader with products.write returns canEditVariants=true', async () => {
    const dto = await service.load(writerCtx, 'prod1');
    assert.ok(dto);
    assert.strictEqual(dto.canEditVariants, true);
  });

  it('7. loader denies products.read and returns null for unknown product', async () => {
    await assert.rejects(() => service.load(noneCtx, 'prod1'), AuthorizationError);
    await assert.rejects(() => service.load(namespaceWildcardCtx, 'prod1'), AuthorizationError);
    assert.strictEqual(await service.load(readerCtx, 'no-such-product'), null);
  });

  it('8. loader lists active variants ordered by createdAt asc with priceMinor strings', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');

    const second = await service.create(writerCtx, {
      ...white12v,
      expectedUpdatedAt: created.updatedAt,
    });
    if (!second.ok) return assert.fail('create failed');

    const dto = await service.load(writerCtx, 'prod1');
    assert.ok(dto);
    assert.strictEqual(dto.variants.length, 2);
    assert.strictEqual(dto.variants[0].sku, 'TS-001');
    assert.strictEqual(dto.variants[1].sku, 'TS-002');
    assert.strictEqual(dto.variants[0].priceMinor, '25000');
    assert.strictEqual(dto.variants[1].priceMinor, '26000');
    assert.strictEqual(dto.updatedAt, second.updatedAt);
  });

  // ── Create service ─────────────────────────────────────────────────────────

  it('9. create: row + audit + product token bumped + SKU normalization', async () => {
    const auditBefore = await countAudit('PRODUCT_VARIANT_CREATED');

    const result = await service.create(writerCtx, black12v);
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;

    const variants = await listVariants('prod1');
    assert.strictEqual(variants.length, 1);
    assert.strictEqual(variants[0].sku, 'TS-001');
    assert.strictEqual(variants[0].name, 'Black, 12V');
    assert.deepStrictEqual(variants[0].optionValues, { color: 'Black', voltage: '12V' });
    assert.strictEqual(variants[0].priceMinor, '25000');
    assert.strictEqual(variants[0].isDefault, true);
    assert.notStrictEqual(result.updatedAt, BASE_TOKEN);
    assert.strictEqual(await getProductToken('prod1'), result.updatedAt);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_CREATED'), auditBefore + 1);
  });

  it("10. create SKU colliding with another product's variant: duplicate, no rows", async () => {
    const first = await service.create(writerCtx, black12v);
    if (!first.ok) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_CREATED');

    const result = await service.create(writerCtx, {
      ...black12v,
      productId: 'prod2',
      data: { ...black12v.data, name: 'Dup' },
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(duplicateField(result), 'sku');
    assert.strictEqual((await listVariants('prod2')).length, 0);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_CREATED'), auditBefore);
  });

  it('11. create SKU colliding with the product SKU: duplicate', async () => {
    const result = await service.create(writerCtx, {
      ...black12v,
      data: { ...black12v.data, sku: 'BASE-001' },
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(duplicateField(result), 'sku');
    assert.strictEqual((await listVariants('prod1')).length, 0);
  });

  it('12. create duplicate combination (different key order): duplicate', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok) return assert.fail('create failed');

    const result = await service.create(writerCtx, {
      ...black12v,
      expectedUpdatedAt: created.updatedAt,
      data: {
        ...black12v.data,
        sku: 'TS-999',
        optionValues: { voltage: '12V', color: 'Black' },
      },
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(duplicateField(result), 'combination');
  });

  it('13. create with invalid option values: validation, no rows', async () => {
    const result = await service.create(writerCtx, {
      ...black12v,
      data: { ...black12v.data, sku: 'TS-BAD', optionValues: { color: '' } },
    });
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'validation');
    assert.strictEqual((await listVariants('prod1')).length, 0);
  });

  it('14. create isDefault=true clears the existing default (exactly one default)', async () => {
    const first = await service.create(writerCtx, black12v);
    if (!first.ok) return assert.fail('create failed');

    const second = await service.create(writerCtx, {
      ...black12v,
      expectedUpdatedAt: first.updatedAt,
      data: { ...white12v.data, isDefault: true },
    });
    assert.strictEqual(second.ok, true);

    const variants = await listVariants('prod1');
    const defaults = variants.filter((v) => v.isDefault);
    assert.strictEqual(defaults.length, 1);
    assert.strictEqual(defaults[0].sku, 'TS-002');
  });

  it('15. create with a price beyond Number.MAX_SAFE_INTEGER succeeds (BigInt-safe)', async () => {
    const hugePrice = '1234567890123456789';
    assert.ok(BigInt(hugePrice) > BigInt(Number.MAX_SAFE_INTEGER));
    const result = await service.create(writerCtx, {
      ...black12v,
      data: { ...black12v.data, sku: 'TS-HUGE', priceMinor: hugePrice },
    });
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual((await listVariants('prod1'))[0].priceMinor, hugePrice);
    }
  });

  it('16. create with negative / non-numeric price: validation, no rows', async () => {
    const neg = await service.create(writerCtx, {
      ...black12v,
      data: { ...black12v.data, sku: 'TS-NEG', priceMinor: '-25000' },
    });
    assert.strictEqual(neg.ok, false);
    if (!neg.ok) assert.strictEqual(neg.type, 'validation');

    const alpha = await service.create(writerCtx, {
      ...black12v,
      data: { ...black12v.data, sku: 'TS-ALPHA', priceMinor: '25k' },
    });
    assert.strictEqual(alpha.ok, false);
    if (!alpha.ok) assert.strictEqual(alpha.type, 'validation');

    assert.strictEqual((await listVariants('prod1')).length, 0);
  });

  it('17. create with a stale concurrency token: conflict, no row, no audit', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_CREATED');

    const stale = await service.create(writerCtx, white12v);
    assert.strictEqual(stale.ok, false);
    if (!stale.ok) assert.strictEqual(stale.type, 'conflict');
    assert.strictEqual((await listVariants('prod1')).length, 1);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_CREATED'), auditBefore);
  });

  it('18. create for an unknown product: not_found', async () => {
    const result = await service.create(writerCtx, {
      ...black12v,
      productId: 'no-such-product',
    });
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'not_found');
  });

  // ── Update service ─────────────────────────────────────────────────────────

  it('19. update: row + audit + token bumped, price changed (stock is inventory-owned)', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_UPDATED');

    const result = await service.update(writerCtx, {
      productId: 'prod1',
      variantId: created.variantId,
      expectedUpdatedAt: created.updatedAt,
      data: {
        ...black12v.data,
        name: 'Black, 12V (v2)',
        stock: 9,
        priceMinor: '27000',
      },
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;

    const variants = await listVariants('prod1');
    assert.strictEqual(variants[0].name, 'Black, 12V (v2)');
    // Stock is no longer mutable via the variant editor (D-073): variant starts
    // at 0 and the update ignores any stock value passed in.
    assert.strictEqual(variants[0].stock, 0);
    assert.strictEqual(variants[0].priceMinor, '27000');
    assert.strictEqual(await getProductToken('prod1'), result.updatedAt);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_UPDATED'), auditBefore + 1);
  });

  it('20. update no-op: success, no audit, token unchanged', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_UPDATED');

    const result = await service.update(writerCtx, {
      productId: 'prod1',
      variantId: created.variantId,
      expectedUpdatedAt: created.updatedAt,
      data: { ...black12v.data },
    });
    assert.strictEqual(result.ok, true);
    if (result.ok) assert.strictEqual(result.updatedAt, created.updatedAt);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_UPDATED'), auditBefore);
  });

  it("21. update to another variant's SKU: duplicate, row unchanged", async () => {
    const v1 = await service.create(writerCtx, black12v);
    if (!v1.ok || !v1.variantId) return assert.fail('create failed');
    const v2 = await service.create(writerCtx, {
      ...black12v,
      expectedUpdatedAt: v1.updatedAt,
      data: white12v.data,
    });
    if (!v2.ok || !v2.variantId) return assert.fail('create failed');

    const result = await service.update(writerCtx, {
      productId: 'prod1',
      variantId: v2.variantId,
      expectedUpdatedAt: v2.updatedAt,
      data: { ...white12v.data, sku: 'TS-001' },
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(duplicateField(result), 'sku');

    const variants = await listVariants('prod1');
    assert.strictEqual(variants.find((v) => v.id === v2.variantId).sku, 'TS-002');
  });

  it('22. update with a stale token: conflict, no audit', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_UPDATED');

    const result = await service.update(writerCtx, {
      productId: 'prod1',
      variantId: created.variantId,
      expectedUpdatedAt: BASE_TOKEN,
      data: { ...black12v.data, stock: 9 },
    });
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'conflict');
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_UPDATED'), auditBefore);
  });

  it('23. update a variant under a different product: validation', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');

    const result = await service.update(writerCtx, {
      productId: 'prod2',
      variantId: created.variantId,
      expectedUpdatedAt: BASE_TOKEN,
      data: { ...black12v.data, stock: 9 },
    });
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'validation');
  });

  it('24. update leaves stock untouched (stock is inventory-owned); price/currency/barcode/options unchanged', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');

    const result = await service.update(writerCtx, {
      productId: 'prod1',
      variantId: created.variantId,
      expectedUpdatedAt: created.updatedAt,
      data: { ...black12v.data, stock: 42 },
    });
    assert.strictEqual(result.ok, true);

    const variants = await listVariants('prod1');
    // Stock is ignored by the variant update (D-073); variant still starts at 0.
    assert.strictEqual(variants[0].stock, 0);
    assert.strictEqual(variants[0].priceMinor, '25000');
    assert.strictEqual(variants[0].currency, 'BDT');
    assert.strictEqual(variants[0].barcode, '0123456789012');
    assert.deepStrictEqual(variants[0].optionValues, { color: 'Black', voltage: '12V' });
  });

  // ── Archive service ────────────────────────────────────────────────────────

  it('25. archive: deletedAt set + audit + token bumped', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_ARCHIVED');

    const result = await service.archive(writerCtx, {
      productId: 'prod1',
      variantId: created.variantId,
      expectedUpdatedAt: created.updatedAt,
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;

    const variants = await listVariants('prod1');
    assert.notStrictEqual(variants[0].deletedAt, null);
    assert.notStrictEqual(result.updatedAt, created.updatedAt);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_ARCHIVED'), auditBefore + 1);
  });

  it('26. archive already-archived variant: idempotent no-op, no audit', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');

    const first = await service.archive(writerCtx, {
      productId: 'prod1',
      variantId: created.variantId,
      expectedUpdatedAt: created.updatedAt,
    });
    if (!first.ok) return assert.fail('archive failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_ARCHIVED');

    const second = await service.archive(writerCtx, {
      productId: 'prod1',
      variantId: created.variantId,
      expectedUpdatedAt: first.updatedAt,
    });
    assert.strictEqual(second.ok, true);
    if (second.ok) assert.strictEqual(second.updatedAt, first.updatedAt);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_ARCHIVED'), auditBefore);
  });

  it('27. archived SKU stays reserved: re-creating the same SKU is a duplicate (Task 10)', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');

    const archived = await service.archive(writerCtx, {
      productId: 'prod1',
      variantId: created.variantId,
      expectedUpdatedAt: created.updatedAt,
    });
    if (!archived.ok) return assert.fail('archive failed');

    const result = await service.create(writerCtx, {
      ...black12v,
      expectedUpdatedAt: archived.updatedAt,
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(duplicateField(result), 'sku');
    assert.strictEqual((await listVariants('prod1')).length, 1);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_ARCHIVED'), 1);
  });

  it('28. loader excludes archived variants', async () => {
    const v1 = await service.create(writerCtx, black12v);
    if (!v1.ok || !v1.variantId) return assert.fail('create failed');
    const v2 = await service.create(writerCtx, {
      ...black12v,
      expectedUpdatedAt: v1.updatedAt,
      data: white12v.data,
    });
    if (!v2.ok) return assert.fail('create failed');

    await service.archive(writerCtx, {
      productId: 'prod1',
      variantId: v2.variantId,
      expectedUpdatedAt: v2.updatedAt,
    });

    const dto = await service.load(writerCtx, 'prod1');
    assert.ok(dto);
    assert.strictEqual(dto.variants.length, 1);
    assert.strictEqual(dto.variants[0].id, v1.variantId);
  });

  it('29. archive with a stale token: conflict, no audit', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    const auditBefore = await countAudit('PRODUCT_VARIANT_ARCHIVED');

    const result = await service.archive(writerCtx, {
      productId: 'prod1',
      variantId: created.variantId,
      expectedUpdatedAt: BASE_TOKEN,
    });
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'conflict');
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_ARCHIVED'), auditBefore);
  });

  it('30. archive an unknown variant: validation', async () => {
    const result = await service.archive(writerCtx, {
      productId: 'prod1',
      variantId: 'no-such-variant',
      expectedUpdatedAt: BASE_TOKEN,
    });
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.type, 'validation');
  });

  // ── Final integrity ────────────────────────────────────────────────────────

  it('31. final integrity: products intact, audit trail complete', async () => {
    const created = await service.create(writerCtx, black12v);
    if (!created.ok || !created.variantId) return assert.fail('create failed');
    await service.create(writerCtx, {
      ...black12v,
      productId: 'prod2',
      expectedUpdatedAt: BASE_TOKEN,
      data: white12v.data,
    });
    await service.update(writerCtx, {
      productId: 'prod1',
      variantId: created.variantId,
      expectedUpdatedAt: created.updatedAt,
      data: { ...black12v.data, name: 'Black, 12V (renamed)' },
    });

    const products = await pool.query(`SELECT id, name, sku FROM "Product" ORDER BY id`);
    assert.strictEqual(products.rows.length, 2);
    assert.strictEqual(products.rows[0].name, 'Base Product');
    assert.strictEqual(products.rows[1].name, 'Other Product');
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_CREATED'), 2);
    assert.strictEqual(await countAudit('PRODUCT_VARIANT_UPDATED'), 1);

    const prod1Token = await getProductToken('prod1');
    const prod2Token = await getProductToken('prod2');
    assert.notStrictEqual(prod1Token, BASE_TOKEN);
    assert.notStrictEqual(prod2Token, BASE_TOKEN);
  });
});

/**
 * tests/inventory-permission.test.ts — Step 2.4.6A1 unit coverage
 * - RBAC matrix (D-074) declared in the permission catalog.
 * - Input validation contract of `adjustInventoryRequestSchema`.
 *
 * No database required (pure modules evaluated directly).
 *
 * Run:
 *   node --import ./tests/helpers/register-hooks.mjs \
 *        --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *        --test tests/inventory-permission.test.ts
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  PERMISSIONS,
  ROLE_PERMISSION_SETS,
} from '@/server/auth/permission-catalog';
import {
  adjustInventoryRequestSchema,
  REASON_MAX_LENGTH,
} from '@/server/admin/inventory/inventory-schema';

describe('Inventory RBAC matrix (D-074)', () => {
  it('declares inventory.read + inventory.adjust permission strings', () => {
    assert.strictEqual(PERMISSIONS.inventory.read, 'inventory.read');
    assert.strictEqual(PERMISSIONS.inventory.adjust, 'inventory.adjust');
  });

  it('CONTENT_ADMIN can read but not adjust', () => {
    const perms = ROLE_PERMISSION_SETS.CONTENT_ADMIN as readonly string[];
    assert.ok(perms.includes('inventory.read'));
    assert.ok(!perms.includes('inventory.adjust'));
  });

  it('SALES_ADMIN can read but not adjust', () => {
    const perms = ROLE_PERMISSION_SETS.SALES_ADMIN as readonly string[];
    assert.ok(perms.includes('inventory.read'));
    assert.ok(!perms.includes('inventory.adjust'));
  });

  it('SUPER_ADMIN holds the global wildcard', () => {
    const perms = ROLE_PERMISSION_SETS.SUPER_ADMIN as readonly string[];
    assert.ok(perms.includes('*'));
  });

  it('SUPPORT_ADMIN has no inventory access', () => {
    const perms = ROLE_PERMISSION_SETS.SUPPORT_ADMIN as readonly string[];
    assert.ok(!perms.includes('inventory.read'));
    assert.ok(!perms.includes('inventory.adjust'));
  });
});

describe('adjustInventoryRequestSchema', () => {
  it('accepts a valid product-level adjustment', () => {
    const r = adjustInventoryRequestSchema.safeParse({
      productId: 'p1',
      deltaQty: 5,
      reason: 'Received goods',
    });
    assert.strictEqual(r.success, true);
    if (!r.success) return;
    assert.strictEqual(r.data.variantId, undefined);
    assert.strictEqual(r.data.note, undefined);
  });

  it('accepts a valid variant-level adjustment with note', () => {
    const r = adjustInventoryRequestSchema.safeParse({
      productId: 'p1',
      variantId: 'v1',
      deltaQty: -3,
      reason: 'Damaged',
      note: 'spill',
    });
    assert.strictEqual(r.success, true);
  });

  it('rejects when reason is missing', () => {
    const r = adjustInventoryRequestSchema.safeParse({
      productId: 'p1',
      deltaQty: 1,
    });
    assert.strictEqual(r.success, false);
  });

  it('rejects unknown fields (strict contract)', () => {
    const r = adjustInventoryRequestSchema.safeParse({
      productId: 'p1',
      deltaQty: 1,
      reason: 'ok',
      evil: true,
    });
    assert.strictEqual(r.success, false);
  });

  it('allows negative deltaQty at the schema layer (rejection is domain-level, D-071)', () => {
    const r = adjustInventoryRequestSchema.safeParse({
      productId: 'p1',
      deltaQty: -10,
      reason: 'Shrinkage',
    });
    assert.strictEqual(r.success, true);
  });

  it('rejects an empty/whitespace reason', () => {
    const r = adjustInventoryRequestSchema.safeParse({
      productId: 'p1',
      deltaQty: 1,
      reason: '   ',
    });
    assert.strictEqual(r.success, false);
  });

  it('rejects a reason longer than the max length', () => {
    const r = adjustInventoryRequestSchema.safeParse({
      productId: 'p1',
      deltaQty: 1,
      reason: 'x'.repeat(REASON_MAX_LENGTH + 1),
    });
    assert.strictEqual(r.success, false);
  });
});

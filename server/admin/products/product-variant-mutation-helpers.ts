import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/server/db';
import { AuthorizationError } from '@/server/auth/errors';
import { hasAllPermissions, PERMISSIONS } from '@/server/auth/permission-catalog';
import type { AuthorizationContext } from '@/server/auth/permissions';
import {
  optionCombinationKey,
  normalizeOptionValues,
  type VariantFieldsInput,
} from './product-variant-schema';

/**
 * Shared building blocks for product variant mutations — Step 2.4.5.
 *
 * Result type, the shared authorization boundary, concurrency helper, global
 * SKU conflict check, per-product option-combination check, audit snapshot
 * helpers, and change detection used by create/update/archive.
 *
 * Authorization model (verified by real-service PostgreSQL integration tests):
 *   - Production wrappers (`variant-auth.ts`) resolve the caller's identity
 *     from the session via `requirePermission`, then call the executor.
 *   - Executors (create/update/archive/loader) run `authorizeProductWrite` /
 *     `authorizeProductRead` against the resolved `AuthorizationContext` — the
 *     SAME `hasAllPermissions` evaluator used by `requirePermission`. Tests may
 *     inject a controlled context through this shared production boundary.
 */

// ── Result type ──────────────────────────────────────────────────────────────

export type VariantMutationResult =
  | { ok: true; updatedAt: string; variantId: string }
  | { ok: false; type: 'forbidden'; message: string }
  | { ok: false; type: 'not_found'; message: string }
  | { ok: false; type: 'conflict'; message: string }
  | { ok: false; type: 'validation'; message: string }
  | { ok: false; type: 'duplicate'; field: 'sku' | 'combination'; message: string }
  | { ok: false; type: 'error'; message: string };

// ── Shared authorization boundary ────────────────────────────────────────────

/** Throw `AuthorizationError` unless the caller holds `products.write`. */
export function authorizeProductWrite(ctx: AuthorizationContext): void {
  if (!hasAllPermissions(ctx.permissions, [PERMISSIONS.products.write])) {
    throw new AuthorizationError();
  }
}

/** Throw `AuthorizationError` unless the caller holds `products.read`. */
export function authorizeProductRead(ctx: AuthorizationContext): void {
  if (!hasAllPermissions(ctx.permissions, [PERMISSIONS.products.read])) {
    throw new AuthorizationError();
  }
}

// ── Concurrency ──────────────────────────────────────────────────────────────

export async function loadProduct(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
    select: { id: true, updatedAt: true },
  });
}

export function checkConcurrency(current: Date, expected: string): VariantMutationResult | null {
  if (current.toISOString() !== expected) {
    return {
      ok: false,
      type: 'conflict',
      message: 'Product was updated elsewhere. Reload and try again.',
    };
  }
  return null;
}

// ── Uniqueness checks ────────────────────────────────────────────────────────

/** Global SKU conflict check. Excludes the variant being updated, when given. */
export async function findSkuConflict(
  sku: string,
  excludeVariantId: string | null,
): Promise<boolean> {
  const [variantDup, productDup] = await Promise.all([
    prisma.productVariant.findFirst({
      where: { sku, ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}) },
      select: { id: true },
    }),
    prisma.product.findFirst({ where: { sku, deletedAt: null }, select: { id: true } }),
  ]);
  return Boolean(variantDup || productDup);
}

/** Normalized option-combination keys for a product's active variants. */
export async function loadCombinationKeys(
  productId: string,
  excludeVariantId: string | null,
): Promise<Set<string>> {
  const variants = await prisma.productVariant.findMany({
    where: {
      productId,
      deletedAt: null,
      ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}),
    },
    select: { optionValues: true },
  });
  const keys = new Set<string>();
  for (const variant of variants) {
    const normalized = normalizeOptionValues(variant.optionValues);
    if (normalized.ok) keys.add(optionCombinationKey(normalized.data));
  }
  return keys;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// ── Audit helpers ────────────────────────────────────────────────────────────

type ActorRole = 'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'SUPPORT_ADMIN' | 'SALES_ADMIN';

export function actorRole(roles: string[]): ActorRole | null {
  return (roles[0] as ActorRole | undefined) ?? null;
}

export type CurrentVariant = {
  name: string;
  sku: string;
  optionValues: Record<string, string>;
  priceMinor: bigint | null;
  currency: string | null;
  stock: number;
  barcode: string | null;
  isDefault: boolean;
};

export function buildSnapshot(
  source: VariantFieldsInput | CurrentVariant,
  changes: string[],
): Record<string, string | number | boolean | null> {
  const snap: Record<string, string | number | boolean | null> = {};
  for (const field of changes) {
    const value = (source as Record<string, unknown>)[field];
    if (typeof value === 'bigint') snap[field] = value.toString();
    else if (value === null || value === undefined) snap[field] = null;
    else if (typeof value === 'object') snap[field] = JSON.stringify(value);
    else snap[field] = value as string | number | boolean;
  }
  return snap;
}

export function detectChanges(current: CurrentVariant, data: VariantFieldsInput): string[] {
  const changed: string[] = [];
  if (current.name !== data.name) changed.push('name');
  if (current.sku !== data.sku) changed.push('sku');
  if (optionCombinationKey(current.optionValues) !== optionCombinationKey(data.optionValues)) {
    changed.push('optionValues');
  }
  const currentPrice = current.priceMinor?.toString() ?? null;
  if (currentPrice !== (data.priceMinor ?? null)) changed.push('priceMinor');
  if ((current.currency ?? null) !== (data.currency ?? null)) changed.push('currency');
  if ((current.barcode ?? null) !== (data.barcode ?? null)) changed.push('barcode');
  if (current.isDefault !== data.isDefault) changed.push('isDefault');
  return changed;
}

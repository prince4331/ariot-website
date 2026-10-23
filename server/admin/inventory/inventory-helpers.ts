import { Prisma } from '@/lib/generated/prisma/client';
import type { AuthorizationContext } from '@/server/auth/permissions';
import { AuthorizationError } from '@/server/auth/errors';
import { hasAllPermissions, PERMISSIONS } from '@/server/auth/permission-catalog';

/**
 * Shared building blocks for the Inventory module — Step 2.4.6A1.
 *
 * Authorization boundary + result types + actor-role helper. Mirrors the
 * product-variant mutation helpers so the inventory executors plug into the
 * same `hasAllPermissions` evaluator used everywhere else.
 *
 * Authorization model:
 *  - `adjustInventory` requires `inventory.adjust`.
 *  - `listInventory` requires `inventory.read`.
 *  - SUPER_ADMIN holds both via the `"*"` wildcard (D-074).
 *  - CONTENT_ADMIN / SALES_ADMIN hold `inventory.read` only (D-074).
 *  - SUPPORT_ADMIN holds neither (D-074).
 */

// ── Result type ──────────────────────────────────────────────────────────────

export type InventoryResult =
  | {
      ok: true;
      productId: string;
      variantId: string | null;
      authority: 'Product' | 'Variant';
      before: number;
      after: number;
      deltaQty: number;
    }
  | { ok: false; type: 'forbidden'; message: string }
  | { ok: false; type: 'validation'; message: string }
  | { ok: false; type: 'not_found'; message: string }
  | { ok: false; type: 'negative_stock'; message: string }
  | { ok: false; type: 'error'; message: string };

// ── Shared authorization boundary ────────────────────────────────────────────

/** Throw `AuthorizationError` unless the caller holds `inventory.adjust`. */
export function authorizeInventoryAdjust(ctx: AuthorizationContext): void {
  if (!hasAllPermissions(ctx.permissions, [PERMISSIONS.inventory.adjust])) {
    throw new AuthorizationError();
  }
}

/** Throw `AuthorizationError` unless the caller holds `inventory.read`. */
export function authorizeInventoryRead(ctx: AuthorizationContext): void {
  if (!hasAllPermissions(ctx.permissions, [PERMISSIONS.inventory.read])) {
    throw new AuthorizationError();
  }
}

/** True when the caller may adjust stock (used by the list view for UI state). */
export function canAdjustInventory(ctx: AuthorizationContext): boolean {
  return hasAllPermissions(ctx.permissions, [PERMISSIONS.inventory.adjust]);
}

// ── Audit actor role helper ────────────────────────────────────────────────────

type ActorRole = 'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'SUPPORT_ADMIN' | 'SALES_ADMIN';

export function actorRole(roles: string[]): ActorRole | null {
  return (roles[0] as ActorRole | undefined) ?? null;
}

// ── Re-export for executors ───────────────────────────────────────────────────

export { Prisma };

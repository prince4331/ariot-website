import { requireInventoryAdjust } from './inventory-auth';
import { adjustInventoryWithContext } from './adjust-inventory-executor';
import type { InventoryResult } from './inventory-helpers';

/**
 * Inventory adjustment — Step 2.4.6A1 (production wrapper).
 *
 * Resolves the caller's identity via `requireInventoryAdjust` (session → RBAC),
 * then delegates to `adjustInventoryWithContext`, which re-verifies the
 * permission against the resolved context through the shared authorization
 * boundary and runs the mutation. Throws AuthenticationError/AuthorizationError
 * when unauthenticated / lacking `inventory.adjust` (handled by the route).
 */

export async function adjustInventory(rawInput: unknown): Promise<InventoryResult> {
  let ctx;
  try {
    ctx = await requireInventoryAdjust();
  } catch {
    return { ok: false, type: 'forbidden', message: 'Insufficient permissions.' };
  }
  return adjustInventoryWithContext(ctx, rawInput);
}

export type { InventoryResult };

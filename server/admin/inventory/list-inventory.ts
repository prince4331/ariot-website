import { requireInventoryRead } from './inventory-auth';
import { canAdjustInventory } from './inventory-helpers';
import {
  listInventoryWithContext,
  paginateInventoryRows,
  type InventoryListParams,
} from './list-inventory-executor';
import type { InventoryListResult } from './inventory-schema';

/**
 * Inventory list — Step 2.4.6A1 (production wrapper).
 *
 * Resolves the caller's identity via `requireInventoryRead`, loads the rows
 * (authority already resolved by the executor), and reports whether the caller
 * may also adjust stock (drives the Adjust button visibility in the UI).
 */

export async function listInventory(
  params: InventoryListParams = {},
): Promise<InventoryListResult> {
  const ctx = await requireInventoryRead();
  const all = await listInventoryWithContext(ctx, params);
  const page = paginateInventoryRows(all, params.pageSize ?? 50);
  return {
    rows: page.rows,
    pagination: {
      hasNextPage: page.hasNextPage,
      hasPreviousPage: false,
      nextCursor: page.nextCursor,
    },
    canAdjust: canAdjustInventory(ctx),
  };
}

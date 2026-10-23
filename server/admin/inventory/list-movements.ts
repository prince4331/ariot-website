import { requireInventoryRead } from './inventory-auth';
import { listStockMovementsWithContext } from './list-movements-executor';
import type { ListStockMovementsParams, StockMovementListResult } from './inventory-schema';

/**
 * StockMovement list — Step 2.4.6A3 (production wrapper).
 *
 * Resolves the caller's identity via `requireInventoryRead` and returns the
 * immutable stock-movement ledger. Read-only; anyone who can view inventory can
 * view the history (D-074: CONTENT_ADMIN / SALES_ADMIN hold `inventory.read`).
 */

export async function listStockMovements(
  params: ListStockMovementsParams = {},
): Promise<StockMovementListResult> {
  const ctx = await requireInventoryRead();
  return listStockMovementsWithContext(ctx, params);
}

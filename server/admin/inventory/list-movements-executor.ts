import { prisma } from '@/server/db';
import type { AuthorizationContext } from '@/server/auth/permissions';
import { authorizeInventoryRead } from './inventory-helpers';
import type { ListStockMovementsParams, StockMovementListResult, StockMovementRow } from './inventory-schema';

/**
 * StockMovement list loader — Step 2.4.6A3 (executor).
 *
 * Returns the immutable stock-movement ledger for a product (and optionally a
 * specific variant), newest first, cursor-paginated. Read-only: never writes.
 * Requires `inventory.read`. This is inventory *history* — distinct from AuditLog
 * (security/admin activity). StockMovement rows are append-only (a DB trigger
 * rejects UPDATE/DELETE), so this loader only ever reads.
 */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function listStockMovementsWithContext(
  ctx: AuthorizationContext,
  params: ListStockMovementsParams = {},
): Promise<StockMovementListResult> {
  authorizeInventoryRead(ctx);

  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Number.isFinite(params.pageSize) ? (params.pageSize as number) : DEFAULT_PAGE_SIZE,
  );

  const where = {
    ...(params.productId ? { productId: params.productId } : {}),
    ...(params.variantId ? { variantId: params.variantId } : {}),
  };

  const rows = await prisma.stockMovement.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: pageSize + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      productId: true,
      variantId: true,
      deltaQty: true,
      quantityBefore: true,
      quantityAfter: true,
      reason: true,
      note: true,
      referenceType: true,
      referenceId: true,
      createdAt: true,
      createdBy: true,
    },
  });

  const hasNextPage = rows.length > pageSize;
  const pageRows = hasNextPage ? rows.slice(0, pageSize) : rows;
  const last = pageRows[pageRows.length - 1];

  const mapped: StockMovementRow[] = pageRows.map((r) => ({
    id: r.id,
    productId: r.productId,
    variantId: r.variantId,
    deltaQty: r.deltaQty,
    quantityBefore: r.quantityBefore,
    quantityAfter: r.quantityAfter,
    reason: r.reason,
    note: r.note,
    referenceType: r.referenceType,
    referenceId: r.referenceId,
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdBy,
  }));

  return {
    rows: mapped,
    pagination: {
      hasNextPage,
      hasPreviousPage: false,
      nextCursor: hasNextPage && last ? last.id : null,
    },
  };
}

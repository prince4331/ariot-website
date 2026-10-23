import { prisma } from '@/server/db';
import type { AuthorizationContext } from '@/server/auth/permissions';
import { authorizeInventoryRead } from './inventory-helpers';
import type { InventoryRow } from './inventory-schema';

/**
 * Inventory list loader — Step 2.4.6A1 (executor).
 *
 * Resolves the stock authority for every product (D-072) and returns one row
 * per authoritative stock bucket:
 *   - product with NO active variants → one Product-authority row.
 *   - product with active variants      → one Variant-authority row per variant.
 *
 * Read-only: never writes. Requires `inventory.read`.
 */

export interface InventoryListParams {
  pageSize?: number;
  cursor?: string | null;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function listInventoryWithContext(
  ctx: AuthorizationContext,
  params: InventoryListParams = {},
): Promise<InventoryRow[]> {
  authorizeInventoryRead(ctx);

  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Number.isFinite(params.pageSize) ? (params.pageSize as number) : DEFAULT_PAGE_SIZE,
  );

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    take: pageSize + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      updatedAt: true,
      variants: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
          optionValues: true,
          updatedAt: true,
        },
      },
    },
  });

  const rows: InventoryRow[] = [];
  for (const product of products) {
    if (product.variants.length > 0) {
      for (const variant of product.variants) {
        rows.push({
          id: variant.id,
          productId: product.id,
          productName: product.name,
          sku: variant.sku,
          variantId: variant.id,
          variantLabel: variant.name,
          variantOptions: (variant.optionValues ?? null) as Record<string, string> | null,
          stock: variant.stock,
          authority: 'Variant',
          updatedAt: variant.updatedAt.toISOString(),
        });
      }
    } else {
      rows.push({
        id: product.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        variantId: null,
        variantLabel: null,
        variantOptions: null,
        stock: product.stock,
        authority: 'Product',
        updatedAt: product.updatedAt.toISOString(),
      });
    }
  }

  return rows;
}

export interface InventoryListPage {
  rows: InventoryRow[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

/** Split a fetched product page (size+1) into rows + pagination cursor. */
export function paginateInventoryRows(
  rows: InventoryRow[],
  pageSize: number,
): InventoryListPage {
  const hasNextPage = rows.length > pageSize;
  const pageRows = hasNextPage ? rows.slice(0, pageSize) : rows;
  const last = pageRows[pageRows.length - 1];
  return {
    rows: pageRows,
    hasNextPage,
    nextCursor: hasNextPage && last ? last.id : null,
  };
}

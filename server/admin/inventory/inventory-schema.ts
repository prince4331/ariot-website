import { z } from 'zod';

/**
 * Inventory adjustment validation — Step 2.4.6A1.
 *
 * Server-authoritative validation for the Inventory adjustment service.
 * The Inventory module is the ONLY stock-mutation surface (D-073); the
 * Product / Variant editors must not modify stock.
 *
 * Rules:
 *  - `productId` is always required (the stock authority root).
 *  - `variantId` is optional: when present the authoritative row is the
 *    variant (D-072 Case 2/3); when absent the authoritative row is the
 *    product, but only if the product has NO active variants (D-072 Case 1).
 *  - `deltaQty` is an integer. It MAY be negative (a decrease) but the
 *    resulting stock must never be negative (D-071) — enforced by the
 *    executor after locking the row, not here.
 *  - `reason` is required, non-empty, trimmed, bounded.
 *  - `note` is optional, bounded.
 *  - `.strict()` rejects unknown fields (no client-supplied stock/permissions).
 */

export const REASON_MAX_LENGTH = 120;
export const NOTE_MAX_LENGTH = 500;

export const adjustInventoryRequestSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required.'),
    variantId: z.string().min(1, 'Variant ID is required.').optional(),
    deltaQty: z
      .number()
      .int('Adjustment quantity must be a whole number.')
      .refine((n) => Number.isSafeInteger(n), 'Adjustment quantity is out of range.'),
    reason: z
      .string()
      .trim()
      .min(1, 'A reason is required.')
      .max(REASON_MAX_LENGTH, `Reason must be ${REASON_MAX_LENGTH} characters or fewer.`),
    note: z
      .string()
      .trim()
      .max(NOTE_MAX_LENGTH, `Note must be ${NOTE_MAX_LENGTH} characters or fewer.`)
      .optional(),
  })
  .strict();

export type AdjustInventoryRequest = z.infer<typeof adjustInventoryRequestSchema>;

export type InventoryAuthority = 'Product' | 'Variant';

/** One row in the Inventory list (authority already resolved). */
export interface InventoryRow {
  /** Stable row id — product id (authority Product) or variant id (Variant). */
  id: string;
  productId: string;
  productName: string;
  /** Product SKU (authority Product) or variant SKU (authority Variant). */
  sku: string;
  variantId: string | null;
  /** Variant display name (authority Variant only). */
  variantLabel: string | null;
  /** Variant option key/values (authority Variant only). */
  variantOptions: Record<string, string> | null;
  stock: number;
  authority: InventoryAuthority;
  updatedAt: string;
}

export interface InventoryListResult {
  rows: InventoryRow[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
  };
  canAdjust: boolean;
}

// ── StockMovement ledger (Step 2.4.6A3) ───────────────────────────────────────

/** One immutable ledger row returned by the movements list. */
export interface StockMovementRow {
  id: string;
  productId: string;
  variantId: string | null;
  deltaQty: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  note: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  createdBy: string;
}

export interface ListStockMovementsParams {
  productId?: string;
  variantId?: string;
  cursor?: string | null;
  pageSize?: number;
}

export interface StockMovementListResult {
  rows: StockMovementRow[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
  };
}

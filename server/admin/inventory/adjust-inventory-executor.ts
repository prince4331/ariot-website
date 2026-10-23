import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/server/db';
import type { AuthorizationContext } from '@/server/auth/permissions';
import {
  actorRole,
  authorizeInventoryAdjust,
  type InventoryResult,
} from './inventory-helpers';
import { adjustInventoryRequestSchema } from './inventory-schema';

/**
 * Inventory stock adjustment — Step 2.4.6A1 (executor).
 *
 * The ONLY server-side path that mutates `Product.stock` / `ProductVariant.stock`.
 * Product and Variant editors no longer write stock (D-073).
 *
 * Behaviour:
 *  - Authorization re-checked against the resolved caller context.
 *  - Input validated strictly; unknown fields rejected.
 *  - Stock authority (D-072):
 *      variantId present  → authoritative row is that variant (must belong to
 *                            the product, must be active).
 *      variantId absent   → authoritative row is the product, BUT only when the
 *                            product has NO active variants. Otherwise the
 *                            adjustment is rejected (the variants are
 *                            authoritative, so adjust a specific variant).
 *  - Within a single interactive transaction the authoritative row is locked
 *    with `SELECT ... FOR UPDATE` (row safety / D-077), current stock is read,
 *    the resulting stock is computed, and:
 *      - result < 0  → rejected (`negative_stock`), NO write, NO audit (D-071).
 *      - otherwise   → stock updated + AuditLog row written (`INVENTORY_ADJUSTED`).
 *  - Concurrency: the row lock serializes concurrent adjustments, so no lost
 *    updates and no negative stock under contention.
 */

export async function adjustInventoryWithContext(
  ctx: AuthorizationContext,
  rawInput: unknown,
): Promise<InventoryResult> {
  authorizeInventoryAdjust(ctx);

  const parsed = adjustInventoryRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, type: 'validation', message: 'Invalid adjustment input.' };
  }

  const { productId, variantId, deltaQty, reason, note } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── Resolve + lock the authoritative row ──────────────────────────────
      if (variantId) {
        const locked = await tx.$queryRaw<Array<{ stock: number }>>`
          SELECT stock FROM "ProductVariant"
          WHERE id = ${variantId}
            AND "productId" = ${productId}
            AND "deletedAt" IS NULL
          FOR UPDATE
        `;
        if (locked.length === 0) {
          return {
            ok: false,
            type: 'not_found',
            message: 'Variant not found for this product.',
          } as InventoryResult;
        }
        const before = locked[0].stock;
        const after = before + deltaQty;
        if (after < 0) {
          return {
            ok: false,
            type: 'negative_stock',
            message: 'Adjustment would result in negative stock.',
          } as InventoryResult;
        }

        await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: after },
          select: { id: true },
        });

        // Operational ledger (D-075): immutable StockMovement, same transaction.
        await tx.stockMovement.create({
          data: {
            productId,
            variantId,
            deltaQty,
            quantityBefore: before,
            quantityAfter: after,
            reason,
            note: note ?? null,
            createdBy: ctx.userId,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: ctx.userId,
            actorRole: actorRole(ctx.roles),
            action: 'INVENTORY_ADJUSTED',
            entityType: 'ProductVariant',
            entityId: variantId,
            before: { stock: before, productId },
            after: {
              stock: after,
              deltaQty,
              reason,
              note: note ?? null,
              productId,
              variantId,
            },
          },
        });

        return {
          ok: true,
          productId,
          variantId,
          authority: 'Variant',
          before,
          after,
          deltaQty,
        } as InventoryResult;
      }

      // ── Product-level adjustment ────────────────────────────────────────────
      const locked = await tx.$queryRaw<Array<{ stock: number }>>`
        SELECT stock FROM "Product"
        WHERE id = ${productId}
          AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      if (locked.length === 0) {
        return {
          ok: false,
          type: 'not_found',
          message: 'Product not found.',
        } as InventoryResult;
      }

      // Authority guard (D-072 Case 1): product stock is only authoritative
      // when the product has no active variants.
      const activeVariantCount = await tx.productVariant.count({
        where: { productId, deletedAt: null },
      });
      if (activeVariantCount > 0) {
        return {
          ok: false,
          type: 'validation',
          message: 'Product has active variants; adjust a specific variant instead.',
        } as InventoryResult;
      }

      const before = locked[0].stock;
      const after = before + deltaQty;
      if (after < 0) {
        return {
          ok: false,
          type: 'negative_stock',
          message: 'Adjustment would result in negative stock.',
        } as InventoryResult;
      }

      await tx.product.update({
        where: { id: productId },
        data: { stock: after, updatedBy: ctx.userId },
        select: { id: true },
      });

      // Operational ledger (D-075): immutable StockMovement, same transaction.
      await tx.stockMovement.create({
        data: {
          productId,
          variantId: null,
          deltaQty,
          quantityBefore: before,
          quantityAfter: after,
          reason,
          note: note ?? null,
          createdBy: ctx.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: ctx.userId,
          actorRole: actorRole(ctx.roles),
          action: 'INVENTORY_ADJUSTED',
          entityType: 'Product',
          entityId: productId,
          before: { stock: before },
          after: { stock: after, deltaQty, reason, note: note ?? null, productId },
        },
      });

      return {
        ok: true,
        productId,
        variantId: null,
        authority: 'Product',
        before,
        after,
        deltaQty,
      } as InventoryResult;
    });

    return result;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return { ok: false, type: 'not_found', message: 'Referenced record not found.' };
    }
    // Any other error aborts the transaction (automatic rollback) — surface 500.
    throw err;
  }
}

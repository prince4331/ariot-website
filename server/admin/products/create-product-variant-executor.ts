import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/server/db';
import type { AuthorizationContext } from '@/server/auth/permissions';
import { createVariantRequestSchema, optionCombinationKey } from './product-variant-schema';
import {
  actorRole,
  authorizeProductWrite,
  buildSnapshot,
  checkConcurrency,
  findSkuConflict,
  isUniqueConstraintError,
  loadCombinationKeys,
  loadProduct,
  type VariantMutationResult,
} from './product-variant-mutation-helpers';

/**
 * Create a product variant — Step 2.4.5 (executor).
 *
 * Runs inside the shared production authorization boundary
 * (`authorizeProductWrite`) against the resolved caller context, then enforces
 * strict validation, optimistic concurrency on Product.updatedAt, global SKU
 * uniqueness, and per-product option-combination uniqueness. Setting
 * isDefault=true clears other defaults in the same transaction. Writes an
 * audit log on success.
 *
 * Wrapper: `create-product-variant.ts` (session resolution).
 */

export async function createProductVariantWithContext(
  ctx: AuthorizationContext,
  rawInput: unknown,
): Promise<VariantMutationResult> {
  authorizeProductWrite(ctx);

  const parsed = createVariantRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, type: 'validation', message: 'Invalid input.' };
  }

  const { productId, expectedUpdatedAt, data } = parsed.data;

  const product = await loadProduct(productId);
  if (!product) {
    return { ok: false, type: 'not_found', message: 'Product not found.' };
  }

  const conflict = checkConcurrency(product.updatedAt, expectedUpdatedAt);
  if (conflict) return conflict;

  if (await findSkuConflict(data.sku, null)) {
    return {
      ok: false,
      type: 'duplicate',
      field: 'sku',
      message: 'This SKU is already in use.',
    };
  }

  const combinationKey = optionCombinationKey(data.optionValues);
  if ((await loadCombinationKeys(productId, null)).has(combinationKey)) {
    return {
      ok: false,
      type: 'duplicate',
      field: 'combination',
      message: 'A variant with these options already exists.',
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.productVariant.updateMany({
          where: { productId, deletedAt: null, isDefault: true },
          data: { isDefault: false },
        });
      }

      const variant = await tx.productVariant.create({
        data: {
          productId,
          name: data.name,
          sku: data.sku,
          optionValues: data.optionValues,
          priceMinor: data.priceMinor != null ? BigInt(data.priceMinor) : null,
          currency: data.currency,
          // Stock is initialized to zero here; it is subsequently changed ONLY
          // through the Inventory module (Step 2.4.6A1, D-073).
          stock: 0,
          barcode: data.barcode,
          isDefault: data.isDefault,
        },
        select: { id: true },
      });

      const p = await tx.product.update({
        where: { id: productId },
        data: { updatedBy: ctx.userId },
        select: { updatedAt: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: ctx.userId,
          actorRole: actorRole(ctx.roles),
          action: 'PRODUCT_VARIANT_CREATED',
          entityType: 'Product',
          entityId: productId,
          before: Prisma.DbNull,
          after: buildSnapshot(data, [
            'name',
            'sku',
            'optionValues',
            'priceMinor',
            'currency',
            'barcode',
            'isDefault',
          ]),
        },
      });

      return { variantId: variant.id, updatedAt: p.updatedAt };
    });

    return {
      ok: true,
      updatedAt: result.updatedAt.toISOString(),
      variantId: result.variantId,
    };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return {
        ok: false,
        type: 'duplicate',
        field: 'sku',
        message: 'This SKU is already in use.',
      };
    }
    throw err;
  }
}

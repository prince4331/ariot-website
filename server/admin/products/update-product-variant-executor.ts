import { prisma } from '@/server/db';
import type { AuthorizationContext } from '@/server/auth/permissions';
import { updateVariantRequestSchema, optionCombinationKey } from './product-variant-schema';
import {
  actorRole,
  authorizeProductWrite,
  buildSnapshot,
  checkConcurrency,
  detectChanges,
  findSkuConflict,
  isUniqueConstraintError,
  loadCombinationKeys,
  loadProduct,
  type CurrentVariant,
  type VariantMutationResult,
} from './product-variant-mutation-helpers';

/**
 * Update a product variant — Step 2.4.5 (executor).
 *
 * Runs inside the shared production authorization boundary
 * (`authorizeProductWrite`), then enforces strict validation, optimistic
 * concurrency on Product.updatedAt, global SKU uniqueness (excluding self),
 * and per-product option-combination uniqueness (excluding self). No-op
 * updates return success without touching the DB or writing an audit log.
 * Setting isDefault=true clears other defaults in the same transaction.
 *
 * Wrapper: `update-product-variant.ts` (session resolution).
 */

export async function updateProductVariantWithContext(
  ctx: AuthorizationContext,
  rawInput: unknown,
): Promise<VariantMutationResult> {
  authorizeProductWrite(ctx);

  const parsed = updateVariantRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, type: 'validation', message: 'Invalid input.' };
  }

  const { productId, variantId, expectedUpdatedAt, data } = parsed.data;

  const product = await loadProduct(productId);
  if (!product) {
    return { ok: false, type: 'not_found', message: 'Product not found.' };
  }

  const conflict = checkConcurrency(product.updatedAt, expectedUpdatedAt);
  if (conflict) return conflict;

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId, deletedAt: null },
    select: {
      id: true,
      name: true,
      sku: true,
      optionValues: true,
      priceMinor: true,
      currency: true,
      stock: true,
      barcode: true,
      isDefault: true,
    },
  });

  if (!variant) {
    return { ok: false, type: 'validation', message: 'Variant not found.' };
  }

  const current: CurrentVariant = {
    name: variant.name,
    sku: variant.sku,
    optionValues: variant.optionValues as Record<string, string>,
    priceMinor: variant.priceMinor,
    currency: variant.currency,
    stock: variant.stock,
    barcode: variant.barcode,
    isDefault: variant.isDefault,
  };

  const changes = detectChanges(current, data);

  if (changes.length === 0) {
    return { ok: true, updatedAt: product.updatedAt.toISOString(), variantId };
  }

  if (await findSkuConflict(data.sku, variantId)) {
    return {
      ok: false,
      type: 'duplicate',
      field: 'sku',
      message: 'This SKU is already in use.',
    };
  }

  const combinationKey = optionCombinationKey(data.optionValues);
  if ((await loadCombinationKeys(productId, variantId)).has(combinationKey)) {
    return {
      ok: false,
      type: 'duplicate',
      field: 'combination',
      message: 'A variant with these options already exists.',
    };
  }

  const beforeJson = buildSnapshot(current, changes);
  const afterJson = buildSnapshot(data, changes);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.productVariant.updateMany({
          where: { productId, deletedAt: null, isDefault: true, id: { not: variantId } },
          data: { isDefault: false },
        });
      }

      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          name: data.name,
          sku: data.sku,
          optionValues: data.optionValues,
          priceMinor: data.priceMinor != null ? BigInt(data.priceMinor) : null,
          currency: data.currency,
          barcode: data.barcode,
          isDefault: data.isDefault,
        },
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
          action: 'PRODUCT_VARIANT_UPDATED',
          entityType: 'Product',
          entityId: productId,
          before: beforeJson,
          after: afterJson,
        },
      });

      return p;
    });

    return { ok: true, updatedAt: updated.updatedAt.toISOString(), variantId };
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

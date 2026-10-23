import { NextRequest, NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError } from '@/server/auth/errors';
import { listStockMovements } from '@/server/admin/inventory/list-movements';

/**
 * /api/admin/inventory/movements — Step 2.4.6A3.
 *
 *  GET → list the immutable StockMovement ledger (requires `inventory.read`).
 *
 * Query params: `productId`, `variantId`, `cursor`, `pageSize` (1–100, default 20).
 * Returns the same envelope shape as the inventory list: `{ rows, pagination }`.
 * Authorization is enforced inside the service wrapper; this handler only
 * translates auth/result envelopes into HTTP responses. Database internals, raw
 * Prisma errors, and stack traces are never exposed.
 */

const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const productId = sp.get('productId') ?? undefined;
    const variantId = sp.get('variantId') ?? undefined;
    const cursor = sp.get('cursor') || null;

    const rawPageSize = sp.get('pageSize');
    let pageSize: number | undefined;
    if (rawPageSize != null && rawPageSize.trim() !== '') {
      const parsed = Number.parseInt(rawPageSize, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return NextResponse.json(
          { ok: false, message: 'pageSize must be a positive integer.' },
          { status: 400 },
        );
      }
      pageSize = Math.min(MAX_PAGE_SIZE, parsed);
    }

    const result = await listStockMovements({
      ...(productId ? { productId } : {}),
      ...(variantId ? { variantId } : {}),
      ...(cursor ? { cursor } : {}),
      ...(pageSize ? { pageSize } : {}),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: 'Authentication required.' }, { status: 401 });
    }
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ ok: false, message: 'Insufficient permissions.' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, message: 'Internal server error.' }, { status: 500 });
  }
}

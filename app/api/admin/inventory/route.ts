import { NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError } from '@/server/auth/errors';
import { listInventory } from '@/server/admin/inventory/list-inventory';
import { adjustInventory } from '@/server/admin/inventory/adjust-inventory';
import type { InventoryResult } from '@/server/admin/inventory/inventory-helpers';

/**
 * /api/admin/inventory — Step 2.4.6A1.
 *
 *  GET  → list inventory rows (requires `inventory.read`).
 *  POST → adjust stock (requires `inventory.adjust`).
 *
 * Authorization is enforced inside the service wrappers; this handler only
 * translates auth/result envelopes into HTTP responses.
 */

export async function GET() {
  try {
    const result = await listInventory();
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

function statusFor(result: InventoryResult): number {
  if (result.ok) return 200;
  switch (result.type) {
    case 'forbidden':
      return 403;
    case 'validation':
    case 'negative_stock':
      return 400;
    case 'not_found':
      return 404;
    default:
      return 500;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await adjustInventory(body);
    return NextResponse.json(result, { status: statusFor(result) });
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

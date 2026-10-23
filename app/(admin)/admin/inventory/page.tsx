import { redirect } from 'next/navigation';
import { AuthenticationError, AuthorizationError } from '@/server/auth/errors';
import { listInventory } from '@/server/admin/inventory/list-inventory';
import { AdminInventoryTable } from '@/components/admin/inventory/inventory-table';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Inventory',
  robots: { index: false, follow: false },
};

export default async function AdminInventoryPage() {
  let result;
  try {
    result = await listInventory();
  } catch (err) {
    if (err instanceof AuthenticationError) redirect('/sign-in');
    if (err instanceof AuthorizationError) redirect('/');
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-steel-50 text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-steel-400 mt-1 text-sm">
          Stock is managed here only. Product and variant editors cannot change stock. Adjustments
          are recorded in the audit log.
        </p>
      </div>

      <AdminInventoryTable rows={result.rows} canAdjust={result.canAdjust} />
    </div>
  );
}

import { InventoryTableSkeleton } from '@/components/admin/inventory/inventory-table-skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-steel-50 text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-steel-400 mt-1 text-sm">Stock is managed here only.</p>
      </div>
      <InventoryTableSkeleton />
    </div>
  );
}

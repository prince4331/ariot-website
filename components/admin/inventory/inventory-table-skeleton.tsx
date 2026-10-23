/**
 * Inventory table skeleton — Step 2.4.6A1.
 * Server-rendered loading state (mirrors the data-table skeleton pattern).
 */

const COLS = ['Product', 'SKU', 'Variant', 'Stock', 'Authority', 'Updated', ''];

export function InventoryTableSkeleton() {
  return (
    <div className="border-steel-800 bg-bg-raised overflow-hidden rounded-lg border">
      <div className="border-steel-800 grid grid-cols-7 gap-4 border-b px-4 py-3">
        {COLS.map((c, i) => (
          <div
            key={i}
            className="bg-steel-800/60 h-3 animate-pulse rounded"
            style={{ width: i === 0 ? '70%' : '50%' }}
          />
        ))}
      </div>
      {Array.from({ length: 6 }, (_, r) => (
        <div key={r} className="border-steel-800/40 grid grid-cols-7 gap-4 border-b px-4 py-4 last:border-b-0">
          {COLS.map((_, c) => (
            <div key={c} className="bg-steel-800/60 h-4 animate-pulse rounded" style={{ width: '60%' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

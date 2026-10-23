'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertCircle, History, Package, Pencil } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import type { InventoryRow, StockMovementRow } from '@/server/admin/inventory/inventory-schema';

/**
 * Inventory table — Step 2.4.6A1.
 *
 * Renders the inventory list (one row per authoritative stock bucket) using the
 * shared DataTable. The Adjust action (gated by `canAdjust`) opens a dialog that
 * posts to /api/admin/inventory; on success the server view is refreshed.
 */

interface Props {
  rows: InventoryRow[];
  canAdjust: boolean;
}

function formatOptions(options: Record<string, string> | null): string {
  if (!options) return '';
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function AdminInventoryTable({ rows, canAdjust }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [historyFor, setHistoryFor] = useState<InventoryRow | null>(null);
  const [historyRows, setHistoryRows] = useState<StockMovementRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const columns: ReadonlyArray<DataTableColumn<InventoryRow>> = [
    {
      id: 'product',
      header: 'Product',
      cell: (row) => <span className="text-steel-100">{row.productName}</span>,
    },
    {
      id: 'sku',
      header: 'SKU',
      cell: (row) => <span className="text-steel-300 font-mono text-xs">{row.sku}</span>,
    },
    {
      id: 'variant',
      header: 'Variant',
      cell: (row) =>
        row.variantLabel ? (
          <div className="flex flex-col">
            <span className="text-steel-200">{row.variantLabel}</span>
            {row.variantOptions && (
              <span className="text-steel-500 text-xs">{formatOptions(row.variantOptions)}</span>
            )}
          </div>
        ) : (
          <span className="text-steel-600 text-xs">—</span>
        ),
    },
    {
      id: 'stock',
      header: 'Stock',
      align: 'right',
      cell: (row) => (
        <span className="text-steel-100 tabular-nums">{row.stock}</span>
      ),
    },
    {
      id: 'authority',
      header: 'Authority',
      cell: (row) => (
        <span
          className={
            row.authority === 'Variant'
              ? 'rounded bg-cyan-400/10 px-2 py-0.5 text-xs font-medium text-cyan-300'
              : 'rounded bg-steel-800 px-2 py-0.5 text-xs font-medium text-steel-300'
          }
        >
          {row.authority}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      header: 'Updated',
      cell: (row) => <span className="text-steel-400 text-xs">{formatUpdated(row.updatedAt)}</span>,
    },
  ];

  const historyColumns: ReadonlyArray<DataTableColumn<StockMovementRow>> = [
    {
      id: 'createdAt',
      header: 'Date',
      cell: (row) => <span className="text-steel-400 text-xs">{formatUpdated(row.createdAt)}</span>,
    },
    {
      id: 'deltaQty',
      header: 'Change',
      align: 'right',
      cell: (row) => (
        <span
          className={
            row.deltaQty >= 0
              ? 'text-emerald-300 tabular-nums'
              : 'text-red-300 tabular-nums'
          }
        >
          {row.deltaQty >= 0 ? `+${row.deltaQty}` : row.deltaQty}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (row) => <span className="text-steel-200">{row.reason}</span>,
    },
    {
      id: 'before',
      header: 'Before',
      align: 'right',
      cell: (row) => <span className="text-steel-400 tabular-nums">{row.quantityBefore}</span>,
    },
    {
      id: 'after',
      header: 'After',
      align: 'right',
      cell: (row) => <span className="text-steel-100 tabular-nums">{row.quantityAfter}</span>,
    },
    {
      id: 'note',
      header: 'Note',
      cell: (row) => (
        <span className="text-steel-500 text-xs">{row.note ? row.note : '—'}</span>
      ),
    },
  ];

  function openAdjust(row: InventoryRow) {
    setEditing(row);
    setDelta('');
    setReason('');
    setNote('');
    setError(null);
  }

  async function openHistory(row: InventoryRow) {
    setHistoryFor(row);
    setHistoryRows([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const qs = new URLSearchParams({ productId: row.productId });
      if (row.variantId) qs.set('variantId', row.variantId);
      const res = await fetch(`/api/admin/inventory/movements?${qs.toString()}`);
      const data = await res.json();
      if (Array.isArray(data?.rows)) {
        setHistoryRows(data.rows);
      } else {
        setHistoryError(data?.message ?? 'Could not load stock history.');
      }
    } catch {
      setHistoryError('Network error. Please try again.');
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistory() {
    setHistoryFor(null);
  }

  async function submitAdjust() {
    if (!editing) return;
    setError(null);
    const deltaQty = Number(delta);
    if (!Number.isInteger(deltaQty)) {
      setError('Adjustment quantity must be a whole number.');
      return;
    }
    if (reason.trim().length === 0) {
      setError('A reason is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: editing.productId,
          variantId: editing.variantId ?? undefined,
          deltaQty,
          reason: reason.trim(),
          note: note.trim() ? note.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setEditing(null);
        router.refresh();
        return;
      }
      setError(data?.message ?? 'Adjustment failed.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        emptyState={{
          title: 'No inventory records found',
          description: 'Products and their variants will appear here once they exist.',
        }}
        rowActions={(row) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openHistory(row)}
              className="text-steel-400 rounded p-1.5 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              aria-label={`View stock history for ${row.productName}`}
            >
              <History className="h-4 w-4" aria-hidden />
            </button>
            {canAdjust && (
              <button
                type="button"
                onClick={() => openAdjust(row)}
                className="text-steel-400 rounded p-1.5 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                aria-label={`Adjust stock for ${row.productName}`}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        )}
      />

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Adjust stock for ${editing.productName}`}
          onClick={() => !submitting && setEditing(null)}
        >
          <div
            className="border-steel-800 bg-bg-raised w-full max-w-md rounded-lg border p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-steel-50 text-lg font-semibold">
              Adjust stock
            </h2>
            <p className="text-steel-400 mt-1 text-sm">
              {editing.productName} ·{' '}
              <span className="font-mono text-xs">{editing.sku}</span>
              {editing.variantLabel ? ` · ${editing.variantLabel}` : ''}
            </p>
            <p className="text-steel-400 mt-1 text-sm">
              Current stock: <span className="text-steel-100 tabular-nums">{editing.stock}</span>{' '}
              <span className="text-steel-500">({editing.authority} authority)</span>
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-steel-300 text-sm">Adjustment (± whole units)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  className="border-steel-700 bg-bg-elevated mt-1 w-full rounded-md border px-3 py-2 text-sm text-steel-100 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                  placeholder="e.g. 5 or -3"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-steel-300 text-sm">Reason (required)</span>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={120}
                  className="border-steel-700 bg-bg-elevated mt-1 w-full rounded-md border px-3 py-2 text-sm text-steel-100 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                  placeholder="e.g. Received shipment"
                />
              </label>
              <label className="block">
                <span className="text-steel-300 text-sm">Note (optional)</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="border-steel-700 bg-bg-elevated mt-1 w-full rounded-md border px-3 py-2 text-sm text-steel-100 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={submitting}
                className="rounded-md border border-steel-700 px-3 py-1.5 text-sm text-steel-300 hover:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAdjust}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Save adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Stock history for ${historyFor.productName}`}
          onClick={() => !historyLoading && closeHistory()}
        >
          <div
            className="border-steel-800 bg-bg-raised w-full max-w-2xl rounded-lg border p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-steel-50 text-lg font-semibold">Stock history</h2>
                <p className="text-steel-400 mt-1 text-sm">
                  {historyFor.productName} ·{' '}
                  <span className="font-mono text-xs">{historyFor.sku}</span>
                  {historyFor.variantLabel ? ` · ${historyFor.variantLabel}` : ''}
                </p>
                <p className="text-steel-400 mt-1 text-sm">
                  Current stock:{' '}
                  <span className="text-steel-100 tabular-nums">{historyFor.stock}</span>{' '}
                  <span className="text-steel-500">({historyFor.authority} authority)</span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeHistory}
                disabled={historyLoading}
                className="rounded-md border border-steel-700 px-3 py-1.5 text-sm text-steel-300 hover:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              {historyError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1">{historyError}</span>
                </div>
              )}

              <DataTable
                columns={historyColumns}
                rows={historyRows}
                getRowId={(row) => row.id}
                loading={historyLoading}
                skeletonRowCount={4}
                emptyState={{
                  title: 'No stock movements yet',
                  description: 'Adjustments to this item will appear here as an immutable record.',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <div className="border-steel-800 bg-bg-elevated rounded-lg border p-8 text-center">
          <Package className="text-steel-600 mx-auto h-8 w-8" aria-hidden />
        </div>
      )}
    </div>
  );
}

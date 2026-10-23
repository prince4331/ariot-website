'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Image as ImageIcon, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * MediaPicker — L3 blog cover selector.
 *
 * Reuses the existing media library search API (`GET /api/admin/media/search`)
 * — no uploads are built or altered here. Lists recent IMAGE assets; the
 * operator can search and pick one as the post cover.
 */

interface MediaOption {
  id: string;
  filename: string;
  url: string;
  altText: string | null;
}

interface MediaPickerProps {
  selectedId: string | null;
  /** Selected cover URL preview (resolved server-side). */
  selectedUrl: string | null;
  onSelect: (mediaId: string | null) => void;
  disabled?: boolean;
  label?: string;
}

export function MediaPicker({
  selectedId,
  selectedUrl,
  onSelect,
  disabled = false,
  label = 'Cover image',
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediaOption[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (search: string, cursor?: string) => {
    setLoading(true);
    setError(null);
    const requestId = ++requestIdRef.current;
    const params = new URLSearchParams({ kind: 'IMAGE' });
    if (search) params.set('q', search);
    if (cursor) params.set('cursor', cursor);
    params.set('limit', '24');

    try {
      const res = await fetch(`/api/admin/media/search?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (requestId !== requestIdRef.current) return; // stale response
      if (!res.ok || data.ok !== true) {
        setError('Media library unavailable.');
        return;
      }
      const fresh: MediaOption[] = (data.items ?? []).map(
        (item: { id: string; filename: string; url: string; altText: string | null }) => ({
          id: item.id,
          filename: item.filename,
          url: item.url,
          altText: item.altText,
        }),
      );
      setItems((prev) => (cursor ? [...prev, ...fresh] : fresh));
      setHasMore(Boolean(data.nextCursor));
      cursorRef.current = data.nextCursor ?? null;
    } catch {
      if (requestId === requestIdRef.current) setError('Media library unavailable.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void load(query, undefined), 300);
    return () => clearTimeout(timer);
  }, [query, open, load]);

  return (
    <div>
      <label className="text-steel-200 mb-1.5 block text-sm font-medium">{label}</label>
{/* Selected state / trigger */}
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="border-steel-700 bg-bg-base relative flex h-16 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border"
        >
          {selectedUrl ? (
            <div
              className="h-full w-full bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${selectedUrl})` }}
            />
          ) : (
            <ImageIcon className="text-steel-600 h-5 w-5" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen((v) => {
                if (v) return false;
                void load('', undefined);
                return true;
              });
            }}
            className="border-steel-700 bg-bg-elevated text-steel-200 hover:border-cyan-400 inline-flex w-fit items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            {selectedId ? 'Change cover' : 'Choose from media library'}
          </button>
          {selectedId && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(null)}
              className="text-steel-400 hover:text-steel-200 inline-flex w-fit items-center gap-1 text-xs focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              <X className="h-3 w-3" aria-hidden />
              Remove cover
            </button>
          )}
        </div>
      </div>

      {/* Pick panel */}
      {open && (
        <div className="border-steel-800 bg-bg-elevated mt-3 rounded-md border p-3">
          <input
            type="search"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search media…"
            aria-label="Search media library"
            className="border-steel-700 bg-bg-base text-steel-100 placeholder:text-steel-600 mb-3 h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          />

          {error ? (
            <p className="text-danger py-4 text-center text-sm">{error}</p>
          ) : items.length === 0 && !loading ? (
            <p className="text-steel-500 py-4 text-center text-sm">No images in the library yet.</p>
          ) : (
            <>
              <ul className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {items.map((item) => {
                  const selected = item.id === selectedId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(item.id)}
                        aria-label={item.altText ?? item.filename}
                        aria-pressed={selected}
                        title={item.altText ?? item.filename}
                        className={cn(
                          'border-steel-700 bg-bg-base group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded border transition-colors duration-200',
                          'focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none',
                          selected
                            ? 'border-cyan-400 ring-2 ring-cyan-400/30'
                            : 'hover:border-steel-500',
                        )}
                      >
                        <div
                          className="h-full w-full bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: `url(${item.url})` }}
                        />
                        {selected && (
                          <span className="bg-cyan-400 text-bg-base absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full">
                            <Check className="h-3 w-3" aria-hidden />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {hasMore && (
                <button
                  type="button"
                  disabled={disabled || loading}
                  onClick={() => void load(query, cursorRef.current ?? undefined)}
                  className="text-steel-400 hover:text-steel-200 mt-3 w-full text-center text-xs focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                >
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
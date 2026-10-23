'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ExternalLink } from 'lucide-react';
import { DataTable } from '@/components/admin/data-table';
import { AdminStatusChip } from '@/components/admin/admin-status-chip';
import type {
  DataTableColumn,
  DataTableCursorPagination,
  DataTableSort,
} from '@/components/admin/data-table-types';
import type {
  AdminBlogPostListItem,
  BlogListParams,
} from '@/server/admin/blog/list-blog-posts';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

type StatusVariant = 'neutral' | 'warning' | 'success' | 'inactive';
const STATUS_CHIP: Record<string, { label: string; variant: StatusVariant }> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  SCHEDULED: { label: 'Scheduled', variant: 'warning' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  ARCHIVED: { label: 'Archived', variant: 'inactive' },
};

// ── Toolbar ───────────────────────────────────────────────────────────────────

interface ToolbarProps {
  params: BlogListParams;
  categories: Array<{ id: string; name: string }>;
  isPending: boolean;
  onNavigate: (update: Partial<BlogListParams> & { resetCursor?: boolean }) => void;
}

function Toolbar({ params, categories, isPending, onNavigate }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1">
        <Search
          className="text-steel-500 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          aria-label="Search posts"
          placeholder="Title or slug…"
          defaultValue={params.q ?? ''}
          className="adm-td border-steel-700 bg-bg-elevated text-steel-100 placeholder:text-steel-600 h-9 w-full rounded-md border pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = (e.currentTarget.value ?? '').trim();
              onNavigate({ q: v || undefined, resetCursor: true });
            }
          }}
          onChange={(e) => {
            if (!e.currentTarget.value) onNavigate({ q: undefined, resetCursor: true });
          }}
        />
      </div>

      <select
        aria-label="Filter by status"
        value={params.status ?? ''}
        disabled={isPending}
        onChange={(e) =>
          onNavigate({
            status: (e.target.value || undefined) as BlogListParams['status'],
            resetCursor: true,
          })
        }
        className="adm-td border-steel-700 bg-bg-elevated text-steel-100 h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
      >
        <option value="">All statuses</option>
        <option value="DRAFT">Draft</option>
        <option value="SCHEDULED">Scheduled</option>
        <option value="PUBLISHED">Published</option>
        <option value="ARCHIVED">Archived</option>
      </select>

      <select
        aria-label="Filter by category"
        value={params.categoryId ?? ''}
        disabled={isPending}
        onChange={(e) =>
          onNavigate({ categoryId: e.target.value || undefined, resetCursor: true })
        }
        className="adm-td border-steel-700 bg-bg-elevated text-steel-100 h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

interface BlogTableProps {
  rows: AdminBlogPostListItem[];
  pagination: DataTableCursorPagination;
  categories: Array<{ id: string; name: string }>;
  params: BlogListParams;
  hasError: boolean;
  canWrite: boolean;
}

export function BlogTable({ rows, pagination, categories, params, hasError, canWrite }: BlogTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(update: Partial<BlogListParams> & { resetCursor?: boolean }) {
    const next: Record<string, string> = {};
    const q = 'q' in update ? update.q : params.q;
    const status = 'status' in update ? update.status : params.status;
    const categoryId = 'categoryId' in update ? update.categoryId : params.categoryId;
    const sort = update.sort ?? params.sort;
    const direction = update.direction ?? params.direction;

    if (q) next.q = q;
    if (status) next.status = status;
    if (categoryId) next.categoryId = categoryId;
    next.sort = sort;
    next.direction = direction;

    if (!update.resetCursor && update.cursor && update.cursorDirection) {
      next.cursor = update.cursor;
      next.cursorDirection = update.cursorDirection;
    }

    const qs = new URLSearchParams(next).toString();
    startTransition(() => router.push(`/admin/blog${qs ? `?${qs}` : ''}`));
  }

  function handleSort(sort: DataTableSort) {
    navigate({ sort: sort.key as BlogListParams['sort'], direction: sort.direction });
  }
const columns: ReadonlyArray<DataTableColumn<AdminBlogPostListItem>> = [
    {
      id: 'title',
      header: 'Title',
      sortKey: 'title',
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/blog/${row.id}`}
            className="text-cyan-300 hover:text-cyan-200 block truncate text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {row.title}
          </Link>
          <p className="text-steel-500 truncate font-mono text-[10px]">{row.slug}</p>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      hideBelow: 'md',
      cell: (row) => <span className="text-steel-300 text-sm">{row.categoryName}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: 'status',
      width: '120px',
      cell: (row) => {
        const s = STATUS_CHIP[row.status] ?? { label: row.status, variant: 'neutral' as const };
        return <AdminStatusChip variant={s.variant} label={s.label} size="sm" />;
      },
    },
    {
      id: 'published',
      header: 'Published',
      sortKey: 'publishedAt',
      width: '130px',
      hideBelow: 'sm',
      cell: (row) => (
        <span className="text-steel-400 font-mono text-xs">{formatDate(row.publishedAt)}</span>
      ),
    },
    {
      id: 'updated',
      header: 'Updated',
      sortKey: 'updatedAt',
      align: 'right',
      width: '130px',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="text-steel-400 font-mono text-xs">{formatDate(row.updatedAt)}</span>
      ),
    },
  ];

  const currentSort: DataTableSort | null = params.sort
    ? { key: params.sort, direction: params.direction }
    : null;

  const hasActiveFilters = !!params.q || !!params.status || !!params.categoryId;
  const emptyState = hasActiveFilters
    ? {
        title: 'No posts match these filters',
        description: 'Adjust or clear the current search and filters.',
      }
    : {
        title: 'No posts yet',
        description:
          'Create your first post and it will appear here. Published posts surface on the public blog, homepage, and update sections.',
      };

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      sort={currentSort}
      onSortChange={handleSort}
      pagination={pagination}
      onNextPage={() =>
        navigate({ cursor: pagination.nextCursor ?? undefined, cursorDirection: 'after' })
      }
      onPreviousPage={() =>
        navigate({ cursor: pagination.previousCursor ?? undefined, cursorDirection: 'before' })
      }
      loading={isPending}
      error={
        hasError
          ? { title: 'Unable to load posts', description: 'Refresh the page or try again.' }
          : null
      }
      emptyState={emptyState}
      toolbar={
        <Toolbar params={params} categories={categories} isPending={isPending} onNavigate={navigate} />
      }
      onRowActivate={(row) => router.push(`/admin/blog/${row.id}`)}
      rowActions={(row) => (
        <div className="flex items-center justify-end gap-1">
          {canWrite && (
            <Link
              href={`/admin/blog/${row.id}`}
              className="text-steel-300 hover:text-cyan-300 rounded px-2 py-1 text-xs font-medium hover:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              Edit
            </Link>
          )}
          {row.status === 'PUBLISHED' && (
            <Link
              href={`/blog/${row.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${row.title} on the public site`}
              className="text-steel-500 hover:text-steel-200 rounded p-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>
      )}
      caption="Blog & updates"
      className="min-h-[400px]"
    />
  );
}
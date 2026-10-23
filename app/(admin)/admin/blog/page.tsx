import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { AuthenticationError, AuthorizationError } from '@/server/auth/errors';
import {
  listBlogPosts,
  type BlogListParams,
  type BlogListSortKey,
} from '@/server/admin/blog/list-blog-posts';
import { BlogTable } from '@/components/admin/blog/blog-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blog & Updates',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  q?: string;
  status?: string;
  categoryId?: string;
  sort?: string;
  direction?: string;
  cursor?: string;
  cursorDirection?: string;
  pageSize?: string;
}>;

const ALLOWED_SORTS: BlogListSortKey[] = ['title', 'status', 'publishedAt', 'updatedAt'];
const ALLOWED_SIZES = [10, 20, 50] as const;

function parseParams(sp: Awaited<SearchParams>): BlogListParams {
  const sort = ALLOWED_SORTS.includes(sp.sort as BlogListSortKey)
    ? (sp.sort as BlogListSortKey)
    : 'updatedAt';
  const direction = sp.direction === 'asc' ? 'asc' : 'desc';
  const rawSize = Number(sp.pageSize);
  const pageSize = (ALLOWED_SIZES as readonly number[]).includes(rawSize)
    ? (rawSize as 10 | 20 | 50)
    : 20;
  return {
    q: sp.q?.trim().slice(0, 200) || undefined,
    status: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].includes(sp.status ?? '')
      ? (sp.status as BlogListParams['status'])
      : undefined,
    categoryId: sp.categoryId || undefined,
    sort,
    direction,
    cursor: sp.cursor || undefined,
    cursorDirection: sp.cursorDirection === 'before' ? 'before' : 'after',
    pageSize,
  };
}

export default async function AdminBlogPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const params = parseParams(sp);

  let result;
  try {
    result = await listBlogPosts(params);
  } catch (err) {
    if (err instanceof AuthenticationError) redirect('/sign-in');
    if (err instanceof AuthorizationError) redirect('/');
    result = {
      error: true as const,
      items: [],
      pagination: { hasNextPage: false, hasPreviousPage: false },
      categories: [],
      canWrite: false,
    };
  }

  const hasError = 'error' in result;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-steel-50 text-2xl font-semibold tracking-tight">
            Blog &amp; Updates
          </h1>
          <p className="text-steel-400 mt-1 text-sm">
            Create, edit, and publish blog posts and public updates. Published posts appear on the
            public blog, homepage, Robotics, IoT/Solutions, and Research sections.
          </p>
        </div>
        {!hasError && result.canWrite && (
          <Link
            href="/admin/blog/new"
            className="bg-cyan-400 text-bg-base inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-200 hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New post
          </Link>
        )}
      </div>

      <BlogTable
        rows={hasError ? [] : result.items}
        pagination={hasError ? { hasNextPage: false, hasPreviousPage: false } : result.pagination}
        categories={hasError ? [] : result.categories}
        params={params}
        hasError={hasError}
        canWrite={hasError ? false : result.canWrite}
      />
    </div>
  );
}
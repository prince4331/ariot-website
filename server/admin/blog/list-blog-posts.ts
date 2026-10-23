import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/server/db';
import { requirePermission } from '@/server/auth/permissions';
import { hasPermission, PERMISSIONS } from '@/server/auth/permission-catalog';
import type { DataTableCursorPagination } from '@/components/admin/data-table-types';

/**
 * Server-only admin Blog/Updates list — L3 Minimal Marketing CMS.
 *
 * Authorization: requires `blog.read` (checked before any DB access). The
 * admin layout RBAC guard is the first line of defence; this function is a
 * second, per-operation server-side check.
 *
 * Query constraints:
 *   - Soft-deleted posts are always excluded.
 *   - Cursor pagination uses BlogPost `id` as the stable unique tie-breaker.
 *   - Search is ILIKE on title/slug (no searchVector — see corrective C.2).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type BlogListSortKey = 'title' | 'status' | 'publishedAt' | 'updatedAt';

export interface BlogListParams {
  q?: string;
  status?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  categoryId?: string;
  sort: BlogListSortKey;
  direction: 'asc' | 'desc';
  cursor?: string;
  cursorDirection: 'after' | 'before';
  pageSize: 10 | 20 | 50;
}

export interface AdminBlogPostListItem {
  id: string;
  slug: string;
  title: string;
  categoryId: string;
  categoryName: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  updatedAt: string;
}

export interface AdminBlogListResult {
  items: AdminBlogPostListItem[];
  pagination: DataTableCursorPagination;
  categories: Array<{ id: string; name: string }>;
  /** Whether the caller holds `blog.write` — gates the Create/Edit controls. */
  canWrite: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type BlogRow = {
  id: string;
  slug: string;
  title: string;
  categoryId: string;
  category: { name: string };
  status: string;
  publishedAt: Date | null;
  updatedAt: Date;
};

function buildOrderBys(
  sort: BlogListSortKey,
  direction: 'asc' | 'desc',
): {
  forward: Prisma.BlogPostOrderByWithRelationInput[];
  backward: Prisma.BlogPostOrderByWithRelationInput[];
} {
  const rev: 'asc' | 'desc' = direction === 'asc' ? 'desc' : 'asc';
  const fwdField: Prisma.BlogPostOrderByWithRelationInput =
    sort === 'title'
      ? { title: direction }
      : sort === 'status'
        ? { status: direction }
        : sort === 'publishedAt'
          ? { publishedAt: direction }
          : { updatedAt: direction };
  const bwdField: Prisma.BlogPostOrderByWithRelationInput =
    sort === 'title'
      ? { title: rev }
      : sort === 'status'
        ? { status: rev }
        : sort === 'publishedAt'
          ? { publishedAt: rev }
          : { updatedAt: rev };
  return {
    forward: [fwdField, { id: 'asc' }],
    backward: [bwdField, { id: 'desc' }],
  };
}

const SELECT = {
  id: true,
  slug: true,
  title: true,
  categoryId: true,
  category: { select: { name: true } },
  status: true,
  publishedAt: true,
  updatedAt: true,
} as const;

function toDto(p: BlogRow): AdminBlogPostListItem {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    categoryId: p.categoryId,
    categoryName: p.category.name,
    status: p.status as AdminBlogPostListItem['status'],
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    updatedAt: p.updatedAt.toISOString(),
  };
}
// ── Main function ────────────────────────────────────────────────────────────

export async function listBlogPosts(params: BlogListParams): Promise<AdminBlogListResult> {
  const ctx = await requirePermission(PERMISSIONS.blog.read);
  const canWrite = hasPermission(ctx.permissions, PERMISSIONS.blog.write);

  const { q, status, categoryId, sort, direction, cursor, cursorDirection, pageSize } = params;

  const where: Prisma.BlogPostWhereInput = {
    deletedAt: null,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(q &&
      q.length > 0 && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      }),
  };

  const { forward, backward } = buildOrderBys(sort, direction);

  let items: AdminBlogPostListItem[] = [];
  let hasPreviousPage = false;
  let hasNextPage = false;

  const fetchForward = async (cursorId?: string): Promise<BlogRow[]> => {
    return prisma.blogPost.findMany({
      where,
      orderBy: forward,
      ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
      take: pageSize + 1,
      select: SELECT,
    });
  };

  const fetchBackward = async (cursorId: string): Promise<BlogRow[]> => {
    return prisma.blogPost.findMany({
      where,
      orderBy: backward,
      cursor: { id: cursorId },
      skip: 1,
      take: pageSize + 1,
      select: SELECT,
    });
  };

  try {
    if (cursorDirection === 'before' && cursor) {
      const reversed = await fetchBackward(cursor);
      const hasMoreBefore = reversed.length > pageSize;
      const page = reversed.slice(0, pageSize).reverse();
      items = page.map(toDto);
      hasPreviousPage = hasMoreBefore;
      hasNextPage = true;
    } else {
      const fetched = await fetchForward(cursor);
      hasNextPage = fetched.length > pageSize;
      const page = fetched.slice(0, pageSize);
      items = page.map(toDto);
      hasPreviousPage = cursor != null;
    }
  } catch (err) {
    // P2001: cursor record not found (stale/deleted). Fall back to first page.
    if ((err as { code?: string }).code === 'P2001') {
      const fetched = await fetchForward(undefined);
      hasNextPage = fetched.length > pageSize;
      items = fetched.slice(0, pageSize).map(toDto);
      hasPreviousPage = false;
    } else {
      throw err;
    }
  }

  const categories = await prisma.blogCategory.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return {
    items,
    pagination: {
      hasNextPage,
      hasPreviousPage,
      nextCursor: hasNextPage || items.length > 0 ? (items[items.length - 1]?.id ?? null) : null,
      previousCursor: items[0]?.id ?? null,
    },
    categories,
    canWrite,
  };
}
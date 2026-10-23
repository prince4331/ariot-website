import type { PrismaClient } from '@/lib/generated/prisma/client';
import { prisma } from '@/server/db';
import { getMediaStorageProvider } from '@/server/storage/get-media-storage-provider';
import {
  PUBLIC_BLOG_TAG,
  publicBlogPostTag,
  taggedCache,
} from './tagged-cache';

/**
 * Public BlogPost queries — L3 Minimal Marketing CMS.
 *
 * The single server-side source of truth for DB-backed public blog content.
 * Used by `/blog`, `/blog/[slug]`, the homepage updates section, Robotics
 * updates, IoT/Solutions updates, Research notes, and the sitemap.
 *
 * Public visibility contract (launch):
 *   - status = PUBLISHED only (drafts/scheduled/archived never leak).
 *   - `deletedAt` IS NULL.
 *   - The post's category must be published and not soft-deleted.
 *   - Ordering: newest `publishedAt` first; undated published posts sort
 *     after dated ones (NULLS LAST), tied by `createdAt` descending so the
 *     list stays stable while an admin edits an older post.
 */

type DbClient = Pick<PrismaClient, 'blogPost'>;

/** Fallback author shown for the seeded engineering-team posts. */
const FALLBACK_AUTHOR = 'ARIOT Engineering Team';

const mediaStorageProvider = getMediaStorageProvider();

function resolveMediaUrl(storageKey?: string, cdnUrl?: string | null): string | null {
  if (!storageKey) return null;
  return mediaStorageProvider.getPublicUrl(storageKey, cdnUrl ?? null);
}

function resolveAuthorName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.startsWith('[') || trimmed.endsWith(']')) return FALLBACK_AUTHOR;
  return trimmed;
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface PublicBlogPostListItem {
  slug: string;
  title: string;
  excerpt: string | null;
  categoryName: string;
  categorySlug: string;
  readingTimeMinutes: number;
  publishedAt: string | null;
  coverUrl: string | null;
  tags: string[];
}

export interface PublicBlogPostDetail extends PublicBlogPostListItem {
  body: string;
  authorName: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  updatedAt: string;
  isLab: boolean;
}

// ── Shared filters ───────────────────────────────────────────────────────────

function publishedWhere() {
  return {
    status: 'PUBLISHED',
    deletedAt: null,
    category: { isPublished: true, deletedAt: null },
  } as const;
}

const LIST_SELECT = {
  slug: true,
  title: true,
  excerpt: true,
  readingTimeMinutes: true,
  publishedAt: true,
  tags: true,
  category: { select: { name: true, slug: true } },
  coverImage: { select: { storageKey: true, cdnUrl: true } },
} as const;

const detailSelect = {
  ...LIST_SELECT,
  body: true,
  seoTitle: true,
  seoDescription: true,
  updatedAt: true,
  isLab: true,
  ogImage: { select: { storageKey: true, cdnUrl: true } },
  author: { select: { name: true } },
} as const;

function toListItem(p: {
  slug: string;
  title: string;
  excerpt: string | null;
  readingTimeMinutes: number;
  publishedAt: Date | null;
  tags: unknown;
  category: { name: string; slug: string };
  coverImage: { storageKey: string; cdnUrl: string | null } | null;
}): PublicBlogPostListItem {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    categoryName: p.category.name,
    categorySlug: p.category.slug,
    readingTimeMinutes: p.readingTimeMinutes,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    coverUrl: resolveMediaUrl(p.coverImage?.storageKey, p.coverImage?.cdnUrl),
    tags: normalizeTags(p.tags),
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export interface ListPublishedPostsOptions {
  /** Maximum rows. The homepage uses 3. */
  limit?: number;
  /** Filter by category slug (e.g. 'robotics-rd'). */
  categorySlug?: string;
  /** Exclude a specific slug (related-posts helper). */
  excludeSlug?: string;
}

export async function listPublishedPosts(
  options: ListPublishedPostsOptions = {},
  db: DbClient = prisma,
): Promise<PublicBlogPostListItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 50);

  // A caller-supplied `db` is a test seam (disposable database). Those reads
  // must NOT be cached — the cache is shared process-wide and would serve one
  // database's rows for another.
  if (db !== prisma) {
    return readPublishedPosts(options, limit, db);
  }

  return taggedCache(
    ['blog', 'list', String(limit), options.categorySlug ?? '', options.excludeSlug ?? ''],
    [PUBLIC_BLOG_TAG],
    () => readPublishedPosts(options, limit, prisma),
  );
}

async function readPublishedPosts(
  options: ListPublishedPostsOptions,
  limit: number,
  db: DbClient,
): Promise<PublicBlogPostListItem[]> {
  const where = {
    ...publishedWhere(),
    ...(options.categorySlug ? { category: { ...publishedWhere().category, slug: options.categorySlug } } : {}),
    ...(options.excludeSlug ? { slug: { not: options.excludeSlug } } : {}),
  };

  const rows = await db.blogPost.findMany({
    where,
    select: LIST_SELECT,
    orderBy: [
      // Newest published content first; undated posts sort after dated ones.
      { publishedAt: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
    take: limit,
  });

  return rows.map(toListItem);
}

export async function getPublishedPostBySlug(
  slug: string,
  db: DbClient = prisma,
): Promise<PublicBlogPostDetail | null> {
  // Test seam — see `listPublishedPosts`. Not cached.
  if (db !== prisma) {
    return readPublishedPostBySlug(slug, db);
  }

  return taggedCache(
    ['blog', 'post', slug],
    [PUBLIC_BLOG_TAG, publicBlogPostTag(slug)],
    () => readPublishedPostBySlug(slug, prisma),
  );
}

async function readPublishedPostBySlug(
  slug: string,
  db: DbClient,
): Promise<PublicBlogPostDetail | null> {
  const row = await db.blogPost.findFirst({
    where: { slug, ...publishedWhere() },
    select: detailSelect,
  });

  if (!row) return null;

  return {
    ...toListItem(row),
    body: row.body,
    authorName: resolveAuthorName(row.author?.name),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ogImageUrl: resolveMediaUrl(row.ogImage?.storageKey, row.ogImage?.cdnUrl),
    updatedAt: row.updatedAt.toISOString(),
    isLab: row.isLab,
  };
}

/** Latest published posts for the homepage (3) and section teasers. */
export function getLatestPublishedPosts(limit = 3): Promise<PublicBlogPostListItem[]> {
  return listPublishedPosts({ limit });
}

/** Published posts that belong to a category slug — Robotics / IoT / R&D. */
export function getPublishedPostsByCategory(
  categorySlug: string,
  limit = 3,
): Promise<PublicBlogPostListItem[]> {
  return listPublishedPosts({ categorySlug, limit });
}

// ── Safe wrappers (marketing-page resilience) ────────────────────────────────

/**
 * Marketing pages (homepage, /blog, /robotics, /research, /solutions) must
 * render even when the database is unreachable (e.g. a static deploy without
 * DATABASE_URL, or a transient outage during ISR revalidation). These wrappers
 * degrade to an honest empty result instead of crashing the page. The blog
 * detail page intentionally does NOT use a safe wrapper — a missing post must
 * 404 and a real failure should surface as an error, not silent emptiness.
 */

export async function safeListPublishedPosts(
  options: ListPublishedPostsOptions = {},
): Promise<PublicBlogPostListItem[]> {
  try {
    return await listPublishedPosts(options);
  } catch {
    return [];
  }
}

export async function safeGetLatestPublishedPosts(
  limit = 3,
): Promise<PublicBlogPostListItem[]> {
  return safeListPublishedPosts({ limit });
}

export async function safeGetPublishedPostsByCategory(
  categorySlug: string,
  limit = 3,
): Promise<PublicBlogPostListItem[]> {
  return safeListPublishedPosts({ categorySlug, limit });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === 'string');
  return [];
}
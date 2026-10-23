import { prisma } from '@/server/db';
import { requirePermission } from '@/server/auth/permissions';
import { hasPermission, PERMISSIONS } from '@/server/auth/permission-catalog';
import { getMediaStorageProvider } from '@/server/storage/get-media-storage-provider';

/**
 * Server-only BlogPost editor loader — L3 Minimal Marketing CMS.
 *
 * Requires `blog.read`. Returns a fully-formed editor DTO plus the available
 * BlogCategory records (for the category select) and a `canEdit` flag derived
 * from the caller's `blog.write` permission — so read-only operators see the
 * editor in read-only mode and never receive write controls.
 */

export interface AdminBlogPostEditorDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  categoryId: string;
  tags: string[];
  coverImageId: string | null;
  coverUrl: string | null;
  ogImageId: string | null;
  ogUrl: string | null;
  readingTimeMinutes: number;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isLab: boolean;
  createdAt: string;
  updatedAt: string;
  authorName: string | null;
  canEdit: boolean;
}

export interface AdminBlogEditorPayload {
  post: AdminBlogPostEditorDto;
  categories: Array<{ id: string; name: string; slug: string; isPublished: boolean }>;
}

const mediaStorageProvider = getMediaStorageProvider();

function resolveMediaUrl(
  storageKey: string | undefined,
  cdnUrl: string | null | undefined,
): string | null {
  if (!storageKey) return null;
  return mediaStorageProvider.getPublicUrl(storageKey, cdnUrl ?? null);
}

export interface AdminBlogEditorCategories {
  categories: Array<{ id: string; name: string; slug: string; isPublished: boolean }>;
  canWrite: boolean;
}

/** Pure category + permission loader used by the "New post" page. */
export async function getBlogEditorCategories(): Promise<AdminBlogEditorCategories> {
  const ctx = await requirePermission(PERMISSIONS.blog.read);
  const canWrite = hasPermission(ctx.permissions, PERMISSIONS.blog.write);

  const categories = await prisma.blogCategory.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, isPublished: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });

  return { categories, canWrite };
}

export async function getBlogPostForEditor(
  postId: string,
): Promise<AdminBlogEditorPayload | null> {
  const ctx = await requirePermission(PERMISSIONS.blog.read);
  const canEdit = hasPermission(ctx.permissions, PERMISSIONS.blog.write);

  const post = await prisma.blogPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      categoryId: true,
      tags: true,
      coverImageId: true,
      ogImageId: true,
      readingTimeMinutes: true,
      status: true,
      publishedAt: true,
      seoTitle: true,
      seoDescription: true,
      isLab: true,
      createdAt: true,
      updatedAt: true,
      coverImage: { select: { storageKey: true, cdnUrl: true } },
      ogImage: { select: { storageKey: true, cdnUrl: true } },
      author: { select: { name: true } },
    },
  });

  if (!post) return null;

  const coverUrl = resolveMediaUrl(post.coverImage?.storageKey, post.coverImage?.cdnUrl);
  const ogUrl = resolveMediaUrl(post.ogImage?.storageKey, post.ogImage?.cdnUrl);

  const categories = await prisma.blogCategory.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, isPublished: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });

  return {
    post: {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      categoryId: post.categoryId,
      tags: normalizeTags(post.tags),
      coverImageId: post.coverImageId,
      coverUrl,
      ogImageId: post.ogImageId,
      ogUrl,
      readingTimeMinutes: post.readingTimeMinutes,
      status: post.status as AdminBlogPostEditorDto['status'],
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      isLab: post.isLab,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      authorName: post.author?.name ?? null,
      canEdit,
    },
    categories,
  };
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === 'string');
  return [];
}
import type { PrismaClient, RoleKey } from '@/lib/generated/prisma/client';
import { prisma } from '@/server/db';
import { requirePermission } from '@/server/auth/permissions';
import { PERMISSIONS } from '@/server/auth/permission-catalog';
import { createAuthorizedBlogWriter } from './authorized-blog-mutation';
import {
  estimateReadingTime,
  updateBlogPostRequestSchema,
  type BlogPostEditorInput,
  type BlogStatusValue,
} from './blog-schema';

/**
 * BlogPost update — L3 Minimal Marketing CMS.
 *
 * Guarantees:
 *   - `blog.write` authorization at the server boundary.
 *   - Strict Zod contract; unknown fields rejected (no mass assignment).
 *   - Optimistic concurrency via `expectedUpdatedAt` token.
 *   - Duplicate slug prevention.
 *   - Safe publication transitions:
 *       → PUBLISHED  stamps `publishedAt` with the server clock when a draft
 *                    is first published; the existing date is preserved for a
 *                    publish→publish save.
 *       ← leaving PUBLISHED clears `publishedAt` so a re-publish gets a new
 *         honest date and no stale date is shown for an unpublished post.
 *   - No-op saves write nothing and create no audit row.
 *   - Audit logging for actual successful changes only, using safe summaries
 *     (never the body).
 */

type DbClient = Pick<PrismaClient, 'blogPost' | 'blogCategory' | 'auditLog'>;

export type UpdateBlogPostResult =
  | {
      ok: true;
      updatedAt: string;
      changedFields: string[];
      noChanges: boolean;
      /** Post slug after the update — used for targeted revalidation. */
      slug: string;
      /** Slug before the update (equal to `slug` when unchanged). */
      previousSlug: string;
    }
  | {
      ok: false;
      type: 'validation' | 'conflict' | 'duplicate' | 'not_found' | 'forbidden' | 'error';
      message?: string;
      fieldErrors?: Record<string, string[]>;
    };

// ── Production authorized writer ─────────────────────────────────────────────

export const updateBlogPost = createAuthorizedBlogWriter(
  async () => {
    const ctx = await requirePermission(PERMISSIONS.blog.write);
    return { userId: ctx.userId, roles: ctx.roles as string[] };
  },
  (rawInput, actor) => executeUpdateBlogPost(rawInput, actor),
);

// ── Internal service (directly testable against a disposable DB) ─────────────

interface CurrentBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  categoryId: string;
  tags: unknown;
  coverImageId: string | null;
  ogImageId: string | null;
  readingTimeMinutes: number;
  status: string;
  publishedAt: Date | null;
  isLab: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
}

export async function executeUpdateBlogPost(
  rawInput: unknown,
  actor: { userId: string; roles: string[] },
  db: DbClient = prisma,
): Promise<UpdateBlogPostResult> {
  // 1. Parse + validate (strict — unknown fields rejected).
  const parsed = updateBlogPostRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      type: 'validation',
      message: 'Some fields are invalid.',
      fieldErrors: collectFieldErrors(parsed),
    };
  }

  const { postId, expectedUpdatedAt, data } = parsed.data;

  // 2. Load current state (not soft-deleted).
  const current = await db.blogPost.findFirst({
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
      isLab: true,
      seoTitle: true,
      seoDescription: true,
      updatedAt: true,
    },
  });
  if (!current) {
    return { ok: false, type: 'not_found', message: 'Blog post not found.' };
  }

  // 3. Optimistic concurrency.
  if (current.updatedAt.toISOString() !== expectedUpdatedAt) {
    return {
      ok: false,
      type: 'conflict',
      message: 'This post was updated elsewhere. Reload the latest version.',
    };
  }

  // 4. Duplicate slug prevention (excluding this post).
  const duplicate = await db.blogPost.findFirst({
    where: { slug: data.slug, id: { not: postId }, deletedAt: null },
    select: { id: true },
  });
  if (duplicate) {
    return { ok: false, type: 'duplicate', message: 'This slug is already in use.' };
  }

  // 5. Category must exist.
  const category = await db.blogCategory.findFirst({
    where: { id: data.categoryId, deletedAt: null },
    select: { id: true },
  });
  if (!category) {
    return {
      ok: false,
      type: 'validation',
      message: 'Category is invalid.',
      fieldErrors: { categoryId: ['The selected category does not exist.'] },
    };
  }

  // 6. Safe publication transition (server-derived date).
  const nextStatus = data.status;
  const nextPublishedAt = derivePublishedAt(current.status, nextStatus, current.publishedAt);

  const readingTimeMinutes = data.readingTimeMinutes ?? estimateReadingTime(data.body);

  // 7. Detect changes — a true no-op writes nothing and audits nothing.
  const changes = detectChanges(
    current,
    data,
    readingTimeMinutes,
    nextPublishedAt?.toISOString() ?? null,
  );
  if (changes.length === 0) {
    return {
      ok: true,
      updatedAt: current.updatedAt.toISOString(),
      changedFields: [],
      noChanges: true,
      slug: current.slug,
      previousSlug: current.slug,
    };
  }
// 8. Apply the update.
  const updated = await db.blogPost.update({
    where: { id: postId },
    data: {
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt ?? null,
      body: data.body,
      categoryId: data.categoryId,
      tags: data.tags,
      coverImageId: data.coverImageId ?? null,
      ogImageId: data.ogImageId ?? null,
      readingTimeMinutes,
      status: nextStatus,
      publishedAt: nextPublishedAt,
      isLab: data.isLab ?? false,
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
    },
  });

  // 9. Audit — one row describing the successful change (safe summary only).
  await db.auditLog.create({
    data: {
      actorId: actor.userId,
      actorRole: actor.roles[0] ? (actor.roles[0] as RoleKey) : null,
      action: deriveAuditAction(current.status as BlogStatusValue, nextStatus),
      entityType: 'BlogPost',
      entityId: postId,
      before: {
        title: current.title,
        slug: current.slug,
        status: current.status,
      },
      after: {
        title: updated.title,
        slug: updated.slug,
        status: updated.status,
        publishedAt: updated.publishedAt ? updated.publishedAt.toISOString() : null,
        changed: changes,
      },
    },
  });

  return {
    ok: true,
    updatedAt: updated.updatedAt.toISOString(),
    changedFields: changes,
    noChanges: false,
    slug: updated.slug,
    previousSlug: current.slug,
  };
}

// ── Lifecycle helpers ────────────────────────────────────────────────────────

function derivePublishedAt(
  previousStatus: string,
  nextStatus: string,
  currentPublishedAt: Date | null,
): Date | null {
  if (nextStatus === 'PUBLISHED') {
    // First publish → honest server timestamp; re-save while published keeps date.
    return previousStatus === 'PUBLISHED' ? currentPublishedAt : new Date();
  }
  if (previousStatus === 'PUBLISHED') {
    // Leaving PUBLISHED (draft/archive/schedule) clears the public date.
    return null;
  }
  return currentPublishedAt;
}

function deriveAuditAction(previousStatus: BlogStatusValue, nextStatus: BlogStatusValue): string {
  const wasPublished = previousStatus === 'PUBLISHED';
  const isPublished = nextStatus === 'PUBLISHED';
  if (isPublished && !wasPublished) return 'BLOG_POST_PUBLISHED';
  if (wasPublished && !isPublished) return 'BLOG_POST_UNPUBLISHED';
  return 'BLOG_POST_UPDATED';
}

function detectChanges(
  current: CurrentBlogPost,
  data: BlogPostEditorInput,
  readingTimeMinutes: number,
  nextPublishedAtIso: string | null,
): string[] {
  const changed: string[] = [];
  if (current.title !== data.title) changed.push('title');
  if (current.slug !== data.slug) changed.push('slug');
  if ((current.excerpt ?? null) !== (data.excerpt ?? null)) changed.push('excerpt');
  if (current.body !== data.body) changed.push('body');
  if (current.categoryId !== data.categoryId) changed.push('categoryId');
  if (JSON.stringify(normalizeTags(current.tags)) !== JSON.stringify(data.tags))
    changed.push('tags');
  if ((current.coverImageId ?? null) !== (data.coverImageId ?? null)) changed.push('coverImageId');
  if ((current.ogImageId ?? null) !== (data.ogImageId ?? null)) changed.push('ogImageId');
  if (current.readingTimeMinutes !== readingTimeMinutes) changed.push('readingTimeMinutes');
  if (current.status !== data.status) changed.push('status');
  if ((current.publishedAt?.toISOString() ?? null) !== nextPublishedAtIso)
    changed.push('publishedAt');
  if (current.isLab !== (data.isLab ?? false)) changed.push('isLab');
  if ((current.seoTitle ?? null) !== (data.seoTitle ?? null)) changed.push('seoTitle');
  if ((current.seoDescription ?? null) !== (data.seoDescription ?? null))
    changed.push('seoDescription');
  return changed;
}

function normalizeTags(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}

function collectFieldErrors(parsed: {
  error: { issues: Array<{ path: PropertyKey[]; message: string }> };
}): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fieldErrors[key]) fieldErrors[key] = [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}
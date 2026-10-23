import type { PrismaClient, RoleKey } from '@/lib/generated/prisma/client';
import { prisma } from '@/server/db';
import { requirePermission } from '@/server/auth/permissions';
import { PERMISSIONS } from '@/server/auth/permission-catalog';
import { createAuthorizedBlogWriter } from './authorized-blog-mutation';
import {
  createBlogPostRequestSchema,
  estimateReadingTime,
} from './blog-schema';

/**
 * BlogPost creation — L3 Minimal Marketing CMS.
 *
 * Security properties:
 *   - Authorization: requires `blog.write` (server boundary).
 *   - No mass assignment: the Zod schema is strict and rejects unknown fields
 *     (no client-supplied actor/role/permission/userId).
 *   - authorId is always derived from the authenticated session.
 *   - Duplicate slug prevention against the unique DB constraint.
 *   - publishedAt: stamped with the server clock ONLY on publish; never
 *     client-supplied (no fake dates).
 *   - AuditLog: one BLOG_POST_CREATED row with a safe summary (no body dump).
 */

type DbClient = Pick<
  PrismaClient,
  'blogPost' | 'blogCategory' | 'auditLog'
>;

export type CreateBlogPostResult =
  | { ok: true; id: string; slug: string; updatedAt: string }
  | {
      ok: false;
      type: 'validation' | 'duplicate' | 'forbidden' | 'error';
      message?: string;
      fieldErrors?: Record<string, string[]>;
    };

// ── Production authorized writer ─────────────────────────────────────────────

export const createBlogPost = createAuthorizedBlogWriter(
  async () => {
    const ctx = await requirePermission(PERMISSIONS.blog.write);
    return { userId: ctx.userId, roles: ctx.roles as string[] };
  },
  (rawInput, actor) => executeCreateBlogPost(rawInput, actor),
);

// ── Internal service (directly testable against a disposable DB) ─────────────

export async function executeCreateBlogPost(
  rawInput: unknown,
  actor: { userId: string; roles: string[] },
  db: DbClient = prisma,
): Promise<CreateBlogPostResult> {
  const parsed = createBlogPostRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      type: 'validation',
      message: 'Some fields are invalid.',
      fieldErrors: collectFieldErrors(parsed),
    };
  }

  const { data } = parsed.data;

  // Duplicate slug prevention (belt + braces over the unique index).
  const existing = await db.blogPost.findFirst({
    where: { slug: data.slug, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, type: 'duplicate', message: 'This slug is already in use.' };
  }

  // Category must exist and not be soft-deleted.
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

  const readingTimeMinutes = data.readingTimeMinutes ?? estimateReadingTime(data.body);
  const status = data.status;
  const publishedAt = status === 'PUBLISHED' ? new Date() : null;

  const created = await db.blogPost.create({
    data: {
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt ?? null,
      body: data.body,
      categoryId: data.categoryId,
      tags: data.tags,
      coverImageId: data.coverImageId ?? null,
      ogImageId: data.ogImageId ?? null,
      authorId: actor.userId,
      readingTimeMinutes,
      status,
      publishedAt,
      isLab: data.isLab ?? false,
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
    },
  });

  await db.auditLog.create({
    data: {
      actorId: actor.userId,
      actorRole: actor.roles[0] ? (actor.roles[0] as RoleKey) : null,
      action: 'BLOG_POST_CREATED',
      entityType: 'BlogPost',
      entityId: created.id,
      after: {
        title: created.title,
        slug: created.slug,
        status: created.status,
        categoryId: created.categoryId,
      },
    },
  });

  return {
    ok: true,
    id: created.id,
    slug: created.slug,
    updatedAt: created.updatedAt.toISOString(),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
import { z } from 'zod';

/**
 * BlogPost editor validation — L3 Minimal Marketing CMS.
 *
 * Server-authoritative validation for the admin Blog/Updates editor.
 * `.strict()` rejects unknown fields (including any client-supplied actor,
 * role, permission, or lifecycle fields that are not part of the editor).
 *
 * Publication lifecycle is intentionally NOT part of the client payload:
 *   - `publishedAt` is derived server-side (now() on publish, null on
 *     unpublish) so administrative input can never fabricate a public date.
 *   - `authorId` is always resolved from the authenticated session.
 */

// ── Slug normalization ───────────────────────────────────────────────────────

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Enums matching the Prisma BlogPostStatus ─────────────────────────────────

export const BLOG_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export type BlogStatusValue = (typeof BLOG_STATUSES)[number];

// ── Editor schema ────────────────────────────────────────────────────────────

export const MAX_TAGS = 20;

export const blogPostEditorSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters.')
      .max(200, 'Title must be 200 characters or fewer.'),
    slug: z
      .string()
      .trim()
      .min(3, 'Slug must be at least 3 characters.')
      .max(200, 'Slug must be 200 characters or fewer.')
      .regex(SLUG_PATTERN, 'Slug must be lowercase, hyphen-separated, URL-safe.'),
    excerpt: z
      .string()
      .trim()
      .max(500, 'Excerpt must be 500 characters or fewer.')
      .nullable()
      .optional(),
    body: z
      .string()
      .min(1, 'Body is required.')
      .max(200_000, 'Body must be 200,000 characters or fewer.'),
    categoryId: z.string().min(1, 'Category is required.'),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Tags cannot be empty.')
          .max(40, 'Tags must be 40 characters or fewer.'),
      )
      .max(MAX_TAGS, `At most ${MAX_TAGS} tags are allowed.`)
      .default([]),
    coverImageId: z.string().min(1).nullable().optional(),
    ogImageId: z.string().min(1).nullable().optional(),
    /** Optional client estimate. The server falls back to a word-count estimate. */
    readingTimeMinutes: z.number().int().min(1).max(240).optional(),
    status: z.enum(BLOG_STATUSES, { message: 'Invalid publication status.' }),
    seoTitle: z
      .string()
      .trim()
      .max(70, 'SEO title must be 70 characters or fewer.')
      .nullable()
      .optional(),
    seoDescription: z
      .string()
      .trim()
      .max(160, 'SEO description must be 160 characters or fewer.')
      .nullable()
      .optional(),
    isLab: z.boolean().optional(),
  })
  .strict();

export type BlogPostEditorInput = z.infer<typeof blogPostEditorSchema>;

// ── Request schemas (client → server boundary) ───────────────────────────────

export const createBlogPostRequestSchema = z
  .object({
    data: blogPostEditorSchema,
  })
  .strict();

export const updateBlogPostRequestSchema = z
  .object({
    postId: z.string().min(1, 'Post ID is required.'),
    expectedUpdatedAt: z.string().min(1, 'Concurrency token is required.'),
    data: blogPostEditorSchema,
  })
  .strict();

export type CreateBlogPostRequest = z.infer<typeof createBlogPostRequestSchema>;
export type UpdateBlogPostRequest = z.infer<typeof updateBlogPostRequestSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Rough reading-time estimate using the 200 words-per-minute convention. */
export function estimateReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
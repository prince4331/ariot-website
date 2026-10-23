import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createBlogPost } from '@/server/admin/blog/create-blog-post';
import {
  IMMEDIATE_INVALIDATION,
  PUBLIC_BLOG_TAG,
  publicBlogPostTag,
} from '@/server/public/tagged-cache';

/** Public routes that render published BlogPosts (ISR revalidation targets). */
const PUBLIC_BLOG_PATHS = ['/blog', '/', '/robotics', '/research', '/solutions'];

/**
 * POST /api/admin/blog — create a BlogPost.
 *
 * Authorization: enforced inside createBlogPost (`blog.write`).
 * On success the public blog routes are revalidated so a published post
 * appears without a full rebuild or an ISR-window wait.
 *
 * Revalidation strategy (D1):
 *   - `revalidateTag(PUBLIC_BLOG_TAG)` discards the cached DB reads. This is
 *     the load-bearing call: the public pages read the database through
 *     `unstable_cache`, and only a matching tag invalidates that cache.
 *   - `revalidatePath(...)` additionally drops the rendered page entries, so
 *     the next request re-renders with the fresh data.
 */
export async function POST(request: Request) {
  try {
    const result = await createBlogPost(await request.json());
    const status = result.ok
      ? 200
      : result.type === 'forbidden'
        ? 403
        : result.type === 'validation'
          ? 422
          : result.type === 'duplicate'
            ? 409
            : 400;

    if (result.ok) {
      revalidateTag(PUBLIC_BLOG_TAG, IMMEDIATE_INVALIDATION);
      revalidateTag(publicBlogPostTag(result.slug), IMMEDIATE_INVALIDATION);
      for (const path of PUBLIC_BLOG_PATHS) revalidatePath(path, 'page');
      // Clear any cached 404 for this slug (e.g. visited before creation).
      revalidatePath(`/blog/${result.slug}`, 'page');
    }

    return NextResponse.json(result, { status });
  } catch {
    return NextResponse.json(
      { ok: false, type: 'error', message: 'Internal server error.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { updateBlogPost } from '@/server/admin/blog/update-blog-post';
import {
  IMMEDIATE_INVALIDATION,
  PUBLIC_BLOG_TAG,
  publicBlogPostTag,
} from '@/server/public/tagged-cache';

/** Public routes that render published BlogPosts (ISR revalidation targets). */
const PUBLIC_BLOG_PATHS = ['/blog', '/', '/robotics', '/research', '/solutions'];

/**
 * POST /api/admin/blog/[id] — update a BlogPost.
 *
 * Authorization: enforced inside updateBlogPost (`blog.write`). Optimistic
 * concurrency, slug uniqueness, safe publication transitions, no-op
 * detection, and audit logging are handled by the executor.
 *
 * On success the public blog routes are revalidated so publish/unpublish
 * changes appear immediately.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const payload = { postId: id, ...body };

    const result = await updateBlogPost(payload);
    const status = result.ok
      ? 200
      : result.type === 'forbidden'
        ? 403
        : result.type === 'conflict'
          ? 409
          : result.type === 'not_found'
            ? 404
            : result.type === 'validation'
              ? 422
              : result.type === 'duplicate'
                ? 409
                : 400;

    if (result.ok && !result.noChanges) {
      // Invalidate the cached DB reads first — the public pages read through
      // `unstable_cache`, and only a matching tag discards that cache.
      revalidateTag(PUBLIC_BLOG_TAG, IMMEDIATE_INVALIDATION);
      revalidateTag(publicBlogPostTag(result.previousSlug), IMMEDIATE_INVALIDATION);
      if (result.slug !== result.previousSlug) {
        revalidateTag(publicBlogPostTag(result.slug), IMMEDIATE_INVALIDATION);
      }
      for (const path of PUBLIC_BLOG_PATHS) revalidatePath(path, 'page');
      // Revalidate both the previous and the current slug detail page so a
      // slug rename or an unpublish removes stale cached versions.
      revalidatePath(`/blog/${result.previousSlug}`, 'page');
      if (result.slug !== result.previousSlug) {
        revalidatePath(`/blog/${result.slug}`, 'page');
      }
    }

    return NextResponse.json(result, { status });
  } catch {
    return NextResponse.json(
      { ok: false, type: 'error', message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
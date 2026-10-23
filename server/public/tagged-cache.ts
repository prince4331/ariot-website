import { unstable_cache } from 'next/cache';

/**
 * Tagged cache for DB-backed public content (D1).
 *
 * WHY THIS EXISTS
 * ---------------
 * The admin blog mutation API calls `revalidatePath('/blog', 'page')` so a
 * newly published post appears on the public pages without a rebuild or a
 * redeploy. In Next.js 16 that call is a **silent no-op** unless the page's
 * cache entry carries tag metadata:
 *
 *   - A cached `APP_PAGE` entry is only considered stale when one of the tags
 *     in its `x-next-cache-tags` header has been revalidated
 *     (`server/lib/incremental-cache/index.js` → `areTagsExpired`).
 *   - That header is written from `workUnitStore.tags`, which is populated
 *     ONLY by `unstable_cache` (or `"use cache"` + `cacheTag()`).
 *   - Plain Prisma calls contribute no tags, so a page rendered straight from
 *     the database is cached with NO tag metadata. `revalidatePath` then has
 *     nothing to match and the page stays stale forever.
 *
 * Wrapping the content reads in `unstable_cache` with an explicit tag makes
 * the cached data carry that tag, so `revalidatePath` / `revalidateTag` can
 * actually invalidate it.
 *
 * CACHE KEYS
 * ----------
 * Every cached read gets a stable, explicit key derived from its query
 * parameters. Two different queries must never share a key, and the same
 * query must always produce the same key, otherwise the cache would serve
 * one query's rows for another.
 */

/**
 * Tag used for every public blog read. A single tag keeps invalidation
 * simple and correct: publishing, editing, or unpublishing ANY post must
 * refresh every page that lists or shows blog content.
 */
export const PUBLIC_BLOG_TAG = 'public-blog';

/**
 * Cache-life profile that expires a tag IMMEDIATELY.
 *
 * `revalidateTag(tag, profile)` sets the tag's expiry to
 * `now + profile.expire * 1000`. Any named profile (`'max'` included)
 * therefore keeps the entry valid for that profile's `expire` window — a
 * published post would stay invisible for a year. `{ expire: 0 }` expires the
 * tag at `now`, which is the only profile that actually invalidates the
 * cached read at the moment of the call.
 *
 * `updateTag` would be the idiomatic API, but it may only be called from a
 * Server Action; the admin blog mutations are Route Handlers.
 */
export const IMMEDIATE_INVALIDATION = { expire: 0 } as const;

/**
 * Tag for a single post, so one post can be invalidated on its own.
 *
 * The slug is accepted as `unknown` because the admin API's mutation result
 * type widens row fields to `unknown`. Only a string can form a meaningful
 * tag, so a non-string slug yields an empty tag — which matches no cache
 * entry and is therefore a no-op rather than a wrong invalidation.
 */
export function publicBlogPostTag(slug: unknown): string {
  return `public-blog:${typeof slug === 'string' ? slug : ''}`;
}

/**
 * Build a tagged, cached read.
 *
 * @param keyParts Stable key components. Joined with `:` — every distinct
 *   query must supply distinct components.
 * @param tags Tags attached to the cached entry. Invalidating any of them
 *   discards the entry.
 * @param read The actual read. Must be a pure function of its arguments
 *   (which must therefore be part of `keyParts`).
 */
export function taggedCache<T>(
  keyParts: readonly string[],
  tags: readonly string[],
  read: () => Promise<T>,
): Promise<T> {
  return unstable_cache(read, [...keyParts], {
    tags: [...tags],
    // `false` = never time-based expiry. The content is invalidated explicitly
    // by the admin API via `revalidatePath` / `revalidateTag`, never by a
    // clock. A stale post is a content bug, not a latency bug.
    revalidate: false,
  })();
}

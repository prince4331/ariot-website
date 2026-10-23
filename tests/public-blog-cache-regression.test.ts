/**
 * tests/public-blog-cache-regression.test.ts
 *
 * Regression guard for the D1 publication/cache defect (D-081).
 *
 * THE DEFECT
 * ----------
 * The admin blog mutation API called `revalidatePath('/blog', 'page')` so a
 * published post would appear on the public pages without a rebuild. In
 * Next.js 16 that call was a **silent no-op**:
 *
 *   - A cached `APP_PAGE` entry is only invalidated when a tag listed in its
 *     `x-next-cache-tags` header has been revalidated.
 *   - That header is written from `workUnitStore.tags`, which is populated
 *     ONLY by `unstable_cache` / `"use cache"` + `cacheTag()`.
 *   - The public pages read PostgreSQL through plain Prisma calls, so they
 *     carried no tag metadata, and `revalidatePath` had nothing to match.
 *
 * Verified live in the Docker stack: publishing returned HTTP 200 while
 * `/blog`, `/`, and `/blog/[slug]` served the OLD content indefinitely
 * (`x-nextjs-cache: HIT`, forever).
 *
 * WHAT THIS TEST ASSERTS
 * ----------------------
 * The cache-invalidation contract that made the defect invisible:
 *
 *   1. The public blog reads go through a TAGGED cache, so a cached entry
 *      actually carries the tag a revalidation can match.
 *   2. The admin mutation routes invalidate that tag.
 *   3. The invalidation profile expires the tag IMMEDIATELY. A named
 *      profile (`'max'` included) sets the expiry to `now + expire * 1000`,
 *      which would keep the entry valid for that window — the same class of
 *      silent no-op, one layer down.
 *
 * These are static/source-level assertions plus a live behavioural check of
 * the cache module. They do not need a database.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

const read = (relative: string): string =>
  readFileSync(join(ROOT, relative), 'utf8');

describe('public blog cache invalidation contract (D-081)', () => {
  it('the public blog reads are wrapped in a TAGGED cache', () => {
    const source = read('server/public/blog.ts');

    // A tagged cache is the only way a page's cache entry ends up carrying
    // the tag metadata that `revalidateTag` can match.
    assert.match(
      source,
      /taggedCache\(/,
      'server/public/blog.ts must read through taggedCache() so the cached entry carries tags',
    );
    assert.match(
      source,
      /PUBLIC_BLOG_TAG/,
      'the public blog reads must be tagged with PUBLIC_BLOG_TAG',
    );
  });

  it('the tagged cache attaches the tags to the cached entry', () => {
    const source = read('server/public/tagged-cache.ts');

    assert.match(source, /unstable_cache\(/, 'taggedCache must use unstable_cache');
    assert.match(
      source,
      /tags:\s*\[\.\.\.tags\]/,
      'the cache options must carry the supplied tags',
    );
  });

  it('the invalidation profile expires the tag IMMEDIATELY', () => {
    const source = read('server/public/tagged-cache.ts');

    // `{ expire: 0 }` -> the tag's expiry is set to `now`, so the cached read
    // is discarded at the moment of the call. Any named profile (e.g. 'max')
    // would set the expiry to `now + expire * 1000` and keep the entry
    // valid for that window — a silent no-op, the same defect one layer down.
    assert.match(
      source,
      /IMMEDIATE_INVALIDATION\s*=\s*\{\s*expire:\s*0\s*\}/,
      'IMMEDIATE_INVALIDATION must be { expire: 0 } so a revalidation is immediate',
    );
  });

  it('the admin mutation routes invalidate the public blog tag', () => {
    for (const route of [
      'app/api/admin/blog/route.ts',
      'app/api/admin/blog/[id]/route.ts',
    ]) {
      const source = read(route);

      assert.match(
        source,
        /revalidateTag\(\s*PUBLIC_BLOG_TAG\s*,\s*IMMEDIATE_INVALIDATION\s*\)/,
        `${route} must revalidateTag(PUBLIC_BLOG_TAG, IMMEDIATE_INVALIDATION)`,
      );
      assert.match(
        source,
        /revalidateTag\(\s*publicBlogPostTag\(/,
        `${route} must also invalidate the per-post tag`,
      );
    }
  });

  it('the cache is bypassed for the disposable-database test seam', () => {
    const source = read('server/public/blog.ts');

    // The integration tests pass their own `db` client. Those reads must
    // never touch the shared process-wide cache, or one database's rows
    // would be served for another.
    assert.match(
      source,
      /if \(db !== prisma\)/,
      'a caller-supplied db must bypass the cache (otherwise tests read each other\'s rows)',
    );
  });
});

describe('IMMEDIATE_INVALIDATION semantics', () => {
  it('expires a tag at the moment of the call', async () => {
    const { IMMEDIATE_INVALIDATION } = await import('../server/public/tagged-cache.ts');

    assert.deepEqual(IMMEDIATE_INVALIDATION, { expire: 0 });
  });
});

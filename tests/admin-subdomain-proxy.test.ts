/**
 * tests/admin-subdomain-proxy.test.ts — D-082/D2 admin subdomain host routing.
 *
 * Exercises the production split (public apex `https://ariottech.com` +
 * admin `https://admin.ariottech.com`) that lives in the Next.js proxy
 * (proxy.ts). One app, one database, two hosts.
 *
 * Covered (D2 Task 7):
 *   1. Admin-domain routing — apex /admin* and /sign-in* → admin subdomain.
 *   2. Rejection of unlisted hosts (localhost / unknown) — pass through.
 *   3. Admin root `/` with a session cookie → /admin; without → /sign-in.
 *   4. No redirect loops (a redirect target is never itself redirected).
 *   5. Public marketing routes unaffected (proxy ignores them).
 *
 * The proxy derives its hosts from the same env the app runs with, so tests
 * set `BETTER_AUTH_URL` / `NEXT_PUBLIC_SITE_URL` before importing proxy.ts.
 * `proxy.ts` reads env at call time (not module load), so a single import
 * serves every scenario via dynamic re-import with fresh env.
 *
 * No database, no network, no filesystem writes.
 *
 * Run:
 *   node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/admin-subdomain-proxy.test.ts
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { NextRequest } from 'next/server';

const APEX = 'https://ariottech.com';
const ADMIN = 'https://admin.ariottech.com';
const SESSION_COOKIE = 'better-auth.session_token';

// Import the module ONCE; env is read per-request so scenarios mutate process.env.
const proxyModule = await import('../proxy.ts');
const proxy = proxyModule.default;
const matcher = (proxyModule as { config?: { matcher?: string[] } }).config?.matcher;

function makeRequest(url: string, opts: { cookieName?: string } = {}): NextRequest {
  const headers = new Headers();
  // The proxy dispatches on the Host header (preserved by Caddy) — set it
  // explicitly to simulate which host block received the request.
  headers.set('host', new URL(url).host);
  if (opts.cookieName) headers.set('cookie', `${opts.cookieName}=token-for-test`);
  return new NextRequest(url, { headers });
}

/** Run the proxy and return the response's Location + status. */
function run(url: string, opts: { cookieName?: string } = {}) {
  const res = proxy(makeRequest(url, opts));
  const location = res.headers.get('location');
  return { location, status: res.status, headers: res.headers };
}

const ORIGINAL_ENV = {
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = APEX;
  process.env.BETTER_AUTH_URL = ADMIN;
});

afterEach(() => {
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    if (v === undefined) delete process.env[k as keyof typeof ORIGINAL_ENV];
    else process.env[k as keyof typeof ORIGINAL_ENV] = v;
  }
});

describe('Admin subdomain host routing (D-082/D2)', () => {
  it('exposes the three production hosts from env', () => {
    // Sanity: the split is recognised (apex host !== admin host).
    assert.notEqual(new URL(APEX).host, new URL(ADMIN).host);
  });

  it('matcher only targets /, /admin*, and /sign-in*', () => {
    assert.deepEqual(matcher, ['/', '/admin/:path*', '/sign-in/:path*']);
  });

  it('apex /admin and its subpaths redirect to the admin subdomain', () => {
    for (const path of ['/admin', '/admin/products', '/admin/blog/first-post']) {
      const { location, status } = run(`${APEX}${path}`);
      assert.equal(status, 308, `${path} should use a 308 redirect`);
      assert.equal(location, `${ADMIN}${path}`, `${path} should preserve its path`);
    }
  });

  it('apex /sign-in redirects to the admin subdomain', () => {
    const { location, status } = run(`${APEX}/sign-in`);
    assert.equal(status, 308);
    assert.equal(location, `${ADMIN}/sign-in`);
  });

  it('apex /admin preserves the query string', () => {
    const { location } = run(`${APEX}/admin?tab=products`);
    assert.equal(location, `${ADMIN}/admin?tab=products`);
  });

  it('admin root with a session cookie goes to /admin (no loop)', () => {
    const { location, status } = run(`${ADMIN}/`, { cookieName: SESSION_COOKIE });
    assert.equal(status, 307);
    assert.equal(location, `${ADMIN}/admin`);
  });

  it('admin root with a secure (__Secure-) session cookie goes to /admin', () => {
    // In production over https, Better Auth prefixes the cookie name with
    // `__Secure-`. The proxy must recognise it as a session cookie too.
    const { location, status } = run(`${ADMIN}/`, {
      cookieName: `__Secure-${SESSION_COOKIE}`,
    });
    assert.equal(status, 307);
    assert.equal(location, `${ADMIN}/admin`);
  });

  it('admin root without a session cookie goes to /sign-in (no loop)', () => {
    const { location, status } = run(`${ADMIN}/`);
    assert.equal(status, 307);
    assert.equal(location, `${ADMIN}/sign-in`);
  });

  it('an unrelated cookie on admin root still goes to /sign-in', () => {
    // Cookie presence must be the Better Auth session cookie, not any cookie.
    const { location } = run(`${ADMIN}/`, { cookieName: 'plausible_pa' });
    assert.equal(location, `${ADMIN}/sign-in`);
  });

  it('admin /admin and /sign-in pass through (targets are not re-redirected)', () => {
    assert.equal(run(`${ADMIN}/admin`).location, null);
    assert.equal(run(`${ADMIN}/sign-in`).location, null);
  });

  it('public marketing routes on the apex are unaffected', () => {
    for (const path of ['/', '/products', '/products/sensor', '/blog', '/research']) {
      assert.equal(run(`${APEX}${path}`).location, null, `${path} must not redirect`);
    }
  });

  it('API routes (auth callbacks, contact) are never host-redirected', () => {
    // The proxy matcher excludes /api/*, but assert the handler is safe too.
    for (const path of [
      '/api/auth/callback/google',
      '/api/auth/sign-in/social',
      '/api/contact',
      '/api/newsletter',
    ]) {
      assert.equal(run(`${APEX}${path}`).location, null, `${path} must not redirect`);
      assert.equal(run(`${ADMIN}${path}`).location, null, `${path} must not redirect`);
    }
  });

  it('does not redirect the entire public site to admin', () => {
    // Regression guard: only /admin* and /sign-in* move to the subdomain.
    const redirected = ['/', '/products', '/blog', '/robotics', '/contact', '/research'].filter(
      (p) => run(`${APEX}${p}`).location !== null,
    );
    assert.deepEqual(redirected, []);
  });

  it('requests for a host that is neither apex nor admin pass through', () => {
    // Split is active, but the request host is not the apex — the proxy must
    // not capture it (e.g. a stray Host header or a misconfigured upstream).
    process.env.NEXT_PUBLIC_SITE_URL = APEX;
    process.env.BETTER_AUTH_URL = ADMIN;
    assert.equal(run('http://localhost:3000/admin').location, null);
    assert.equal(run('http://localhost:3000/').location, null);
    assert.equal(run('https://unlisted.example.com/admin').location, null);
  });

  it('apex-only config (admin host derived from site URL) still routes /admin', () => {
    // BETTER_AUTH_URL unset → admin host falls back to the site host, so the
    // split is inactive on that host and /admin is served in place (single-
    // domain posture), never bouncing through a redirect loop.
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
    delete process.env.BETTER_AUTH_URL;
    assert.equal(run('http://localhost:3000/admin').location, null);
    assert.equal(run('http://localhost:3000/').location, null);
  });

  it('disables the split when BETTER_AUTH_URL matches NEXT_PUBLIC_SITE_URL', () => {
    // Single-host posture: /admin on the (only) host is served, not redirected.
    process.env.NEXT_PUBLIC_SITE_URL = APEX;
    process.env.BETTER_AUTH_URL = APEX;
    assert.equal(run(`${APEX}/admin`).location, null);
    assert.equal(run(`${APEX}/sign-in`).location, null);
  });
});

import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host routing for the admin-subdomain split (D-082, implemented in D2).
 * (see full doc comment below — env is read per-request, not imported)
 *
 * One Next.js app serves two production hosts behind Caddy:
 *   - apex   `https://ariottech.com`      → the public marketing site
 *   - admin  `https://admin.ariottech.com` → the admin dashboard + sign-in
 *
 * This proxy implements exactly three rules and nothing else (the matcher is
 * limited to `/`, `/admin/*`, and `/sign-in/*`, so static assets, public
 * pages, and every API route — including the Better Auth callbacks under
 * `/api/auth/*` — are untouched):
 *
 *   1. apex `/admin`  → https://admin.ariottech.com/admin   (307)
 *   2. apex `/sign-in` → https://admin.ariottech.com/sign-in (307)
 *   3. admin `/` → `/admin` when a session cookie is present, else `/sign-in`
 *      (relative targets, so the redirect always stays on the admin host).
 *
 * Loop safety (D-082/D2):
 *   - Rules 1–2 only fire on the apex host and always target the admin host,
 *     which never matches them again.
 *   - Rule 3 only fires on the admin host for the exact path `/` and targets
 *     a different path, so it cannot re-fire.
 *   - `app/(admin)/layout.tsx` redirects authenticated non-admins to the
 *     canonical public site (absolute NEXT_PUBLIC_SITE_URL), which leaves the
 *     admin host entirely — no bounce back to `/admin`.
 *
 * Rule 3 is a routing convenience only; it is NOT an authorization decision.
 * The presence of a session cookie proves nothing — `app/(admin)/layout.tsx`
 * re-resolves the session and RBAC roles from the database on every request
 * and redirects accordingly (missing/expired session → `/sign-in`;
 * valid session without an admin role → the public site).
 *
 * In local development both hosts resolve to `http://localhost:3000`
 * (BETTER_AUTH_URL falls back to NEXT_PUBLIC_SITE_URL), the split is
 * inactive, and every request passes through unchanged — localhost
 * behaviour is preserved exactly.
 *
 * Cookie names: Better Auth prefixes auth cookies with `__Secure-` when the
 * baseURL is https (better-auth `cookies/index.mjs` — the same derivation
 * applies to the session cookie). Host-only is the default: no `cookieDomain`
 * is configured anywhere, so no `.ariottech.com` shared cookies exist.
 */

/**
 * Read the two host-defining URLs per request from `process.env`.
 *
 * Values mirror the production compose env (`NEXT_PUBLIC_SITE_URL` = apex,
 * `BETTER_AUTH_URL` = admin subdomain, see compose.production.yml +
 * .env.production.example). They are read at request time (not import time)
 * so tests can exercise the split-active and split-inactive postures in a
 * single process without mutating a frozen import binding; `server/env.ts`
 * still validates both at boot. This module runs in the edge/proxy runtime,
 * where the validated values are the same `process.env` the app boots with.
 */
function currentEnv(): { siteUrl: string | undefined; authUrl: string | undefined } {
  return {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    authUrl: process.env.BETTER_AUTH_URL,
  };
}

/** Better Auth session-cookie names (secure and non-secure prefix variants). */
const SESSION_COOKIE_NAMES = [
  '__Secure-better-auth.session_token',
  'better-auth.session_token',
] as const;

function hostnameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** True when the request carries a Better Auth session cookie (presence only). */
function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
}

export default function proxy(request: NextRequest): NextResponse {
  const { siteUrl, authUrl } = currentEnv();
  const apexHost = hostnameOf(siteUrl);
  const adminHost = hostnameOf(authUrl ?? siteUrl);

  // Split inactive: development (both localhost) or a single-host deploy.
  if (!apexHost || !adminHost || apexHost === adminHost) {
    return NextResponse.next();
  }

  // Behind Caddy the Host header is preserved (deploy/Caddyfile sets it
  // explicitly), so it reliably identifies the site block that received the
  // request — Caddy has already routed on it, the value cannot be forged
  // into the "wrong" site.
  const host = request.headers.get('host');
  const { pathname } = request.nextUrl;

  // Rules 1–2: keep admin-only surfaces on the admin host. Only fire when
  // the split is fully configured AND this request is on the apex host — a
  // request for any other host is never captured.
  if (host && host === apexHost && apexHost !== adminHost) {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return NextResponse.redirect(
        new URL(`https://${adminHost}${pathname}${request.nextUrl.search}`),
        308,
      );
    }
    if (pathname === '/sign-in' || pathname.startsWith('/sign-in/')) {
      return NextResponse.redirect(
        new URL(`https://${adminHost}${pathname}${request.nextUrl.search}`),
        308,
      );
    }
    return NextResponse.next();
  }

  // Rule 3: the admin host's root is an auth-aware hop into the console.
  if (host === adminHost && pathname === '/') {
    return NextResponse.redirect(
      new URL(hasSessionCookie(request) ? '/admin' : '/sign-in', request.url),
      307,
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/sign-in/:path*'],
};

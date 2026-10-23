/**
 * tests/auth-config.test.ts — D-082/D2 admin-subdomain auth configuration.
 *
 * Exercises the production auth posture of `server/auth.ts` WITHOUT a
 * database or network: the Better Auth instance is constructed from `env`
 * at import time, so each env posture needs a fresh process. Every case
 * spawns an isolated child (`node --import register-hooks --eval`) that
 * imports the REAL `server/auth.ts` and prints a JSON summary of the
 * instance options. `prismaAdapter` is lazy, so importing never opens a DB
 * connection.
 *
 * Covered (D2 Task 7):
 *   1. Admin-domain trusted-origin behaviour — admin + apex origins trusted.
 *   2. Rejection of unauthorized origins — runtime 403 INVALID_ORIGIN on a
 *      cookie-bearing POST from an untrusted Origin (verified against the
 *      real better-auth handler; no wildcards, no localhost in production).
 *   3. Secure session-cookie posture — no cookieDomain (host-only), https base.
 *   4. Google provider active when credentials are configured — including the
 *      runtime redirect to Google with the registered admin callback URI.
 *   5. Google provider disabled safely without credentials.
 *   6. Production baseURL = the admin subdomain (drives the OAuth callback).
 *
 * Live Google login is intentionally NOT exercised here — it stays marked
 * unverified until a real HTTPS browser flow completes post-deployment.
 *
 * Run:
 *   node --import ./tests/helpers/register-hooks.mjs --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/auth-config.test.ts
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';

const SITE = 'https://ariottech.com';
const ADMIN = 'https://admin.ariottech.com';

interface AuthSummary {
  baseURL: string | null;
  trustedOrigins: string[];
  providerKeys: string[];
  googleDisableSignUp: boolean | null;
  googleScope: string[] | null;
  cookieDomain: string | undefined;
  usesPrismaAdapter: boolean;
}

/** Spawn a child that imports the real server/auth.ts under `overrides`. */
function loadAuth(overrides: Record<string, string>): AuthSummary {
  // Deterministic base posture; each case overrides from a clean slate.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    BETTER_AUTH_SECRET: 'd2-test-secret-value-32-chars-min!!',
    NEXT_PUBLIC_SITE_URL: SITE,
    BETTER_AUTH_URL: ADMIN,
    // Never let ambient dev credentials leak into a case that omits them.
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    ...overrides,
  };

  const script = `
    const { auth } = await import('./server/auth.ts');
    const opts = auth.options ?? {};
    const providers = opts.socialProviders ?? {};
    const google = providers.google;
    const out = {
      baseURL: opts.baseURL ?? null,
      trustedOrigins: opts.trustedOrigins ?? [],
      providerKeys: Object.keys(providers),
      googleDisableSignUp: google ? Boolean(google.disableSignUp) : null,
      googleScope: google && Array.isArray(google.scope) ? google.scope : null,
      cookieDomain: opts.advanced?.cookieDomain,
      usesPrismaAdapter: Boolean(opts.database),
    };
    process.stdout.write(JSON.stringify(out));
  `;

  const stdout = execFileSync(
    process.execPath,
    [
      '--import',
      './tests/helpers/register-hooks.mjs',
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      '--input-type=module',
      '--eval',
      script,
    ],
    {
      cwd: process.cwd(),
      env,
      encoding: 'utf8',
      // No network, no DB: the import path never connects. Generous timeout
      // only covers Node boot + module graph.
      timeout: 30_000,
    },
  );

  // The child may print non-JSON noise before our payload; take the last line.
  const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '';
  return JSON.parse(line) as AuthSummary;
}

/**
 * POST /api/auth/sign-in/social through the REAL Better Auth handler in a
 * child process (fresh process per call => fresh rate-limit bucket).
 *
 * Verified contract (better-auth 1.6.23 `origin-check.mjs`): the origin/CSRF
 * check enforces `Origin ∈ trustedOrigins` when the request carries a `Cookie`
 * header (ambient authority present) — otherwise there is nothing to protect
 * and cookie-less requests fall through to endpoint logic. Untrusted origin
 * ⇒ 403 INVALID_ORIGIN before any endpoint/DB/network work.
 */
function postSignInSocial(options: {
  origin: string;
  withGoogleCreds?: boolean;
}): { status: number; locationHost: string | null; redirectUri: string | null } {
  const script = `
    const { auth } = await import('./server/auth.ts');
    const req = new Request('https://admin.ariottech.com/api/auth/sign-in/social', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ${JSON.stringify(options.origin)},
        // Cookie-bearing request: the posture in which better-auth enforces
        // its origin/CSRF check.
        cookie: 'better-auth.session_token=forged-test-value',
      },
      body: JSON.stringify({ provider: 'google', callbackURL: '/admin' }),
    });
    const res = await auth.handler(req);
    const location = res.headers.get('location');
    let locationHost = null;
    let redirectUri = null;
    if (location) {
      const u = new URL(location);
      locationHost = u.host;
      redirectUri = u.searchParams.get('redirect_uri');
    }
    process.stdout.write(JSON.stringify({ status: res.status, locationHost, redirectUri }));
  `;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    BETTER_AUTH_SECRET: 'd2-test-secret-value-32-chars-min!!',
    NEXT_PUBLIC_SITE_URL: SITE,
    BETTER_AUTH_URL: ADMIN,
  };
  if (options.withGoogleCreds) {
    env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  } else {
    env.GOOGLE_CLIENT_ID = '';
    env.GOOGLE_CLIENT_SECRET = '';
  }

  const stdout = execFileSync(
    process.execPath,
    [
      '--import',
      './tests/helpers/register-hooks.mjs',
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      '--input-type=module',
      '--eval',
      script,
    ],
    { cwd: process.cwd(), env, encoding: 'utf8', timeout: 30_000 },
  );

  const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '';
  return JSON.parse(line) as { status: number; locationHost: string | null; redirectUri: string | null };
}

describe('admin-subdomain auth configuration (D-082/D2)', () => {
  it('uses the admin subdomain as the production auth baseURL', () => {
    const summary = loadAuth({});
    assert.equal(summary.baseURL, ADMIN);
  });

  it('trusts exactly the admin + apex origins (no wildcards, no localhost)', () => {
    const summary = loadAuth({});
    const origins = [...summary.trustedOrigins].sort();
    assert.deepEqual(origins, [ADMIN, SITE].sort());
    for (const origin of origins) {
      assert.ok(origin.startsWith('https://'), `trusted origin must be https: ${origin}`);
      assert.ok(!origin.includes('*'), `trusted origin must not be a wildcard: ${origin}`);
    }
  });

  it('REJECTS a cookie-bearing sign-in POST from an untrusted origin (403)', () => {
    // Runtime CSRF/origin contract (not just the config list): when a request
    // carries cookies, an Origin outside trustedOrigins is rejected with
    // 403 INVALID_ORIGIN before any endpoint logic — no DB, no network.
    for (const badOrigin of ['https://evil.example.com', 'http://localhost:3000']) {
      const res = postSignInSocial({ origin: badOrigin });
      assert.equal(res.status, 403, `${badOrigin} must be rejected with 403`);
      assert.equal(res.locationHost, null, `${badOrigin} must not be redirected anywhere`);
    }
  });

  it('ACCEPTS the admin origin and issues the registered Google callback', () => {
    // Trusted admin origin passes the origin check and reaches the provider:
    // better-auth builds the Google consent URL with the redirect URI derived
    // from BETTER_AUTH_URL — exactly the URI registered on the Google OAuth
    // client. (URL construction only; no network call is made.)
    const res = postSignInSocial({ origin: ADMIN, withGoogleCreds: true });
    assert.equal(res.status, 200);
    assert.equal(res.locationHost, 'accounts.google.com');
    assert.equal(res.redirectUri, 'https://admin.ariottech.com/api/auth/callback/google');
  });

  it('ACCEPTS the apex origin at runtime (origin check passes)', () => {
    // The apex origin is trusted for same-site auth calls: it must not be
    // rejected with 403 (google provider is disabled in this child, so the
    // endpoint answers PROVIDER_NOT_FOUND instead — anything but 403).
    const res = postSignInSocial({ origin: SITE });
    assert.notEqual(res.status, 403);
  });

  it('keeps auth cookies host-only (no shared .ariottech.com cookie)', () => {
    const summary = loadAuth({});
    // No cookieDomain configured => host-only on admin.ariottech.com.
    assert.equal(summary.cookieDomain, undefined);
    // https baseURL => Better Auth derives Secure + __Secure- cookie naming.
    assert.ok(summary.baseURL?.startsWith('https://'));
  });

  it('activates the Google provider when both credentials are set', () => {
    const summary = loadAuth({
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
    });
    assert.deepEqual(summary.providerKeys, ['google']);
    // Public registration stays disabled even with a working provider.
    assert.equal(summary.googleDisableSignUp, true);
    // Identity scopes only — no Drive/Gmail/Calendar/contact access.
    assert.deepEqual(summary.googleScope, ['openid', 'email', 'profile']);
  });

  it('disables the Google provider safely when credentials are absent', () => {
    const summary = loadAuth({});
    assert.deepEqual(summary.providerKeys, []);
  });

  it('uses the Prisma adapter against the single shared database', () => {
    const summary = loadAuth({});
    assert.equal(summary.usesPrismaAdapter, true);
  });
});

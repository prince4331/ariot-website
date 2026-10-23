import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { headers } from 'next/headers';
import { prisma } from '@/server/db';
import { env } from '@/server/env';
import { isGoogleProviderEnabled } from '@/server/auth/google-provider';

/**
 * Base Better Auth configuration — Step 2.2.2 (decision D-035, supersedes D-034),
 * extended with the Google OAuth provider in Step 2.2.3.
 *
 * Design notes:
 *   - Uses the existing Prisma singleton from `@/server/db` (no second client).
 *   - Targets PostgreSQL via the official Prisma adapter.
 *   - Keeps ARIOT's custom model/field names via `modelName` + `fields` mapping
 *     (docs/07_DECISIONS.md D-035, docs/08_KNOWN_ISSUES.md — I-017 closed).
 *   - Reads BETTER_AUTH_SECRET / BETTER_AUTH_URL through typed `server/env.ts`.
 *
 * Origin/trust posture (Step 2.2.3, TASK 4; admin-subdomain split, D-082/D2):
 *   - `trustHost` is intentionally REMOVED. We use an explicit `baseURL`
 *     (BETTER_AUTH_URL) plus an explicit `trustedOrigins` list instead of
 *     trusting arbitrary forwarded-host headers. A `http://localhost:3000`
 *     dev fallback is applied only outside production.
 *   - Production (D2): BETTER_AUTH_URL = `https://admin.ariottech.com` and
 *     NEXT_PUBLIC_SITE_URL = `https://ariottech.com`, so the effective trust
 *     list is exactly those two origins (exact strings — no wildcards). The
 *     admin origin is ALSO auto-derived from baseURL by Better Auth
 *     (`getTrustedOrigins`), so sign-in POSTs from the admin host pass the
 *     CSRF/origin check while the apex origin stays trusted for any
 *     same-site auth calls. In production, non-HTTPS and loopback origins
 *     (e.g. the `http://localhost:3000` client-schema default) are excluded
 *     from the trust list — a production process must never widen CSRF
 *     trust to localhost.
 *   - Cookie posture (D2): no `cookieDomain` is configured, so all auth
 *     cookies are host-only on the admin subdomain (never shared across
 *     `.ariottech.com`); `Secure`/`__Secure-` naming is derived by Better
 *     Auth from the https baseURL.
 *   - OAuth callback (D2): Better Auth builds the Google redirect URI from
 *     the baseURL (`${BETTER_AUTH_URL}/api/auth/callback/google`), which is
 *     exactly the URI registered on the Google OAuth client
 *     (`https://admin.ariottech.com/api/auth/callback/google`).
 *
 * Google provider (Step 2.2.3, TASK 3):
 *   - Enabled ONLY when both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 *   - `disableSignUp: true` — unknown Google users cannot create ARIOT accounts.
 *   - Minimum identity scopes only (`openid`, `email`, `profile`); no Drive,
 *     Calendar, Gmail, contacts, or other Google API access; no One Tap.
 *
 * This step does NOT yet:
 *   - build middleware/proxy, RBAC guards, or admin routes (Step 2.2.4 complete);
 *   - implement custom password auth or public registration;
 *   - expose admin routes (Step 2.3.1+).
 *
 * Authorization (RBAC) remains the ARIOT `Role`/`UserRole`/`Permission` model
 * in `server/auth/permissions.ts` (later step), not Better Auth role fields.
 */

const DEV_ORIGIN = 'http://localhost:3000';

function resolveBaseURL(): string {
  // Prefer the explicit auth base URL; fall back to the public site URL
  // (NEXT_PUBLIC_SITE_URL, defaults to localhost:3000) so the auth server
  // always has a resolvable origin. In production both should equal the real
  // ARIOT domain — never an arbitrary forwarded-host value.
  return env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_SITE_URL ?? DEV_ORIGIN;
}

function resolveTrustedOrigins(): string[] {
  const origins = new Set<string>();
  for (const url of [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_SITE_URL]) {
    if (!url) continue;
    try {
      const parsed = new URL(url);
      // Production trusts only real HTTPS origins. `NEXT_PUBLIC_SITE_URL`
      // defaults to `http://localhost:3000` when unset, and a production
      // process must not add that (or any loopback) origin to its CSRF
      // trust list (D-082/D2).
      if (env.NODE_ENV === 'production') {
        const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
        if (parsed.protocol !== 'https:' || isLoopback) continue;
      }
      origins.add(parsed.origin);
    } catch {
      // Invalid URL is validated elsewhere; ignore here to avoid crashing boot.
    }
  }
  return [...origins];
}

const googleEnabled = isGoogleProviderEnabled(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: resolveBaseURL(),
  trustedOrigins: resolveTrustedOrigins(),
  user: {
    modelName: 'User',
    fields: {
      image: 'avatarUrl',
    },
  },
  session: {
    modelName: 'Session',
    fields: {
      token: 'tokenHash',
      ipAddress: 'ip',
    },
  },
  account: {
    modelName: 'Account',
    /**
     * Encrypt OAuth tokens at rest using AES-256-GCM (Step 2.2.5, D-040).
     *
     * Stored OAuth tokens (access, refresh, ID) are encrypted with the same
     * BETTER_AUTH_SECRET used for session signing. This protects token data
     * if the database is ever compromised. No additional key is introduced.
     * Tokens are never logged or exposed to the client.
     */
    encryptOAuthTokens: true,
    /**
     * Account-linking policy (Step 2.2.5, D-039).
     *
     * The bootstrap pre-provisions a User with the approved admin email but
     * no OAuth Account row. When the admin signs in with Google for the first
     * time, Better Auth must automatically link that Google account to the
     * pre-provisioned User — this requires implicit linking to be enabled.
     *
     * - enabled: true              — account linking is allowed
     * - disableImplicitLinking: false — automatic link on matching-email sign-in
     * - allowDifferentEmails: false — a different Google email MUST NOT link
     * - updateUserInfoOnLink: false — do not overwrite our admin's name/avatar
     */
    accountLinking: {
      enabled: true,
      disableImplicitLinking: false,
      allowDifferentEmails: false,
      updateUserInfoOnLink: false,
    },
  },
  verification: {
    modelName: 'Verification',
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          // Identity scopes only — do not request Drive/Calendar/Gmail/contacts.
          scope: ['openid', 'email', 'profile'],
          // Unknown Google users must not be able to create ARIOT accounts.
          disableSignUp: true,
        },
      }
    : {},
});

/**
 * Minimal server-side session read — Step 2.2.3 (TASK 9), reused by 2.2.4 RBAC.
 *
 * Returns the active session (with user) or `null` when unauthenticated.
 * This is AUTHENTICATION only: it grants no roles, no permissions, and must
 * not be used to infer admin access. RBAC lives in `server/auth/permissions.ts`.
 *
 * @param requestHeaders Optional request `Headers`. When omitted, the current
 *   Next.js request headers are resolved via `next/headers`. Route handlers may
 *   pass the incoming `Request.headers` explicitly.
 */
export async function getSession(requestHeaders?: Headers) {
  const resolvedHeaders = requestHeaders ?? (await headers());
  return auth.api.getSession({ headers: resolvedHeaders });
}

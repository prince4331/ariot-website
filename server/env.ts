import { z } from 'zod';
import { isAbsolute } from 'node:path';

/**
 * Type-safe environment variable validation.
 *
 * Adding a new env var:
 *   1. Add it to `.env.example` with a comment explaining its purpose.
 *   2. Add it to `serverSchema` (server-only) or `clientSchema` (NEXT_PUBLIC_).
 *   3. Reference it via `env.YOUR_VAR` — never `process.env.YOUR_VAR` directly.
 *
 * Validation runs at module load. A missing or malformed env throws at boot —
 * that is intentional. Configuration errors must surface immediately, not
 * silently corrupt runtime behavior (per AGENTS.md §9 security baseline).
 */

const isUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const isAbsolutePath = (value: string): boolean => isAbsolute(value);

/** Permissive email shape check: `local@domain.tld` with no spaces/angle brackets. */
const isEmailAddress = (value: string): boolean => /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);

/** MAIL_FROM: a bare email, or `Display Name <email@domain>`. */
const isMailFromAddress = (value: string): boolean => {
  const angled = value.match(/^(.*)<([^<>]+)>$/);
  return angled ? isEmailAddress(angled[2]) : isEmailAddress(value);
};

/**
 * Treat an empty (or whitespace-only) string as unset.
 *
 * Docker Compose renders `${VAR:-}` as an empty string when an optional
 * variable is absent from `.env`. Zod's `.optional()` accepts `undefined`
 * but rejects `''`, so every optional string variable is preprocessed
 * through this helper: containers can pass all keys explicitly and an
 * empty value still means "not configured".
 */
const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Optional string var: empty/whitespace → undefined, else the trimmed value. */
const optionalString = () => z.preprocess(emptyToUndefined, z.string().optional());

/**
 * Returns the byte length of a base64 or base64url-encoded string, accepting
 * either encoding regardless of padding. Returns 0 if the value is not valid
 * base64/base64url.
 */
const base64DecodedByteLength = (value: string): number => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  try {
    const buf = Buffer.from(padded, 'base64');
    // Buffer.from('junk', 'base64') returns a non-empty buffer even when the
    // input is not valid base64. Reject by checking that re-encoding matches.
    const reEncoded = buf.toString('base64').replace(/=+$/, '');
    const stripped = normalized.replace(/=+$/, '');
    return reEncoded === stripped ? buf.length : 0;
  } catch {
    return 0;
  }
};

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /**
   * DATABASE_URL is OPTIONAL at the base env layer.
   *
   * Rationale: `server/env.ts` is imported by the root layout, so it is
   * evaluated for every page at boot. The Phase 1 public site is fully
   * static/SSG and never opens a database connection, so a Phase 1 deploy
   * must not fail when DATABASE_URL is absent. Phase 2 database-backed code
   * (e.g. a future `server/db.ts`) MUST assert DATABASE_URL presence itself
   * before opening a connection — see docs/08_KNOWN_ISSUES.md (I-015).
   */
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url('DATABASE_URL must be a valid connection string.').optional(),
  ),
  RESEND_API_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'RESEND_API_KEY is required for email delivery.').optional(),
  ),
  /**
   * BETTER_AUTH_SECRET — HMAC secret for Better Auth session/JWT signing.
   * Required in production; in development Better Auth auto-generates a fallback.
   * Generate with `openssl rand -base64 32`.
   * Added in Step 2.2.2 (Better Auth foundation). Optional at base env layer so a
   * Phase 1 static deploy boots without auth configured.
   */
  BETTER_AUTH_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'BETTER_AUTH_SECRET is required for production auth.').optional(),
  ),
  /**
   * BETTER_AUTH_URL — public base URL of the auth server (e.g. https://ariot.tech).
   * Used for callback/redirect URLs and as the trusted origin. Optional; a
   * `http://localhost:3000` dev fallback is applied in `server/auth.ts` when unset.
   */
  BETTER_AUTH_URL: z.preprocess(
    emptyToUndefined,
    z.string().url('BETTER_AUTH_URL must be a fully-qualified URL.').optional(),
  ),
  /**
   * GOOGLE_CLIENT_ID — OAuth client ID for the Google provider (Step 2.2.3).
   * Must be set together with `GOOGLE_CLIENT_SECRET`. Public signup is disabled,
   * so these credentials only authenticate pre-approved/allowlisted admins once
   * admin bootstrap (Step 2.2.5) is in place.
   */
  GOOGLE_CLIENT_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'GOOGLE_CLIENT_ID must not be empty.').optional(),
  ),
  /**
   * GOOGLE_CLIENT_SECRET — OAuth client secret for the Google provider (Step 2.2.3).
   * Must be set together with `GOOGLE_CLIENT_ID`. Never logged.
   */
  GOOGLE_CLIENT_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'GOOGLE_CLIENT_SECRET must not be empty.').optional(),
  ),
  /**
   * MAIL_FROM — sender for all transactional mail (contact, quote,
   * newsletter). Either a bare email or a display-name form,
   * `ARIOT Technologies <no-reply@ariottech.com>`.
   *
   * The domain MUST be verified with Resend or delivery is rejected (I-031).
   * Optional at boot so development builds without mail config still run;
   * `server/mail/routing.ts` enforces presence at send time in production
   * (fail closed — the form shows an error instead of faking success).
   */
  MAIL_FROM: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .refine(
        isMailFromAddress,
        'MAIL_FROM must be an email address, optionally as "Display Name <email@domain>".',
      )
      .optional(),
  ),
  /**
   * MAIL_TO — owner-approved operational inbox that receives contact and
   * quote notifications. A single email address (use a group alias if more
   * than one person must receive it). Optional at boot for local development;
   * required at send time in production (see server/mail/routing.ts).
   */
  MAIL_TO: z.preprocess(
    emptyToUndefined,
    z.string().refine(isEmailAddress, 'MAIL_TO must be a single email address.').optional(),
  ),
  /**
   * Cloudflare R2 — media storage for the admin media library (Step 2.4.4,
   * STORAGE-1R / D-067). One bucket per environment.
   *
   * R2 is OPTIONAL at the base env layer (a Phase 1 static deploy has no media
   * storage and must still boot). R2-backed server code MUST call
   * `getR2Config()` before use. If any R2_* variable is present, the whole set
   * must be present — partial config fails fast below.
   */
  R2_ACCOUNT_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'R2_ACCOUNT_ID must not be empty.').optional(),
  ),
  R2_ACCESS_KEY_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'R2_ACCESS_KEY_ID must not be empty.').optional(),
  ),
  R2_SECRET_ACCESS_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'R2_SECRET_ACCESS_KEY must not be empty.').optional(),
  ),
  R2_BUCKET_NAME: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'R2_BUCKET_NAME must not be empty.').optional(),
  ),
  /**
   * R2_PUBLIC_BASE_URL — public base URL for R2 media (e.g. https://media.ariot.tech).
   * Optional: when unset, media URLs fall back to site-relative `/{storageKey}`
   * paths (see server/admin/products/get-product-media.ts).
   */
  R2_PUBLIC_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url('R2_PUBLIC_BASE_URL must be a fully-qualified URL.').optional(),
  ),
  /**
   * MEDIA_UPLOAD_TOKEN_SECRET — HMAC-SHA256 signing secret for upload completion
   * tokens (STORAGE-1R / D-067). Must decode to at least 32 raw bytes when
   * interpreted as base64 or base64url; raw-string length must also be ≥ 32.
   * Generate with `openssl rand -base64 32`. Never logged.
   */
  MEDIA_UPLOAD_TOKEN_SECRET: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .min(32, 'MEDIA_UPLOAD_TOKEN_SECRET must be at least 32 characters.')
      .refine(
        (v) => base64DecodedByteLength(v) >= 32,
        'MEDIA_UPLOAD_TOKEN_SECRET must decode to at least 32 bytes (base64 or base64url).',
      )
      .optional(),
  ),
  /**
   * MEDIA_STORAGE_PROVIDER — active media storage provider (D-068).
   * 'local' = persistent VPS filesystem (default in development); 'r2' =
   * Cloudflare R2 (STORAGE-1R / D-067). Optional at boot (Phase 1 static
   * deploy has no media storage); the provider selector
   * (server/storage/get-media-storage-provider.ts) fails closed in production
   * when unset. An unknown value throws at boot.
   */
  MEDIA_STORAGE_PROVIDER: z.preprocess(
    emptyToUndefined,
    z
      .enum(['local', 'r2'], { message: 'MEDIA_STORAGE_PROVIDER must be "local" or "r2".' })
      .optional(),
  ),
  /**
   * MEDIA_LOCAL_ROOT — absolute provider root for the `local` provider
   * (e.g. /var/lib/ariot/media). Must be an absolute path; the provider
   * additionally rejects roots containing `..` or inside the Next.js
   * `public/` directory (see server/storage/media-storage-config.ts).
   * Required in production when MEDIA_STORAGE_PROVIDER=local.
   */
  MEDIA_LOCAL_ROOT: z.preprocess(
    emptyToUndefined,
    z.string().refine(isAbsolutePath, 'MEDIA_LOCAL_ROOT must be an absolute path.').optional(),
  ),
  /**
   * MEDIA_PUBLIC_BASE_URL — optional external origin for locally served media
   * (e.g. https://media.ariot.tech). When unset, local media URLs are
   * site-relative (`/media/...`).
   */
  MEDIA_PUBLIC_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url('MEDIA_PUBLIC_BASE_URL must be a fully-qualified URL.').optional(),
  ),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .default('http://localhost:3000')
    .refine(isUrl, 'NEXT_PUBLIC_SITE_URL must be a fully-qualified URL.'),
  /** Plausible Analytics domain — e.g. "ariot.tech". Optional in dev. */
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: optionalString(),
});

const serverEnv = serverSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  MAIL_FROM: process.env.MAIL_FROM,
  MAIL_TO: process.env.MAIL_TO,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
  MEDIA_UPLOAD_TOKEN_SECRET: process.env.MEDIA_UPLOAD_TOKEN_SECRET,
  MEDIA_STORAGE_PROVIDER: process.env.MEDIA_STORAGE_PROVIDER,
  MEDIA_LOCAL_ROOT: process.env.MEDIA_LOCAL_ROOT,
  MEDIA_PUBLIC_BASE_URL: process.env.MEDIA_PUBLIC_BASE_URL,
});

const clientEnv = clientSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
});

if (!serverEnv.success) {
  console.error('Invalid server environment variables:', serverEnv.error.flatten().fieldErrors);
  throw new Error('Invalid server environment variables. See server/env.ts.');
}

if (!clientEnv.success) {
  console.error('Invalid client environment variables:', clientEnv.error.flatten().fieldErrors);
  throw new Error('Invalid client environment variables. See server/env.ts.');
}

// Google OAuth credentials must be configured as a pair. A single value present
// without its counterpart is a misconfiguration that would fail at the provider
// boundary; fail fast with a clear, non-secret-leaking message.
const googleId = serverEnv.data.GOOGLE_CLIENT_ID;
const googleSecret = serverEnv.data.GOOGLE_CLIENT_SECRET;
if ((googleId && !googleSecret) || (!googleId && googleSecret)) {
  throw new Error(
    'Google OAuth misconfigured: set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.',
  );
}

// Mail routing must be visible early in production: a missing MAIL_FROM /
// MAIL_TO does not block boot (the site stays up), but every contact/quote
// send fails closed at request time until they are configured — surface that
// at startup so the gap is never a surprise. Never print the values.
if (serverEnv.data.NODE_ENV === 'production' && (!serverEnv.data.MAIL_FROM || !serverEnv.data.MAIL_TO)) {
  console.warn(
    '[env] MAIL_FROM and/or MAIL_TO are not set — production contact/quote email will fail until configured (I-031).',
  );
}

// R2 storage must be configured as a complete set. A partial set (e.g. only
// ACCESS_KEY_ID) would fail at the S3 boundary with a confusing signature
// error; fail fast at boot instead. When the full set is present, the upload
// token secret is required too — completion tokens are part of the same flow.
const r2Values = [
  serverEnv.data.R2_ACCOUNT_ID,
  serverEnv.data.R2_ACCESS_KEY_ID,
  serverEnv.data.R2_SECRET_ACCESS_KEY,
  serverEnv.data.R2_BUCKET_NAME,
] as const;
const r2PresentCount = r2Values.filter((value) => value !== undefined).length;
if (r2PresentCount > 0 && r2PresentCount < r2Values.length) {
  throw new Error(
    'R2 storage misconfigured: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME must all be set together.',
  );
}
if (r2PresentCount === r2Values.length && !serverEnv.data.MEDIA_UPLOAD_TOKEN_SECRET) {
  throw new Error(
    'R2 storage misconfigured: MEDIA_UPLOAD_TOKEN_SECRET is required when R2 storage is enabled.',
  );
}

export const env = {
  ...serverEnv.data,
  ...clientEnv.data,
} as const;

export type Env = typeof env;

export function getDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required before using database-backed server code.');
  }

  return env.DATABASE_URL;
}

/**
 * R2 storage configuration. Asserts that the full R2 set is present — call this
 * from any R2-backed server module (initiate/complete routes, storage service)
 * instead of reading `env.R2_*` directly.
 */
export function getR2Config(): R2Config {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_BASE_URL,
    MEDIA_UPLOAD_TOKEN_SECRET,
  } = env;

  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET_NAME ||
    !MEDIA_UPLOAD_TOKEN_SECRET
  ) {
    throw new Error(
      'R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
        'R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and MEDIA_UPLOAD_TOKEN_SECRET.',
    );
  }

  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucketName: R2_BUCKET_NAME,
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    publicBaseUrl: R2_PUBLIC_BASE_URL,
    uploadTokenSecret: MEDIA_UPLOAD_TOKEN_SECRET,
  };
}

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  /** S3-compatible API endpoint derived from the account ID. */
  endpoint: string;
  /** Optional public URL prefix for served media; falls back to site-relative. */
  publicBaseUrl?: string;
  uploadTokenSecret: string;
};

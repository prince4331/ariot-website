/**
 * Google OAuth provider gate (D-082 / D2).
 *
 * The Google provider is active ONLY when both credentials are present.
 * A single value without its counterpart fails boot validation in
 * `server/env.ts`; this helper is the shared runtime predicate used by the
 * auth config (`server/auth.ts`) and the sign-in page so the button state
 * and the provider state can never diverge.
 *
 * Kept in its own module so server pages can import the predicate without
 * constructing the full Better Auth instance (and its Prisma chain).
 */
export function isGoogleProviderEnabled(
  clientId: string | undefined,
  clientSecret: string | undefined,
): boolean {
  return Boolean(clientId && clientSecret);
}

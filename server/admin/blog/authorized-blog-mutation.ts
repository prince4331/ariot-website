/**
 * Shared authorization orchestration factory — L3 Minimal Marketing CMS.
 *
 * Mirrors the Step 2.4.3 product pattern (createAuthorizedProductDetailsUpdater):
 * the same wrapper is used by BOTH production API routes and authorization
 * contract tests, so denied-write behaviour is exercised on the identical
 * code path that production runs.
 *
 * Flow:
 *   1. authorize() — resolves the server-derived actor (userId + roles) and
 *      verifies the required permission. Throws to deny.
 *   2. execute()  — the validated mutation with the resolved actor.
 *   3. Error sanitization — executor failures never leak internals.
 */

// ── Dependency contracts ─────────────────────────────────────────────────────

/** Resolves the authenticated actor. Must throw on denied access. */
export type AuthorizeFn = () => Promise<{ userId: string; roles: string[] }>;

/** Performs the validated mutation with the server-derived actor. */
export type ExecuteMutationFn = (
  rawInput: unknown,
  actor: { userId: string; roles: string[] },
) => Promise<BlogMutationResult>;

// ── Result type ──────────────────────────────────────────────────────────────

export type BlogMutationResult =
  | { ok: true; [key: string]: unknown }
  | {
      ok: false;
      type: 'forbidden' | 'validation' | 'conflict' | 'duplicate' | 'not_found' | 'error';
      message?: string;
      [key: string]: unknown;
    };

// ── Factory ──────────────────────────────────────────────────────────────────

export function createAuthorizedBlogWriter(
  authorize: AuthorizeFn,
  execute: ExecuteMutationFn,
) {
  return async function authorizedBlogMutation(rawInput: unknown): Promise<BlogMutationResult> {
    // Step 1: Authorization gate
    let actor: { userId: string; roles: string[] };
    try {
      actor = await authorize();
    } catch {
      return { ok: false, type: 'forbidden', message: 'Insufficient permissions.' };
    }

    // Step 2: Execute mutation
    try {
      return await execute(rawInput, actor);
    } catch {
      // Step 3: Sanitize executor failures — never expose internals.
      return { ok: false, type: 'error', message: 'Internal server error.' };
    }
  };
}
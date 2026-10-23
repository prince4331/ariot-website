import { NextResponse } from 'next/server';
import { AuthzError } from '@/server/auth/errors';
import { requireRole } from '@/server/auth/permissions';
import { checkDatabaseTimezone } from '@/server/db-health';

/**
 * GET /api/admin/health/database
 *
 * Database invariant probe (D-070): confirms the application's PostgreSQL
 * session runs in UTC. SUPER_ADMIN only — an infrastructure diagnostic, never a
 * public endpoint. The body carries the observed and expected time zone and
 * nothing else: no connection string, no host, no credentials.
 *
 * 200 when the invariant holds, 503 when it does not, 401/403 when the caller is
 * not a SUPER_ADMIN.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireRole('SUPER_ADMIN', request.headers);
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.httpStatus },
      );
    }
    return NextResponse.json(
      { ok: false, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' },
      { status: 401 },
    );
  }

  const timezone = await checkDatabaseTimezone();

  return NextResponse.json(
    {
      ok: timezone.ok,
      checks: {
        sessionTimeZone: {
          ok: timezone.ok,
          observed: timezone.observed,
          expected: timezone.expected,
          detail: timezone.detail,
        },
      },
    },
    { status: timezone.ok ? 200 : 503 },
  );
}

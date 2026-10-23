import { NextResponse } from 'next/server';

/**
 * GET /api/health — container liveness probe (D1 production deployment).
 *
 * Deliberately minimal: it proves the Next.js server is up and routing, and
 * leaks nothing (no version, no env, no DB detail). Used by the Docker image
 * HEALTHCHECK via `docker compose ps` / restart policies. Database reachability
 * is verified by the one-shot `migrate` service and the authed admin route
 * /api/admin/health/database — not by this public probe.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

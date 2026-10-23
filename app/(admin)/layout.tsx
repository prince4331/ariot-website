import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { RoleKey } from '@/lib/generated/prisma/client';
import { env } from '@/server/env';
import { getAuthorizationContext } from '@/server/auth/permissions';
import { prisma } from '@/server/db';
import { AdminShell } from '@/components/admin/admin-shell';

export const metadata: Metadata = {
  title: {
    default: 'Control',
    template: '%s — ARIOT Control',
  },
  description: 'ARIOT internal operations console.',
  robots: { index: false, follow: false },
};

/**
 * Admin route-group layout — Step 2.3.1.
 *
 * This is the security boundary for every admin page. It runs server-side on
 * every request under `(admin)/`:
 *   - no valid session  → redirect to /sign-in
 *   - valid session, no admin role → redirect to public site (no admin access)
 *   - valid session, admin role → render the shell with the caller's context
 *
 * Authorization is re-resolved from the database here (never from cookies or
 * client state). RBAC helpers live in `server/auth/permissions.ts`.
 */
const ADMIN_ROLES: RoleKey[] = ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SUPPORT_ADMIN', 'SALES_ADMIN'];

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getAuthorizationContext();
  if (!ctx) redirect('/sign-in');

  const isAdmin = ADMIN_ROLES.some((role) => ctx.roles.includes(role));
  if (!isAdmin) {
    // D-082/D2 loop safety: on the production admin subdomain the root path
    // `/` is a host-routed hop (see proxy.ts) that sends cookie-bearing
    // visitors straight back to `/admin`. A relative redirect here would
    // therefore bounce forever — always return non-admins to the canonical
    // public site (NEXT_PUBLIC_SITE_URL) instead. In local development that
    // resolves to `http://localhost:3000/` (same-origin homepage), matching
    // the previous behaviour.
    redirect(env.NEXT_PUBLIC_SITE_URL);
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true },
  });

  return (
    <AdminShell
      user={{
        name: user?.name ?? ctx.email,
        email: ctx.email,
        roles: ctx.roles,
      }}
      environment={env.NODE_ENV}
    >
      {children}
    </AdminShell>
  );
}

/**
 * scripts/reconcile-role-permissions.ts — Corrective Step C.1.
 *
 * Offline CLI for migrating role permissions from namespace wildcards to
 * explicit permission strings. Follows the same safety patterns as
 * scripts/bootstrap-admin.ts.
 *
 * Usage:
 *   pnpm permissions:reconcile              # dry-run (default, safe)
 *   pnpm permissions:reconcile --apply      # write to local DB
 *   pnpm permissions:reconcile --apply --production  # non-local DB
 *
 * Safety:
 *   - Dry-run by default (no writes).
 *   - Requires --apply for writes.
 *   - Requires --production for non-local databases.
 *   - Transactional writes (all-or-nothing).
 *   - Idempotent: repeated runs produce no additional changes.
 *   - Never modifies User, UserRole, Session, Account, or Product data.
 *   - Creates AuditLog entries only when permissions actually change.
 *   - Fails closed on unknown wildcard values.
 *   - Never prints credentials or full connection strings.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { utcPoolConfig } from '../server/db-timezone.ts';

const { Pool } = pg;

// ── Approved permission mappings (mirrors permission-catalog.ts) ──────────────

const ROLE_PERMISSION_SETS: Record<string, readonly string[]> = {
  SUPER_ADMIN: ['*'],
  CONTENT_ADMIN: [
    'blog.read',
    'blog.write',
    'categories.read',
    'categories.write',
    'inventory.read',
    'media.read',
    'media.write',
    'products.read',
    'products.write',
    'support_article.read',
    'support_article.write',
  ],
  SUPPORT_ADMIN: [
    'customer.read',
    'media.read',
    'media.write',
    'order.read',
    'products.read',
    'support_article.read',
    'support_article.write',
    'ticket.read',
    'ticket.reply',
  ],
  SALES_ADMIN: [
    'analytics.sales.read',
    'customer.read',
    'customer.write',
    'inventory.read',
    'order.read',
    'order.refund',
    'order.transition',
    'products.read',
    'quote.read',
    'quote.respond',
    'ticket.read',
  ],
};

const KNOWN_WILDCARDS = new Set([
  'products.*',
  'categories.*',
  'blog.*',
  'media.*',
  'support_articles.*',
  'tickets.*',
  'customers.*',
  'quotes.*',
  'orders.*',
]);

// ── Inline .env loader ───────────────────────────────────────────────────────

function loadDotEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)/);
    if (!m) continue;
    const key = m[1];
    const raw = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = raw;
  }
}

// ── Safety checks ────────────────────────────────────────────────────────────

function isLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port}/${parsed.pathname.replace(/^\//, '')}`;
  } catch {
    return '[invalid URL]';
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadDotEnv();

  const args = process.argv.slice(2);
  const applyMode = args.includes('--apply');
  const productionMode = args.includes('--production');

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  const isLocal = isLocalUrl(databaseUrl);

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ARIOT Role Permission Reconciliation — C.1         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Mode:     ${applyMode ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)'}`);
  console.log(`Database: ${sanitizeUrl(databaseUrl)}`);
  console.log(`Local:    ${isLocal}`);
  console.log();

  if (!isLocal && applyMode && !productionMode) {
    console.error('ERROR: Non-local database detected. Use --production to confirm.');
    process.exit(1);
  }

  // UTC session per D-070 (server/db-timezone.ts) — the AuditLog rows written
  // below must share the application's instant scale.
  const pool = new Pool(utcPoolConfig(databaseUrl));

  try {
    // ── Preflight: read current state ──────────────────────────────────────
    const rolesResult = await pool.query(
      'SELECT "key", "name", "permissions" FROM "Role" ORDER BY "key"',
    );

    if (rolesResult.rows.length === 0) {
      console.error('ERROR: No roles found in database.');
      process.exit(1);
    }

    console.log('── Current roles ──────────────────────────────────────');
    console.log();

    interface RoleChange {
      key: string;
      currentPermissions: string[];
      proposedPermissions: string[];
      removedWildcards: string[];
      addedPermissions: string[];
      unchanged: boolean;
    }

    const changes: RoleChange[] = [];
    let unknownWildcardFound = false;

    for (const row of rolesResult.rows) {
      const key = row.key as string;
      const current: string[] = Array.isArray(row.permissions) ? row.permissions : [];

      const approved = ROLE_PERMISSION_SETS[key];
      if (!approved) {
        console.error(`ERROR: Unknown role "${key}" found in database.`);
        console.error('       Cannot reconcile roles not in approved set.');
        process.exit(1);
      }

      // Check for unknown wildcards
      const wildcards = current.filter((p) => p.endsWith('.*') && p !== '*');
      for (const wc of wildcards) {
        if (!KNOWN_WILDCARDS.has(wc)) {
          console.error(`ERROR: Unknown wildcard "${wc}" in role "${key}".`);
          console.error('       Manual review required.');
          unknownWildcardFound = true;
        }
      }

      const proposed = [...approved].sort();
      const currentSorted = [...current].sort();
      const unchanged = JSON.stringify(currentSorted) === JSON.stringify(proposed);

      const removedWildcards = current.filter((p) => p.endsWith('.*') && p !== '*');
      const addedPermissions = proposed.filter((p) => !current.includes(p));

      changes.push({
        key,
        currentPermissions: current,
        proposedPermissions: proposed,
        removedWildcards,
        addedPermissions,
        unchanged,
      });

      const status = unchanged ? '  (no change)' : '  → WILL CHANGE';
      console.log(`  ${key}: ${current.length} permissions${status}`);
      if (!unchanged) {
        if (removedWildcards.length > 0) {
          console.log(`    Remove: ${removedWildcards.map((w) => `"${w}"`).join(', ')}`);
        }
        if (addedPermissions.length > 0) {
          console.log(`    Add:    ${addedPermissions.map((p) => `"${p}"`).join(', ')}`);
        }
        console.log(`    Result: ${proposed.length} permissions`);
      }
    }

    if (unknownWildcardFound) {
      console.error('\nAborting: unknown wildcard values require manual review.');
      process.exit(1);
    }

    console.log();

    const hasChanges = changes.some((c) => !c.unchanged);
    if (!hasChanges) {
      console.log('✓ All roles already use explicit permissions. No changes needed.');
      process.exit(0);
    }

    console.log(
      `── Summary: ${changes.filter((c) => !c.unchanged).length} role(s) will be updated ──`,
    );
    console.log();

    if (!applyMode) {
      console.log('DRY RUN complete. Use --apply to write changes.');
      process.exit(0);
    }

    // ── Apply changes in transaction ─────────────────────────────────────
    console.log('Applying changes...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const change of changes) {
        if (change.unchanged) continue;

        await client.query(
          'UPDATE "Role" SET "permissions" = $1::jsonb, "updatedAt" = NOW() WHERE "key" = $2',
          [JSON.stringify(change.proposedPermissions), change.key],
        );

        // AuditLog entry for the change
        await client.query(
          `INSERT INTO "AuditLog" ("id", "actorId", "actorRole", "action", "entityType", "entityId", "before", "after", "userAgent", "createdAt")
           VALUES (gen_random_uuid(), NULL, NULL, 'ROLE_PERMISSIONS_RECONCILED', 'Role', $1, $2::jsonb, $3::jsonb, 'permissions-reconcile-cli', NOW())`,
          [
            change.key,
            JSON.stringify({
              permissions: change.currentPermissions,
            }),
            JSON.stringify({
              permissions: change.proposedPermissions,
              removed_wildcards: change.removedWildcards,
              added_permissions: change.addedPermissions,
              source: 'permissions-reconcile-cli',
              step: 'C.1',
            }),
          ],
        );
      }

      await client.query('COMMIT');
      console.log();
      console.log('✓ Changes applied successfully.');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('ERROR: Transaction rolled back.');
      throw err;
    } finally {
      client.release();
    }

    // ── Post-apply verification ──────────────────────────────────────────
    console.log();
    console.log('── Post-apply verification ────────────────────────────');
    const verifyResult = await pool.query('SELECT "key", "permissions" FROM "Role" ORDER BY "key"');

    let verifyPass = true;
    for (const row of verifyResult.rows) {
      const key = row.key as string;
      const perms: string[] = Array.isArray(row.permissions) ? row.permissions : [];
      const hasWildcard = perms.some((p) => p.endsWith('.*') && p !== '*');
      const status = hasWildcard ? '✗ STILL HAS WILDCARDS' : '✓';
      console.log(`  ${key}: ${perms.length} permissions ${status}`);
      if (hasWildcard) verifyPass = false;
    }

    if (!verifyPass) {
      console.error('\nERROR: Verification failed — wildcards remain.');
      process.exit(1);
    }

    console.log();
    console.log('✓ All roles verified: no namespace wildcards remain.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

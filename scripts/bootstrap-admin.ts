/**
 * scripts/bootstrap-admin.ts — Step 2.2.5 Secure Admin Bootstrap
 *
 * Offline CLI tool that provisions the first ARIOT SUPER_ADMIN by creating
 * or reusing a User and idempotently assigning the SUPER_ADMIN role. This
 * script MUST be run explicitly by an operator; it is NEVER invoked during
 * application startup, build, deployment, migration, or ordinary seed.
 *
 * Usage:
 *   pnpm admin:bootstrap                  # dry-run (default, safe)
 *   pnpm admin:bootstrap --apply          # write to a local DB
 *   pnpm admin:bootstrap --apply --production  # write to a non-local DB
 *
 * Required environment variables (set in shell or .env):
 *   DATABASE_URL               PostgreSQL connection string
 *   BOOTSTRAP_ADMIN_EMAIL      Exact Google-verified email for the admin
 *   BOOTSTRAP_ADMIN_CONFIRM    Must be exactly: GRANT_SUPER_ADMIN
 *
 * Optional:
 *   BOOTSTRAP_ADMIN_NAME       Display name (default: "ARIOT Administrator")
 *
 * Security decisions (docs/07_DECISIONS.md D-037 – D-040):
 *   - No password is created; sign-in is Google OAuth only.
 *   - No Account or Session row is fabricated; Google links on first sign-in.
 *   - emailVerified is set to true on creation (operator-confirmed email).
 *   - A NULL-actor AuditLog row is written to record the system event.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { z } from 'zod';
import { utcPoolConfig } from '../server/db-timezone.ts';

const { Pool } = pg;

// ── Inline .env loader ───────────────────────────────────────────────────────
// Loads .env if it exists (development convenience). In production, set
// variables in the shell environment before running this script.
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
loadDotEnv();

// ── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const PRODUCTION_FLAG = args.includes('--production');

// ── Bootstrap env schema (Zod) ───────────────────────────────────────────────
const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  BOOTSTRAP_ADMIN_EMAIL: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().email('BOOTSTRAP_ADMIN_EMAIL must be a valid email address'),
  ),
  BOOTSTRAP_ADMIN_NAME: z
    .string()
    .min(1)
    .optional()
    .transform((v) => v ?? 'ARIOT Administrator'),
  BOOTSTRAP_ADMIN_CONFIRM: z.literal('GRANT_SUPER_ADMIN', {
    error: "BOOTSTRAP_ADMIN_CONFIRM must be exactly 'GRANT_SUPER_ADMIN'",
  }),
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  return at > 0 ? `${email.charAt(0)}***${email.slice(at)}` : '***@***';
}

function isLocalDatabase(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ['localhost', '127.0.0.1', '::1', ''].includes(hostname);
  } catch {
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const mode = APPLY ? 'APPLY' : 'DRY-RUN';
  console.log(`\n──────────────────────────────────────`);
  console.log(`  ARIOT Admin Bootstrap  [${mode}]`);
  console.log(`──────────────────────────────────────`);

  // Validate environment
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_NAME: process.env.BOOTSTRAP_ADMIN_NAME,
    BOOTSTRAP_ADMIN_CONFIRM: process.env.BOOTSTRAP_ADMIN_CONFIRM,
  });

  if (!parsed.success) {
    console.error('\nConfiguration error — missing or invalid variables:');
    for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
      console.error(`  ${k}: ${(v as string[]).join(', ')}`);
    }
    process.exit(1);
  }

  const { DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_NAME: name } = parsed.data;
  const masked = maskEmail(email);
  console.log(`  Target email : ${masked}`);
  console.log(`  Display name : ${name}`);

  // Production guard
  const localDb = isLocalDatabase(DATABASE_URL);
  if (APPLY && !localDb && !PRODUCTION_FLAG) {
    console.error(
      '\n  Non-local database detected. Add --production to confirm writes to a non-local database.',
    );
    process.exit(1);
  }
  if (!localDb) console.log('  DB           : NON-LOCAL (--production acknowledged)');

  // Connect — UTC session per D-070 (server/db-timezone.ts), so the AuditLog
  // row this script writes lands on the same instant scale as the application.
  const pool = new Pool(utcPoolConfig(DATABASE_URL));

  try {
    const client = await pool.connect();
    try {
      // ── Preflight ──────────────────────────────────────────────────────────
      console.log('\n── Preflight ──────────────────────────────────────────────');

      // DB connection
      console.log('  ✓ Database connection OK');

      // SUPER_ADMIN role must exist (created by seed)
      const { rows: roleRows } = await client.query<{ id: string; permissions: unknown }>(
        `SELECT id, permissions FROM "Role" WHERE key = 'SUPER_ADMIN' LIMIT 1`,
      );
      if (roleRows.length === 0) {
        console.error(
          '\n  ✗ SUPER_ADMIN role not found.\n    Run the database seed first: pnpm prisma db seed',
        );
        process.exit(1);
      }
      const roleId = roleRows[0].id;
      const rolePerms = roleRows[0].permissions;
      const perms = Array.isArray(rolePerms) ? (rolePerms as string[]) : [];
      const hasWildcard = perms.includes('*');
      console.log(
        `  ✓ SUPER_ADMIN role found (permissions: ${hasWildcard ? '"*" wildcard' : perms.length + ' keys'})`,
      );

      // Existing user check
      const { rows: userRows } = await client.query<{
        id: string;
        status: string;
        deletedAt: Date | null;
        emailVerified: boolean;
      }>(`SELECT id, status, "deletedAt", "emailVerified" FROM "User" WHERE email = $1 LIMIT 1`, [
        email,
      ]);

      const existingUser = userRows[0] ?? null;

      if (existingUser) {
        if (existingUser.status !== 'ACTIVE') {
          console.error(
            `\n  ✗ User ${masked} exists but has status=${existingUser.status}.\n    Manual review required before bootstrapping.`,
          );
          process.exit(1);
        }
        if (existingUser.deletedAt !== null) {
          console.error(
            `\n  ✗ User ${masked} is soft-deleted (deletedAt set).\n    Manual review required before bootstrapping.`,
          );
          process.exit(1);
        }
        console.log(`  ✓ User ${masked} already exists and is ACTIVE (will reuse)`);
      } else {
        console.log(`  ✓ No existing user for ${masked} (will create)`);
      }

      // Existing UserRole check
      let alreadyAssigned = false;
      if (existingUser) {
        const { rows: roleAssignRows } = await client.query(
          `SELECT 1 FROM "UserRole" WHERE "userId" = $1 AND "roleId" = $2 LIMIT 1`,
          [existingUser.id, roleId],
        );
        alreadyAssigned = roleAssignRows.length > 0;
        console.log(
          alreadyAssigned
            ? `  ✓ SUPER_ADMIN already assigned (will be a no-op)`
            : `  ✓ SUPER_ADMIN not yet assigned (will assign)`,
        );
      }

      // ── Plan ──────────────────────────────────────────────────────────────
      console.log('\n── Plan ──────────────────────────────────────────────────');
      console.log(
        `  User          : ${existingUser ? 'REUSE existing ACTIVE user' : 'CREATE new user'}`,
      );
      console.log(`  passwordHash  : NOT SET (Google OAuth only)`);
      console.log(`  Account row   : NOT CREATED (Google links on first sign-in)`);
      console.log(`  Session       : NOT CREATED`);
      console.log(
        `  emailVerified : ${existingUser ? 'unchanged' : 'TRUE (operator-confirmed email)'}`,
      );
      console.log(
        `  UserRole      : ${alreadyAssigned ? 'NO-OP (already assigned)' : 'ASSIGN SUPER_ADMIN'}`,
      );
      console.log(`  AuditLog      : WRITE system bootstrap event`);

      if (!APPLY) {
        console.log('\n── DRY-RUN complete — no rows written. ──');
        console.log('   Add --apply to execute the above plan.\n');
        return;
      }

      // ── Apply (transaction) ───────────────────────────────────────────────
      console.log('\n── Applying... ────────────────────────────────────────────');
      await client.query('BEGIN');

      try {
        let userId = existingUser?.id ?? null;

        if (!userId) {
          const newId = randomUUID();
          await client.query(
            `INSERT INTO "User"
               (id, email, name, "emailVerified", locale, "preferredCurrency",
                status, "deletedAt", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, 'en', 'BDT', 'ACTIVE', NULL, NOW(), NOW())
             ON CONFLICT (email) DO NOTHING`,
            [newId, email, name, true],
          );
          // Re-fetch in case of concurrent ON CONFLICT
          const { rows: refetch } = await client.query<{ id: string }>(
            `SELECT id FROM "User" WHERE email = $1 LIMIT 1`,
            [email],
          );
          userId = refetch[0]?.id ?? null;
          if (!userId) throw new Error('User creation failed — id could not be resolved.');
          console.log(`  ✓ User created`);
        }

        // Idempotent SUPER_ADMIN assignment
        const { rowCount: assignedCount } = await client.query(
          `INSERT INTO "UserRole" ("userId", "roleId") VALUES ($1, $2)
           ON CONFLICT ("userId", "roleId") DO NOTHING`,
          [userId, roleId],
        );
        if ((assignedCount ?? 0) > 0) {
          console.log(`  ✓ SUPER_ADMIN role assigned`);
        } else {
          console.log(`  ✓ SUPER_ADMIN role was already assigned (no-op)`);
        }

        // AuditLog — system-originated event; actorId NULL is valid per schema
        await client.query(
          `INSERT INTO "AuditLog"
             (id, "actorId", "actorRole", action, "entityType", "entityId",
              after, "userAgent", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())`,
          [
            randomUUID(),
            null, // system-originated; no human actorId (nullable per schema)
            null, // no actorRole for CLI system action (nullable per schema)
            'ADMIN_BOOTSTRAPPED',
            'User',
            userId,
            JSON.stringify({
              roleName: 'SUPER_ADMIN',
              emailMasked: masked,
              source: 'bootstrap-admin',
            }),
            'bootstrap-cli',
          ],
        );
        console.log(`  ✓ AuditLog entry written`);

        await client.query('COMMIT');

        console.log('\n── Bootstrap complete ─────────────────────────────────────');
        console.log(`  Admin email : ${masked}`);
        console.log(`  Role        : SUPER_ADMIN`);
        console.log(
          `  Next step   : Sign in at /sign-in with the Google account that owns ${masked}\n`,
        );
      } catch (writeErr) {
        await client.query('ROLLBACK');
        throw writeErr;
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  // Never log the full error object — it may contain pg connection details.
  console.error('\nBootstrap failed:', msg);
  process.exit(1);
});

/**
 * Central permission catalog — Corrective Step C.1.
 *
 * Single source of truth for all permission strings used throughout the system.
 * Every server-side `requirePermission` / `requireAnyPermission` call MUST
 * reference a value from this catalog (or the global wildcard `"*"`).
 *
 * Naming convention:
 *   <module>.<action>
 *   - Lowercase, dot-separated, no whitespace, no trailing wildcard.
 *   - Module names match the admin route group (plural for catalog modules,
 *     singular for domain entities as established in live code and nav).
 *   - Actions: read, write (create+update), publish, archive, transition,
 *     reply, respond, refund, manage.
 *
 * The ONLY supported wildcard is the global `"*"` assigned to SUPER_ADMIN.
 * Namespace wildcards (e.g. "products.*") are PROHIBITED — see D-060.
 *
 * Decision: D-060, D-063 (C.1 implementation).
 */

// ── Permission constants ─────────────────────────────────────────────────────

export const PERMISSIONS = {
  products: {
    read: 'products.read',
    write: 'products.write',
  },
  categories: {
    read: 'categories.read',
    write: 'categories.write',
  },
  blog: {
    read: 'blog.read',
    write: 'blog.write',
  },
  media: {
    read: 'media.read',
    write: 'media.write',
  },
  support_article: {
    read: 'support_article.read',
    write: 'support_article.write',
  },
  order: {
    read: 'order.read',
    transition: 'order.transition',
    refund: 'order.refund',
  },
  ticket: {
    read: 'ticket.read',
    reply: 'ticket.reply',
  },
  quote: {
    read: 'quote.read',
    respond: 'quote.respond',
  },
  customer: {
    read: 'customer.read',
    write: 'customer.write',
  },
  analytics: {
    sales_read: 'analytics.sales.read',
  },
  user: {
    manage: 'user.manage',
  },
  role: {
    manage: 'role.manage',
  },
  audit_log: {
    read: 'audit_log.read',
  },
  settings: {
    write: 'settings.write',
  },
  inventory: {
    read: 'inventory.read',
    adjust: 'inventory.adjust',
  },
} as const;

/** The global wildcard — ONLY for SUPER_ADMIN. */
export const GLOBAL_WILDCARD = '*' as const;

// ── Permission type ──────────────────────────────────────────────────────────

/** Union of all known explicit permission strings. */
type PermissionValues<T> =
  T extends Record<string, infer V>
    ? V extends string
      ? V
      : V extends Record<string, string>
        ? V[keyof V]
        : never
    : never;

export type Permission = PermissionValues<typeof PERMISSIONS>;

// ── Role permission sets ─────────────────────────────────────────────────────

/**
 * Approved role → explicit permission assignments.
 *
 * Derived from ADMIN_DASHBOARD_PLAN §3.2 permission matrix + seed intent.
 * Every non-SUPER_ADMIN role lists explicit permissions only.
 *
 * SUPER_ADMIN retains the global `"*"` wildcard.
 *
 * Rules:
 * - A role with `.write` must ALSO have `.read` for the same module.
 * - No namespace wildcards permitted.
 * - Sorted alphabetically for deterministic comparison.
 */
export const ROLE_PERMISSION_SETS = {
  SUPER_ADMIN: [GLOBAL_WILDCARD],
  CONTENT_ADMIN: [
    PERMISSIONS.blog.read,
    PERMISSIONS.blog.write,
    PERMISSIONS.categories.read,
    PERMISSIONS.categories.write,
    PERMISSIONS.inventory.read,
    PERMISSIONS.media.read,
    PERMISSIONS.media.write,
    PERMISSIONS.products.read,
    PERMISSIONS.products.write,
    PERMISSIONS.support_article.read,
    PERMISSIONS.support_article.write,
  ],
  SUPPORT_ADMIN: [
    PERMISSIONS.customer.read,
    PERMISSIONS.media.read,
    PERMISSIONS.media.write,
    PERMISSIONS.order.read,
    PERMISSIONS.products.read,
    PERMISSIONS.support_article.read,
    PERMISSIONS.support_article.write,
    PERMISSIONS.ticket.read,
    PERMISSIONS.ticket.reply,
  ],
  SALES_ADMIN: [
    PERMISSIONS.analytics.sales_read,
    PERMISSIONS.customer.read,
    PERMISSIONS.customer.write,
    PERMISSIONS.inventory.read,
    PERMISSIONS.order.read,
    PERMISSIONS.order.refund,
    PERMISSIONS.order.transition,
    PERMISSIONS.products.read,
    PERMISSIONS.quote.read,
    PERMISSIONS.quote.respond,
    PERMISSIONS.ticket.read,
  ],
} as const;

// ── Wildcard-to-explicit mapping ─────────────────────────────────────────────

/**
 * Approved mapping from legacy namespace wildcards to explicit permission sets.
 * Used ONLY by the reconciliation CLI to safely convert existing DB records.
 *
 * Unknown wildcards (not listed here) MUST be rejected by the CLI.
 */
export const WILDCARD_EXPANSION: Record<string, readonly string[]> = {
  'products.*': [PERMISSIONS.products.read, PERMISSIONS.products.write],
  'categories.*': [PERMISSIONS.categories.read, PERMISSIONS.categories.write],
  'blog.*': [PERMISSIONS.blog.read, PERMISSIONS.blog.write],
  'media.*': [PERMISSIONS.media.read, PERMISSIONS.media.write],
  'support_articles.*': [PERMISSIONS.support_article.read, PERMISSIONS.support_article.write],
  'tickets.*': [PERMISSIONS.ticket.read, PERMISSIONS.ticket.reply],
  'customers.*': [PERMISSIONS.customer.read, PERMISSIONS.customer.write],
  'quotes.*': [PERMISSIONS.quote.read, PERMISSIONS.quote.respond],
  'orders.*': [PERMISSIONS.order.read, PERMISSIONS.order.transition, PERMISSIONS.order.refund],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pure permission evaluator: does the granted set satisfy the required permission?
 *
 * Rules:
 * - If granted contains `"*"`, always allowed (SUPER_ADMIN global wildcard).
 * - Otherwise, exact string match only.
 * - Namespace wildcards (e.g. "products.*") do NOT match specific permissions.
 *
 * This function is deliberately pure (no DB, no side effects) for testability.
 */
export function hasPermission(
  grantedPermissions: readonly string[],
  requiredPermission: string,
): boolean {
  if (grantedPermissions.includes(GLOBAL_WILDCARD)) return true;
  return grantedPermissions.includes(requiredPermission);
}

/**
 * Pure evaluator: do granted permissions satisfy ALL required permissions?
 */
export function hasAllPermissions(
  grantedPermissions: readonly string[],
  requiredPermissions: readonly string[],
): boolean {
  if (requiredPermissions.length === 0) return false;
  if (grantedPermissions.includes(GLOBAL_WILDCARD)) return true;
  return requiredPermissions.every((perm) => grantedPermissions.includes(perm));
}

/**
 * Pure evaluator: do granted permissions satisfy ANY of the required permissions?
 */
export function hasAnyPermission(
  grantedPermissions: readonly string[],
  requiredPermissions: readonly string[],
): boolean {
  if (grantedPermissions.includes(GLOBAL_WILDCARD)) return true;
  return requiredPermissions.some((perm) => grantedPermissions.includes(perm));
}

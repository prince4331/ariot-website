import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  Receipt,
  LifeBuoy,
  FileText,
  Users,
  Settings,
} from 'lucide-react';

/**
 * Admin navigation configuration — Step 2.3.2.
 *
 * Single source of truth for the admin left-rail.  Two entry shapes are used:
 *   - `kind: 'link'`  — a standalone top-level link (Overview)
 *   - `kind: 'group'` — a collapsible section with leaf links (Catalog, Sales…)
 *
 * Leaf items carry an optional `href` even when `soon: true` so the breadcrumb
 * helper can resolve label names for future pages before they exist in the nav
 * as enabled links.  The rail renders soon items as disabled spans rather than
 * working links, so no soon item is reachable from the nav regardless of href.
 *
 * Permissions in `AdminNavLeaf.permission` are informational only — they
 * document which server-side permission key governs the corresponding page.
 * They are NOT a security boundary.  Server-side RBAC in every layout/action
 * is the real guard (ADMIN_DASHBOARD_PLAN §3, docs/07_DECISIONS.md D-035).
 *
 * No emoji icons — Lucide glyphs only (ADMIN_DASHBOARD_PLAN §2.2).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AdminNavLeaf {
  label: string;
  /** Intended future route.  Present even on soon items for breadcrumb lookup. */
  href?: string;
  /**
   * Permission key that gates this page server-side.  Informational metadata
   * for config readability and future client-side filtering prep.
   * NOT a security boundary.
   */
  permission?: string;
  /** Item is planned but the route does not exist yet. */
  soon?: boolean;
}

export type AdminNavEntry =
  | {
      kind: 'link';
      label: string;
      href: string;
      icon: LucideIcon;
    }
  | {
      kind: 'group';
      label: string;
      icon: LucideIcon;
      items: ReadonlyArray<AdminNavLeaf>;
    };

// ── Navigation data ───────────────────────────────────────────────────────────

/**
 * Approved groups and leaf items from ADMIN_DASHBOARD_PLAN §4 and Step 2.3.2.
 * Routes without pages are marked `soon: true`; they render as disabled spans.
 * Wire real `href`s and remove `soon` as each admin feature page lands.
 */
export const adminNav: ReadonlyArray<AdminNavEntry> = [
  // Top-level Overview link — the only enabled route today.
  {
    kind: 'link',
    label: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
  },

  // Catalog — products and category management (Steps 2.4.x)
  {
    kind: 'group',
    label: 'Catalog',
    icon: Package,
    items: [
      // Products enabled — Step 2.4.2
      { label: 'Products', href: '/admin/products', permission: 'products.read' },
      // Inventory enabled — Step 2.4.6A1 (the only stock-mutation surface)
      { label: 'Inventory', href: '/admin/inventory', permission: 'inventory.read' },
      // Categories: page not yet built — Step 2.4.7
      {
        label: 'Categories',
        href: '/admin/categories',
        soon: true,
        permission: 'categories.write',
      },
    ],
  },

  // Sales — orders, quotes, customers (Steps 2.6.x / 2.7.x)
  {
    kind: 'group',
    label: 'Sales',
    icon: Receipt,
    items: [
      { label: 'Orders', href: '/admin/orders', soon: true, permission: 'order.read' },
      { label: 'Quotes', href: '/admin/quotes', soon: true, permission: 'quote.read' },
      { label: 'Customers', href: '/admin/customers', soon: true, permission: 'customer.read' },
    ],
  },

  // Support — tickets and knowledge-base articles (Steps 2.8.x)
  {
    kind: 'group',
    label: 'Support',
    icon: LifeBuoy,
    items: [
      { label: 'Tickets', href: '/admin/tickets', soon: true, permission: 'ticket.read' },
      {
        label: 'Articles',
        href: '/admin/support/articles',
        soon: true,
        permission: 'support_article.write',
      },
    ],
  },

  // Content — blog posts and media library (Steps 2.5.x / L3 launch CMS)
  {
    kind: 'group',
    label: 'Content',
    icon: FileText,
    items: [
      // Blog & Updates enabled — L3 Minimal Marketing CMS
      {
        label: 'Blog & Updates',
        href: '/admin/blog',
        permission: 'blog.read',
      },
      { label: 'Media', href: '/admin/media', soon: true, permission: 'media.write' },
    ],
  },

  // Operations — users, roles, audit log (super_admin only pages)
  {
    kind: 'group',
    label: 'Operations',
    icon: Users,
    items: [
      { label: 'Users', href: '/admin/users', soon: true, permission: 'user.manage' },
      { label: 'Roles', href: '/admin/roles', soon: true, permission: 'role.manage' },
      { label: 'Audit Log', href: '/admin/audit-log', soon: true, permission: 'audit_log.read' },
    ],
  },

  // Settings — site config, payments, email templates (super_admin only)
  {
    kind: 'group',
    label: 'Settings',
    icon: Settings,
    items: [
      { label: 'Settings', href: '/admin/settings', soon: true, permission: 'settings.write' },
    ],
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * True when `pathname` corresponds to the given `href`.
 *
 * Overview (/admin) uses exact matching so it does not activate for every
 * nested admin route.  All other routes use prefix matching so sub-paths
 * (e.g. /admin/products/123) keep their parent leaf highlighted.
 *
 * Disabled (soon) items are never considered active.
 */
export function isLeafActive(pathname: string, href: string, soon?: boolean): boolean {
  if (soon) return false;
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Derive a human-readable breadcrumb label from `pathname`.
 *
 * Searches all nav entries (including soon items, which carry their intended
 * href).  Falls back to capitalising the last path segment for routes not yet
 * in the config.
 */
export function breadcrumbForPath(pathname: string): string {
  for (const entry of adminNav) {
    if (entry.kind === 'link') {
      if (pathname === entry.href) return entry.label;
    } else {
      for (const leaf of entry.items) {
        if (!leaf.href) continue;
        if (pathname === leaf.href || pathname.startsWith(`${leaf.href}/`)) {
          return leaf.label;
        }
      }
    }
  }
  // Fallback: capitalise and de-hyphenate the last path segment.
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? '';
  return segment
    ? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
    : 'Overview';
}

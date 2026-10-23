# ADMIN_DASHBOARD_PLAN.md

The internal cockpit for ARIOT operations. Page-by-page spec, RBAC matrix, and UX rules. Pair with `docs/SITE_MAP.md` (route enumeration), `docs/TECH_ARCHITECTURE.md` (admin architecture), and `docs/DATABASE_SCHEMA_PLAN.md` (data model).

The dashboard exists to **replace spreadsheets**. Every screen must answer: *what is the operator trying to do here, and how few clicks does it take?*

---

## 1. Goals

1. Replace spreadsheet-driven workflows for products, orders, tickets, and quotes.
2. Give operators trustworthy, real-time data with explicit state controls.
3. Audit every change.
4. Be fast on mid-range hardware over regional networks.
5. Be safe — destructive actions are explicit, role-gated, and reversible where possible.

---

## 2. Layout

### 2.1 Shell

- **Top bar** (sticky): logo, current section breadcrumb, global search, notifications, profile menu.
- **Left rail** (sticky on desktop, drawer on mobile): nav groups — Overview, Catalog, Sales, Support, Content, Operations, Settings.
- **Main area**: page content with a consistent header (page title + actions + filters).
- **Footer**: build version, environment chip, link to changelog.

### 2.2 Visual language

- Same design tokens as the public site (`docs/DESIGN_SYSTEM.md`). Admin is **not** a different theme — it is a denser variant of the same brand.
- Density: tables are compact (row height 40 px) but breathable; controls are 32–40 px.
- Color: status chips use semantic tokens (`success`, `warning`, `danger`, `info`, neutral steel).
- No emoji icons. Lucide + custom robotics/IoT glyphs only.

### 2.3 Density modes

- **Comfortable** (default) — 40 px row, 16 px gutter.
- **Compact** — 32 px row, 12 px gutter — toggle in user preference.

---

## 3. RBAC

### 3.1 Roles

| Role | Permissions (high level) |
|---|---|
| `super_admin` | Everything, including user/role management and settings. |
| `content_admin` | Products, categories, blog, media, support articles. No orders, tickets, customers, settings. |
| `support_admin` | Tickets, customers (read-only on PII), products (read-only), support articles. |
| `sales_admin` | Quotes, orders, customers (full), products (read-only), analytics (sales). |

Role check happens **server-side** in every layout and every server action.

### 3.2 Permission matrix (selected)

| Permission | super | content | support | sales |
|---|---|---|---|---|
| `product.read` | ✓ | ✓ | ✓ | ✓ |
| `product.write` | ✓ | ✓ | — | — |
| `category.write` | ✓ | ✓ | — | — |
| `media.write` | ✓ | ✓ | ✓ | — |
| `blog.write` | ✓ | ✓ | — | — |
| `support_article.write` | ✓ | ✓ | ✓ | — |
| `order.read` | ✓ | — | ✓ | ✓ |
| `order.transition` | ✓ | — | — | ✓ |
| `order.refund` | ✓ | — | — | partial |
| `ticket.read` | ✓ | — | ✓ | ✓ |
| `ticket.reply` | ✓ | — | ✓ | — |
| `quote.read` | ✓ | — | — | ✓ |
| `quote.respond` | ✓ | — | — | ✓ |
| `customer.read` | ✓ | — | ✓ | ✓ |
| `customer.write` | ✓ | — | — | ✓ |
| `user.manage` | ✓ | — | — | — |
| `role.manage` | ✓ | — | — | — |
| `settings.write` | ✓ | — | — | — |
| `audit_log.read` | ✓ | — | — | — |

`order.refund (partial)` for sales = sales can request a refund; super_admin must approve.

---

## 4. Pages

### 4.1 `/admin` — Overview

**Goal**: in 5 seconds, the operator knows what needs attention today.

- **KPI strip**: 6 cards — Today's revenue (BDT toggle USD), Orders today, New quotes, Open tickets (with SLA-breach count), Low-stock products, Active customers (last 7 days).
- **Activity feed**: last 20 admin actions (audit log).
- **Pending action queues**:
  - Orders awaiting fulfillment.
  - Tickets without first response (with SLA timer).
  - Quotes without assignment.
- **Traffic + conversion mini-chart**: last 30 days, sourced from analytics.
- **System health**: uptime, payment provider status, queue depth.

**Permissions**: visible to all admin roles, KPIs scoped to role.

### 4.2 Catalog

#### `/admin/products`

- Data table with: image thumb, name, SKU, category, status (chip), stock, price (BDT primary, USD parenthetical), updatedAt, actions menu.
- Filters: status, category, sales type (B2C/B2B/HYBRID), low-stock, has-image, has-video.
- Bulk actions: publish, unpublish, archive, change category, change sales type.
- Server-side pagination, sort, filter.
- "+ New product" CTA.

#### `/admin/products/new` and `/admin/products/:id`

Tabbed editor:

1. **Details** — name, slug (auto from name, editable, with redirect creation on change post-publish), tagline, description (MDX editor with preview), category, sales type, status, brand, base price, currency, stock, stock policy, weight, dimensions, highlights (list), in-the-box (list).
2. **Media** — image gallery (sortable, primary toggle, alt text per image), video gallery (with poster), 3D model upload (when applicable). Uploads go through the **media storage provider** (`server/storage/`, D-068): the working default is the **local** provider (`MEDIA_STORAGE_PROVIDER=local`, `POST /api/admin/media/uploads/local`, delivery via `/media/[...segments]`); R2 (`MEDIA_STORAGE_PROVIDER=r2`) uses presigned URLs. The client resolves the provider via `GET /api/admin/media/upload/mode`. Implemented in Step 2.4.4 (✅ 2026-08-18).
3. **Variants** — option groups (Color, Voltage, …) as **free-form `optionValues` key/value pairs**; variant matrix; per-variant SKU, price, stock, barcode. Implemented in Step 2.4.5 (✅ Closed 2026-08-18): `/admin/products/[id]/variants` + `POST /api/admin/products/variants` (create/update/archive dispatch); option-values normalized server-side (trim; ≤20 keys; key ≤40; value ≤100; order-independent combination uniqueness via `optionCombinationKey`); SKU normalized **uppercase** with global uniqueness (incl. archived variants + active products); concurrency via `Product.updatedAt` (409 on stale); archive = soft-delete (`deletedAt`, idempotent, SKU stays reserved); per-mutation AuditLog (`PRODUCT_VARIANT_CREATED`/`_UPDATED`/`_ARCHIVED`, entityType `Product`); optimistic UI with conflict banner; read-only view without `products.write`. Final production-service verification (2026-08-18): real executors tested through the shared authorization boundary on disposable PostgreSQL (376/376 pass). **Default-variant invariant DEFERRED**: there is no DB constraint on `isDefault`; zero or multiple defaults are possible today — the service only clears other defaults when a variant is set to `true`, and the UI exposes the toggle. An exactly-one-default invariant (per product) is intentionally NOT invented here; define it in the roadmap before Step 2.4.6. See decision D-069.
 4. **Inventory** — current stock, reorder point, reorder quantity, stock movements log (read-only). **Implemented (Step 2.4.6A1 + 2.4.6A3, decisions D-073/D-074/D-075/D-077)**: the Inventory tab (`/admin/inventory`) is the **only** stock-mutation surface; variant `stock` is read-only; permissions `inventory.read` (SUPER_ADMIN + CONTENT_ADMIN + SALES_ADMIN) and `inventory.adjust` (SUPER_ADMIN only via `*`); manual adjustments require `reason` + `note`, use `deltaQty`, and lock the authoritative row with `SELECT ... FOR UPDATE` inside one transaction that also writes the `StockMovement` ledger row (D-077) and the `AuditLog` row; the `StockMovement` ledger is append-only (DB trigger rejects UPDATE/DELETE — D-075); physical stock is never negative — D-071/D-076. The read-only **History dialog** (DataTable) shows movements filtered by product/variant (any `inventory.read` role). The Step 2.4.6A2 catalog page was intentionally skipped per the implementation-scope decision (only manual adjustment was needed).
5. **SEO** — meta title, meta description, OG image override, canonical override (advanced).
6. **Related** — related, cross-sell, accessory, alternative selectors.
7. **Downloads** — datasheet, manual, quickstart, CAD, firmware (with version) — uploaded as `MediaAsset` with `kind`.
8. **History** — audit log scoped to this product.

Save as draft / Schedule publish / Publish now.

#### `/admin/categories`

- Tree view with drag-to-reorder.
- Edit category drawer: name, slug, description, hero image, SEO, parent.

### 4.3 Sales

#### `/admin/orders`

- Table: order number, customer, status (chip), placedAt, total (BDT primary, USD secondary), payment provider, fulfillment.
- Filters: status, payment provider, date range, country, fulfillment.
- Bulk actions: mark packed, mark shipped, export.

#### `/admin/orders/:id`

- Header: order number, status timeline, primary action (next-state CTA).
- Sections:
  - **Customer**: name, email, phone, link to customer detail.
  - **Line items**: name, SKU, qty, price, line total. Click to product.
  - **Address**: shipping + billing.
  - **Payments**: list of payment attempts with provider, status, captured/refunded amount, raw-payload-redacted JSON viewer (super_admin only).
  - **Shipments**: carrier, tracking, status. Add shipment.
  - **Discounts**: voucher code applied (if any).
  - **Notes**: internal-only operator notes.
- State transitions enforced (e.g., can't ship before paid).
- Refund flow: full or partial; reason required; goes through provider adapter.
- Audit log of all changes.

#### `/admin/quotes`

- Table: quote number, contact, company, industry, products, status (chip), assignedTo, age (since received), action menu.
- Filters: status, industry, assignedTo, country, age.

#### `/admin/quotes/:id`

- Customer info, project info, products of interest, attachments.
- Internal notes thread.
- Response composer (rich text + attachments) — sends email to customer; recorded as a `QuoteEvent`.
- "Convert to order" — pre-fills an order draft from the quote.
- Status controls (Received → In review → Responded → Won / Lost).

#### `/admin/customers`

- Table: name, email, country, segment (B2C/B2B/EDU), orders count, lifetime value, lastActivityAt.

#### `/admin/customers/:id`

- Tabs: Overview, Orders, Quotes, Tickets, Devices `[Phase 5]`, Notes.
- Inline edit of segment, account manager, internal notes.
- "Open ticket on behalf" / "Create order draft" actions.

### 4.4 Support

#### `/admin/tickets`

- Table: ticket number, subject, customer, priority, status, assignedTo, SLA timer (countdown or breached), age, lastActivityAt.
- Filters: status, priority, assignedTo, related product, SLA breached.
- Bulk actions: assign, change priority, close.

#### `/admin/tickets/:id`

- Header: ticket number, subject, customer link, priority, status, SLA timer.
- Thread view: customer messages + agent messages + internal notes (visually distinct).
- Composer: rich text + attachments + macros (canned responses) + internal-note toggle.
- Side panel: customer summary, related order, related product, ticket history.
- Status controls; close requires resolution summary.

#### `/admin/support/articles`

- Same pattern as blog list (see below) — table + editor.

### 4.5 Content

> **L3 Launch status (2026-09-01)**: Blog/Updates admin is **LIVE** — single focused editor (no tab suite yet). The tab-based editor, category admin, bulk actions, and advanced SEO tab are `[future]` and intentionally out of launch scope.

#### `/admin/blog` — **LIVE (L3)**

- Table: cover, title, category, status (chip), author, publishedAt / updatedAt, action menu (edit).
- Cursor pagination + `ILIKE` search. `blog.read` RBAC. `<meta name="robots" content="noindex">`.

#### `/admin/blog/new` and `/admin/blog/:id` — **LIVE (L3)**

- Fields: title, slug (auto-derived), excerpt, body (Markdown — no MDX execution), category, cover image, status, publishedAt, SEO title/description.
- Strict Zod contract, unknown fields rejected, slug dedupe, optimistic concurrency (`expectedUpdatedAt`), server-derived author/actor, safe publication transition, audit on success only.

#### `/admin/blog/categories`

- Tree edit, slug, description, SEO. `[future]` — categories currently seeded (robotics-rd, iot-in-bangladesh, engineering-notes); no admin UI yet.

#### `/admin/media`

- Library with grid view + table view toggle.
- Filters: kind (image/video/document/firmware/3D), folder, tag, isPublic, uploadedBy, dateRange.
- Bulk actions: move folder, tag, archive, delete (super_admin only).
- Detail drawer: preview, alt text, caption, source AI prompt link, usage map (where this asset is referenced).
- Upload via drag-drop or button — signed URL, MIME + size validated server-side.
- Replace flow: keep stable `id`, swap underlying file (with version history).

### 4.6 Operations

#### `/admin/users`

- Admin user list. Invite via email; super_admin assigns roles.
- Disable / reactivate; password reset trigger; 2FA enforce per role `[future]`.

#### `/admin/roles`

- Role list with permission matrix editor (super_admin only).

#### `/admin/audit-log`

- Filterable table: actor, action, entityType, entityId, ipHash, createdAt.
- Detail drawer with `before`/`after` JSON diff (super_admin only).
- Export CSV.

### 4.7 Settings

`/admin/settings` — sectioned page:

- **Site** — site name, default SEO, default OG image, contact emails.
- **Currencies & FX** — enabled currencies, daily FX snapshot upload / API source.
- **Taxes** — VAT % per country, inclusive/exclusive.
- **Shipping zones** — country/region mapping, methods, rates, free-ship thresholds.
- **Payment providers** — toggles per provider with credentials editor (super_admin only); webhook test buttons.
- **Email templates** — per-event template with preview (uses Resend or equivalent).
- **Feature flags** — env-driven toggles.
- **Webhooks** — outbound webhooks (Slack notification on new order/quote/ticket).

### 4.8 Analytics

`/admin/analytics`:

- **Sales** — revenue over time, by category, by provider; conversion funnel (visit → product detail → cart → checkout → order).
- **Traffic** — sessions, sources, top pages (from Vercel Analytics + Plausible).
- **Support** — ticket volume, SLA performance, CSAT.
- **Content** — top blog posts, support article helpfulness.

---

## 5. UX rules

### 5.1 Data tables

- Server-side pagination, sort, filter — no client-side full dataset loads.
- Cursor-based pagination preferred over offset for large tables.
- Row click = open detail (drawer for quick edits, full page for deep edits).
- Keyboard navigation: arrows + enter, `j/k` for next/prev row.
- Save filter presets per user.

### 5.2 Forms

- Auto-save drafts every 30 s where applicable (products, blog posts, support articles).
- Confirmation prompt on unsaved exit.
- Validation: server-side authoritative; client-side mirrors via Zod resolver.
- Errors inline next to fields, summarized at top of form for screen readers.

### 5.3 Mutations

- **Optimistic UI** for low-risk updates (toggle published, reorder media, change tag).
- **Pessimistic** for money / stock / state-machine moves — show pending state, await server confirmation.
- Every mutation writes to `AuditLog`.
- Destructive actions: confirmation modal with typed-confirmation for catastrophic ones (e.g., "Type DELETE to confirm").

### 5.4 Empty / loading / error states

- Empty state teaches: e.g., empty products table shows "Create your first product" CTA + link to docs.
- Loading: skeletons matching the final layout, never spinners on table cells.
- Error: human-readable, actionable, with a "Retry" or "Contact engineering" link.

### 5.5 Notifications

- Toast for success / non-blocking errors.
- Top-right notifications panel for: new orders, SLA breaches, payment failures, system alerts.
- Email-on-call for: payment provider outage, queue depth alerts, security events (super_admin only).

### 5.6 Mobile admin

- The admin dashboard is **fully usable on mobile** but secondary. Tables scroll horizontally with sticky first column; common actions accessible from a bottom action sheet.
- Phase 1 of admin: optimize Orders, Quotes, Tickets for mobile (these are the on-call screens).

---

## 6. Performance budgets (admin)

- LCP ≤ 2.0 s on the overview page.
- Initial JS (gzip) ≤ 240 KB.
- Tables render up to 50 rows in < 200 ms once data is in.
- Time-to-interactive ≤ 2.5 s on product editor.

---

## 7. Security specifics

- Admin routes protected by middleware that re-verifies session + role on every navigation.
- Server actions check role before any DB read/write that exceeds the role's permissions.
- IP allow-list option for super_admin sessions (settings).
- 2FA enforcement option per role `[future, before live ecommerce]`.
- Audit log is **append-only** at the DB level (no update/delete grants for app role).
- Sensitive payment payloads stored only for the `super_admin` role and only in scrubbed JSON (no PAN, no CVV, no full card data).

---

## 8. Phase boundary

- **Phase 2** ships: Catalog, Content (blog + media), Operations (users/roles/audit), Settings (basic), Overview (with content KPIs only).
- **Phase 3** adds: Sales (orders, customers, settings → currencies/taxes/shipping/payments), full Overview KPIs.
- **Phase 4** adds: Support workspace.
- **Phase 5** adds: Devices tab on customer detail; firmware management UI.

---

## 9. Complete Admin Information Architecture (Freeze — 2026-07-10)

This section documents the **complete planned admin navigation** after the corrective planning step. All items are planned unless marked ✅ (implemented). Not all items need to be built in Phase 2; see `IMPLEMENTATION_MASTER_PLAN.md` for sequencing.

```
ARIOT Control

├── Overview (/admin) ✅
│
├── Catalog
│   ├── Products (/admin/products) ✅ Step 2.4.2
│   ├── Components (/admin/components) [planned 2.14.2]
│   ├── Categories (/admin/categories) [planned 2.4.7]
│   ├── Inventory (/admin/inventory) [Step 2.4.6A1 ✅ — mutation surface; Step 2.4.6A3 ✅ — StockMovement ledger + History dialog]
│   └── Media (/admin/media) [planned 2.6.1]
│
├── R&D
│   ├── Projects (/admin/rd/projects) [planned 2.10.2]
│   ├── Project Updates (/admin/rd/updates) [planned 2.10.4]
│   └── Public Milestones (/admin/rd/milestones) [planned 2.10.3]
│
├── Workspace
│   ├── Plans (/admin/workspace/plans) [planned 2.13.3]
│   ├── Facilities (/admin/workspace/facilities) [planned 2.13.4]
│   ├── Availability (/admin/workspace/availability) [planned 2.13.5]
│   ├── Bookings (/admin/workspace/bookings) [planned 2.13.6]
│   ├── Calendar (/admin/workspace/calendar) [planned 2.13.7]
│   └── Interests (/admin/workspace/interests) [planned 2.13.8]
│
├── Promotions
│   ├── All Promotions (/admin/promotions) [planned 2.12.2]
│   ├── Placement Rules (/admin/promotions/placements) [planned 2.12.5]
│   └── Coupons (/admin/promotions/coupons) [planned 2.12.4]
│
├── Content
│   ├── Homepage (/admin/content/homepage) [planned 2.11.2]
│   ├── Pages (/admin/content/pages) [planned 2.16.2]
│   ├── Blog (/admin/blog) — **LIVE (L3)**: list/create/edit/publish/unpublish, `blog.read`/`blog.write` RBAC, cursor pagination, Zod validation, slug dedupe, optimistic concurrency, audit logging
│   ├── News (/admin/content/news) [planned 2.16.1]
│   ├── Navigation (/admin/content/navigation) [planned 2.16.3]
│   ├── Footer (part of Navigation) [planned 2.16.3]
│   └── FAQs (/admin/content/faqs) [planned 2.16.4]
│
├── SEO
│   ├── Page SEO (/admin/seo) [planned 2.15.1]
│   ├── Redirects (/admin/seo/redirects) [planned 2.15.3]
│   └── Global SEO (/admin/settings → SEO section) [planned 2.15.4]
│
├── Sales
│   ├── Quotes (/admin/sales/quotes) [planned 2.7 / Phase 3]
│   ├── Component Requests (/admin/sales/component-requests) [planned Phase 3]
│   ├── Orders (/admin/orders) [Phase 3]
│   └── Customers (/admin/customers) [Phase 3]
│
├── Support
│   ├── Tickets (/admin/support/tickets) [planned 2.8.x / Phase 4]
│   ├── Manuals (/admin/support/manuals) [planned Phase 4]
│   └── Firmware (/admin/support/firmware) [planned Phase 4]
│
├── Operations
│   ├── Analytics (/admin/operations/analytics) [planned Phase 3]
│   ├── Notifications (/admin/operations/notifications) [planned future]
│   ├── Audit Log (/admin/audit-log) [planned 2.8.3]
│   └── System Health (/admin/operations/health) [planned future]
│
└── Settings
    ├── Company Profile (/admin/settings) [planned 2.9.1]
    ├── Users (/admin/users) [planned 2.8.1]
    ├── Roles (/admin/roles) [planned 2.8.2]
    └── Integrations (/admin/settings/integrations) [planned future]
```

### 9.1 Navigation implementation plan

Navigation items are enabled progressively as admin pages are built. The central config in `components/admin/admin-nav.tsx` drives both the desktop rail and the mobile drawer. Each new admin page also adds its route to the nav config (removing `soon: true` from the leaf item).

The current nav config must be extended beyond the current 7 groups (Catalog/Sales/Support/Content/Operations/Settings) to include R&D, Workspace, Promotions, SEO, and a separate Sales group as pages are built.

### 9.2 Permission matrix (extended)

| Module | super_admin | content_admin | catalog_manager | rd_editor | workspace_manager | sales_manager | support_agent | seo_editor |
|---|---|---|---|---|---|---|---|---|
| Products read/write | ✓/✓ | ✓/✓ | ✓/✓ | ✓/— | —/— | ✓/— | —/— | —/— |
| Components read/write | ✓/✓ | ✓/✓ | ✓/✓ | —/— | —/— | ✓/— | —/— | —/— |
| Categories write | ✓ | ✓ | ✓ | — | — | — | — | — |
| Inventory adjust | ✓ | — | ✓ | — | — | — | — | — |
| Inventory read | ✓ | ✓ | ✓ | — | — | ✓ | — | — |
| R&D read/write | ✓/✓ | ✓/✓ | —/— | ✓/✓ | —/— | —/— | —/— | —/— |
| Workspace read/write | ✓/✓ | —/— | —/— | —/— | ✓/✓ | —/— | —/— | —/— |
| Bookings read/manage | ✓/✓ | —/— | —/— | —/— | ✓/✓ | ✓/— | —/— | —/— |
| Promotions read/write | ✓/✓ | ✓/✓ | ✓/— | —/— | ✓/✓ | ✓/— | —/— | —/— |
| Homepage CMS write | ✓ | ✓ | — | — | — | — | — | — |
| Blog/News write | ✓ | ✓ | — | ✓ | — | — | — | — |
| SEO write | ✓ | ✓ | — | — | — | — | — | ✓ |
| Sales/Orders | ✓/✓ | —/— | —/— | —/— | —/— | ✓/✓ | ✓/— | —/— |
| Support tickets | ✓/✓ | —/— | —/— | —/— | —/— | ✓/read | ✓/✓ | —/— |
| Users/Roles | ✓/✓ | —/— | —/— | —/— | —/— | —/— | —/— | —/— |
| Audit log | ✓ | — | — | — | — | — | — | — |
| Settings | ✓ | — | — | — | — | — | — | — |

**Note**: `catalog_manager`, `rd_editor`, `workspace_manager`, `sales_manager`, `support_agent`, `seo_editor` are planned future roles. Current implemented roles: `SUPER_ADMIN`, `CONTENT_ADMIN`, `SUPPORT_ADMIN`, `SALES_ADMIN`. New roles require a migration and seed update (after C.1 permission wildcard fix).

**Inventory permissions (decision D-074, Step 2.4.6-0)**: planned granular permissions `inventory.read` and `inventory.adjust`. Implemented mapping — `SUPER_ADMIN`: both (via `*`); `CONTENT_ADMIN`: `inventory.read` only; `SALES_ADMIN`: `inventory.read` only; `SUPPORT_ADMIN`: neither. The `catalog_manager`/`sales_manager` rows above are **planned future roles**; once the permission catalog is extended (Step 2.4.6A2) the `inventory.adjust` grant for those future roles will be reconciled to match D-074 (adjust reserved to SUPER_ADMIN + the designated inventory role). See also D-073 (Inventory = only stock-mutation surface; variants become read-only in 2.4.6A1) and D-075/D-077 (`StockMovement` ledger + `SELECT ... FOR UPDATE` adjustment concurrency in 2.4.6A3).

### 9.3 Planned phases

| Phase | Admin modules |
|---|---|
| Phase 2 (current) | Catalog (Products ✅, Components, Categories, Media), Blog, Operations, Settings, R&D (basic), Homepage CMS, SEO (basic) |
| Phase 2 extended | Promotions, Workspace Plans+Booking, Content expansion, Inventory |
| Phase 3 | Sales (Quotes, Orders, Customers, Payments) |
| Phase 4 | Support tickets, Manuals, Firmware, Full Analytics |
| Phase 5+ | Device management, IoT telemetry, advanced analytics |

Do not silently leak later-phase admin pages into earlier phases.

# SITE_MAP.md

Every route the ARIOT site will eventually expose, grouped by route group. This is the planning ground truth — `docs/PAGE_BLUEPRINTS.md` describes the *content* of each page; this file just enumerates the structure.

Conventions:

- `:slug`, `:id`, `:sku` are dynamic segments.
- `(group)` denotes an App Router route group (no URL effect).
- `[future]` marks pages reserved for later phases.

---

## 1. Public / Marketing — `(marketing)`

| Path | Purpose |
|---|---|
| `/` | Homepage — brand-defining moment, top-level navigation into the rest of the site |
| `/products` | Product catalog landing — filterable by category, use case, price range |
| `/products/category/:slug` | Category page (e.g., `/products/category/industrial-robotics`) |
| `/products/:slug` | Product detail page (B2C and B2B SKUs share the template, with conditional sections) |
| `/solutions` | Solutions hub — vertical-led entry points |
| `/solutions/:slug` | Solution detail (e.g., `smart-warehouse`, `smart-agriculture`, `energy-monitoring`) |
| `/robotics` | Robotics / R&D story — static core + latest `robotics-rd` posts (L3) |
| `/research` | Research page — static core + recent `engineering-notes` posts (L3) |
| `/workspace` | Workspace / platform landing (static) |
| `/components` | Components index (static) |
| `/about` | Company story, mission, leadership, manufacturing, certifications |
| `/about/team` | Team page (subpage of about) |
| `/about/manufacturing` | Manufacturing & quality page |
| `/contact` | Contact + office locator (real submission via Resend — L3 verified) |
| `/quote` | B2B quote request form (also linkable from product detail) |
| `/legal/privacy` | Privacy policy |
| `/legal/terms` | Terms of service |
| `/legal/cookies` | Cookie policy |
| `/legal/warranty` | Warranty terms |
| `/legal/shipping-returns` | Shipping & returns |

---

## 2. Product Pages

Already enumerated above; this section documents the *intent* of each:

- `/products` — filter sidebar (category, use case, price range, availability), grid of product cards, featured strip up top, comparison-friendly card design.
- `/products/category/:slug` — category narrative + filtered grid.
- `/products/:slug` — full product detail with hero gallery (images + Seedance video), spec table, variants, pricing (BDT primary / USD secondary), CTAs (Add to cart / Request quote depending on SKU type), downloads (datasheet, manual), related products, reviews `[future]`, FAQ.

---

## 3. Ecommerce — `(shop)`

| Path | Purpose |
|---|---|
| `/cart` | Cart review with line-item edits, currency switch, voucher input |
| `/checkout` | Three-section single-page checkout (contact + ship, payment, review) |
| `/checkout/payment/:provider` | Provider-specific redirect/return target (bKash, Nagad, SSLCommerz, Stripe) |
| `/checkout/success/:orderId` | Order confirmation |
| `/checkout/cancelled/:orderId` | Cancelled / failed payment recovery page |
| `/account` | Customer account hub (orders, addresses, downloads, tickets) |
| `/account/orders` | Order history |
| `/account/orders/:id` | Order detail with status timeline |
| `/account/addresses` | Saved addresses |
| `/account/downloads` | Purchased downloads (manuals, firmware) |
| `/account/quotes` | Quote requests history |
| `/account/tickets` | Support tickets list |
| `/account/tickets/:id` | Ticket thread |
| `/account/profile` | Profile + password + 2FA `[future]` |
| `/account/devices` `[future]` | Registered IoT devices (Phase 5) |
| `/auth/sign-in` | Sign in |
| `/auth/sign-up` | Sign up |
| `/auth/forgot-password` | Password reset request |
| `/auth/reset-password/:token` | Password reset confirm |
| `/auth/verify-email/:token` | Email verification |

---

## 4. Support — `(marketing)` subtree

| Path | Purpose |
|---|---|
| `/support` | Support hub — search bar, top categories, popular articles, "open a ticket" CTA |
| `/support/category/:slug` | Category index (e.g., `getting-started`, `troubleshooting`, `firmware`) |
| `/support/article/:slug` | Knowledge-base article |
| `/support/manuals` | Manuals & datasheets index |
| `/support/manuals/:productSlug` | All manuals for a product |
| `/support/firmware` | Firmware downloads index |
| `/support/firmware/:productSlug` | Firmware history for a product |
| `/support/contact` | Pre-ticket contact form (also entry to ticket creation) |
| `/support/ticket/new` | New ticket form (auth-required, with auth-prompt fallback) |
| `/support/status` `[future]` | Service status / IoT cloud uptime |

---

## 5. Blog / Innovation Lab — `(marketing)` subtree

| Path | Purpose |
|---|---|
| `/blog` | Blog landing — **LIVE (L3)**: published `BlogPost` rows from DB, newest first; honest empty state |
| `/blog/category/:slug` | Posts by category (e.g., `robotics-rd`, `iot-in-bd`, `smart-industry`, `build-logs`, `tutorials`) `[future]` |
| `/blog/tag/:slug` | Posts by tag `[future]` |
| `/blog/:slug` | Blog post detail — **LIVE (L3)**: canonical slug, Markdown body, `BlogPosting` JSON-LD, `notFound()` for missing |
| `/blog/authors/:slug` | Author profile |
| `/innovation-lab` | Branded long-form / experiment showcase (curated subset of blog) |

---

## 6. Admin Dashboard — `(admin)`

Auth + RBAC required. See `docs/ADMIN_DASHBOARD_PLAN.md` for permissions and UX.

| Path | Purpose |
|---|---|
| `/admin` | Overview / KPIs |
| `/admin/products` | Products list |
| `/admin/products/new` | Create product |
| `/admin/products/:id` | Edit product (tabs: details, media, variants, inventory, SEO) |
| `/admin/categories` | Category tree management |
| `/admin/media` | Media library (images, videos, manuals, firmware) |
| `/admin/orders` | Orders list |
| `/admin/orders/:id` | Order detail (status, payments, shipments, refunds) |
| `/admin/customers` | Customer list |
| `/admin/customers/:id` | Customer detail (orders, tickets, quotes) |
| `/admin/quotes` | Quote requests list |
| `/admin/quotes/:id` | Quote detail (assign, respond, convert to order) |
| `/admin/tickets` | Support tickets list |
| `/admin/tickets/:id` | Ticket thread + internal notes |
| `/admin/blog` | Blog posts list — **LIVE (L3)**: cursor-paginated, `blog.read` |
| `/admin/blog/new` | Create post — **LIVE (L3)**: strict Zod, slug dedupe, `blog.write` |
| `/admin/blog/:id` | Edit post — **LIVE (L3)**: publish/unpublish, optimistic concurrency, audit |
| `/admin/blog/categories` | Blog categories `[future]` |
| `/admin/users` | Admin user management |
| `/admin/roles` | Roles & permissions |
| `/admin/audit-log` | Audit log viewer |
| `/admin/settings` | Site settings (currencies, taxes, shipping zones, payment providers, email templates) |
| `/admin/analytics` | KPI dashboards (sales, traffic, support load) |

---

## 7. API & Integrations — `(api)`

| Path | Purpose |
|---|---|
| `/api/contact` | Contact form submission — **LIVE (L3)**: Zod-validated, rate-limited, Resend delivery |
| `/api/quote` | Quote request submission |
| `/api/newsletter` | Newsletter subscribe |
| `/api/admin/blog` | **LIVE (L3)** — `POST` create BlogPost (`blog.write`); `POST /api/admin/blog/:id` update/publish/unpublish |
| `/api/cart` | Cart mutations (mostly via server actions; route handler reserved for non-RSC clients) |
| `/api/checkout` | Initiate checkout / payment intent |
| `/api/payments/bkash/webhook` | bKash webhook |
| `/api/payments/nagad/webhook` | Nagad webhook |
| `/api/payments/sslcommerz/webhook` | SSLCommerz webhook |
| `/api/payments/stripe/webhook` `[future]` | Stripe webhook |
| `/api/uploads/sign` | Signed upload URL (admin) |
| `/api/og` | OG image generator |
| `/api/sitemap.xml` | Dynamic sitemap (or `app/sitemap.ts`) |
| `/api/robots.txt` | Robots (or `app/robots.ts`) |
| `/api/health` | Health check (uptime monitoring) |
| `/api/devices/telemetry` `[future]` | IoT device telemetry ingest (Phase 5) |

---

## 8. Future Expansion — `[future]`

Reserved routes that should not be created yet but must not be conflicted by Phase 1 decisions.

- `/developers` — Developer portal: API docs, SDKs, sandboxes.
- `/developers/api` — API reference.
- `/developers/sdks` — SDKs (Node, Python, embedded).
- `/partners` — Partner / reseller program.
- `/partners/apply` — Partner application.
- `/careers` — Careers landing.
- `/careers/:slug` — Job detail.
- `/press` — Press kit, logos, news mentions.
- `/events` — Webinars, conferences, demo days.
- `/iot-console` — Customer-facing IoT device dashboard (Phase 5).
- `/iot-console/devices/:id` — Device detail / telemetry.
- `/store-locator` — Physical retail / service-center locator.
- `/education` — Education hub for institutions.
- `/community` — Forum or Discourse-style community `[evaluate need]`.

---

## 9. Sitemap, robots, and OG

- `app/sitemap.ts` outputs all public, indexable routes plus dynamic `/products/*`, `/blog/*`, `/support/article/*`, `/solutions/*`.
- `app/robots.ts` allows public marketing routes; disallows `/admin`, `/account`, `/auth`, `/api`.
- `app/api/og/route.ts` generates dynamic OG images per product/post/solution using design tokens.

---

## 10. URL & Slug Conventions

- All slugs are kebab-case, lowercase, ASCII.
- Product slugs derive from product name + canonical SKU suffix when needed: `precision-arm-px3` (no SKU duplication unless required for SEO).
- Blog slugs derive from title.
- Avoid English-only language in routes — Bangla bilingual layer in a later phase will use a `[locale]` segment under a localized variant, never a hard-coded `/en/` or `/bn/`.

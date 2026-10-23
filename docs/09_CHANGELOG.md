# 09_CHANGELOG.md

**Purpose**: Records every significant change to the project — code, docs, configuration, or infrastructure. Provides a reverse-chronological audit trail.

**Usage**: At the end of every implementation turn or planning session, add a dated entry summarizing what changed. Group by date. Include file paths for significant changes.

---

## Format

```
## YYYY-MM-DD

### Category (Code | Docs | Config | Infrastructure)

- **[short description]** — `path/to/file.ts` — what changed
```

---

## Changelog

### 2026-10-23 (D2 — Admin-Subdomain Authentication, Production Email Routing)

#### Auth — admin subdomain (D-082 → D-083, I-036 Resolved)
- **`server/auth.ts`** — `resolveTrustedOrigins()` now yields exactly the two production origins (`BETTER_AUTH_URL` + `NEXT_PUBLIC_SITE_URL`, exact strings, no wildcards) and excludes non-HTTPS/loopback origins in production (the `http://localhost:3000` client-schema default can no longer widen the production CSRF trust list). Google gate uses the new shared predicate. Cookie posture unchanged: host-only (no `cookieDomain`).
- **`server/auth/google-provider.ts`** (new) — `isGoogleProviderEnabled(id, secret)`, shared by `server/auth.ts` and the sign-in page so provider state and button state cannot diverge.
- **`app/(auth)/sign-in/page.tsx`** — uses the shared predicate.
- **`app/(auth)/sign-in/sign-in-form.tsx`** — post-login `callbackURL` now `/admin` (relative; passes trusted-origins validation) instead of `/`.
- **`app/(admin)/layout.tsx`** — non-admin sessions now redirect to the absolute `NEXT_PUBLIC_SITE_URL` instead of `/` (on the admin host, a relative redirect would bounce back through `proxy.ts` rule 3 → infinite loop). Unauthenticated → `/sign-in`; unauthorized → public site; RBAC re-resolved server-side per request (unchanged).
- **Runtime verification (no network/DB)** against `better-auth@1.6.23`: trusted admin origin + configured creds → sign-in POST returns the Google consent URL with `redirect_uri=https://admin.ariottech.com/api/auth/callback/google` (exactly the URI registered on the downloaded OAuth client); cookie-bearing POST with an untrusted `Origin` → `403 INVALID_ORIGIN` before any endpoint logic (origin check fires when a `Cookie` header is present; cookie-less cross-site POSTs have no ambient authority, and cross-site navigation attacks are blocked by better-auth's fetch-metadata CSRF middleware).

#### Host routing (Task 3 — no loops, public site untouched)
- **`proxy.ts`** (new; Next 16 renamed middleware → proxy) — matcher limited to `/`, `/admin*`, `/sign-in*`: apex `/admin*` + `/sign-in*` → `https://admin.ariottech.com` (308, path+query preserved); admin `/` → `/admin` when a session cookie is present (both `better-auth.session_token` and `__Secure-` variants) else `/sign-in` (307, relative targets). Reads host env per request; split inactive when hosts are equal (localhost dev behaves exactly as before). Rule 3 is routing convenience only — authorization stays in the layout.
- **`deploy/Caddyfile`** — apex `handle` blocks redirect `/admin*` + `/sign-in*` to the admin host (same 308 semantics as the proxy, defense in depth); both `reverse_proxy` blocks set `header_up Host {http.request.host}` so the app's host-based routing and Better Auth origin checks see the real hostname. **Bug fixed**: bare `{$CADDY_ACME_EMAIL}` failed to parse whenever the var was unset (CI, `caddy validate`, bare `docker run`) → `{$CADDY_ACME_EMAIL:-admin@ariottech.com}`, matching the compose default; `caddy validate` now passes with the var both unset and set.

#### Email — production routing (Task 5, I-031 reduced to config)
- **`server/mail/routing.ts`** (new) — `resolveMailFrom()` / `resolveContactInbox()` read `MAIL_FROM` (Resend-verified sender) + `MAIL_TO` (owner-approved inbox); dev/test keep the historical placeholder fallbacks; production throws `MailRoutingError` (names the missing variable, never a value) at send time so `/api/contact` + `/api/quote` surface an error instead of faking success.
- **`server/mail/templates/{contact-notification,quote-notification,newsletter-welcome}.ts`** — use the routing helpers; no more `noreply@ariot.example` senders. Zod validation, rate limiting, and form UX unchanged.
- **`server/env.ts`** — `MAIL_FROM`/`MAIL_TO` added to the server schema with email-shape refinements (malformed values fail boot in every environment) + a production boot warning when either is unset.
- **`lib/seo/site.ts`** — comment corrected: `siteConfig.contact.email` is a bracketed public-identity placeholder (still filtered out of JSON-LD); operational routing is `MAIL_TO`.

#### Config / env / Docker (Task 6)
- **`compose.production.yml`** — `BETTER_AUTH_URL` default flipped to `https://admin.ariottech.com` (Google callback derives from it); `MAIL_FROM`/`MAIL_TO` passed through to the web service.
- **`.env.production.example`** — `BETTER_AUTH_URL` = admin host + callback/JavaScript-origin notes matching the downloaded OAuth client; new `MAIL_FROM`/`MAIL_TO` entries (empty — owner decides) with Resend verification requirements; localhost-Google-testing caveat documented.
- **`.env.example`** — added the `MAIL_FROM`/`MAIL_TO` template entries; Google callback note corrected (local = localhost, production = admin subdomain); `BETTER_AUTH_URL` production posture documented.

#### Tests (Task 7 — +26 focused tests; suite now 506)
- **`tests/admin-subdomain-proxy.test.ts`** (new, 16) — routing matrix incl. query preservation, both session-cookie names, loop-safety, public routes + `/api/*` passthrough, unlisted hosts, split-inactive postures.
- **`tests/auth-config.test.ts`** (new, 9) — subprocess-isolated (env frozen at import): baseURL, exact trusted-origins (no wildcards/localhost), runtime 403 origin rejection, golden Google `redirect_uri`, apex origin accepted, host-only cookies, provider on/off, Prisma adapter.
- **`tests/contact-mail-config.test.ts`** (new, 7) — dev fallbacks, production fail-closed (`MailRoutingError`), error messages never leak values, configured routing in production, bracketed placeholder never published, no `mailto:` in public UI.
- Live Google login **unverified** until a real HTTPS browser flow completes post-deployment.

#### Verification
- Full suite **506 tests / 505 pass / 0 fail / 1 skipped** (opt-in R2 smoke) · `npx prisma validate` ✅ · `npx prisma generate` ✅ · `pnpm typecheck` 0 errors ✅ · `pnpm lint --max-warnings 0` ✅ · `pnpm build` ✅ (`ƒ Proxy (Middleware)` compiled) · `git diff --check` ✅ · `docker compose -f compose.production.yml config` ✅ · `caddy validate` (env unset + set) ✅. No Prisma schema/migration change; no Docker rebuilds; no deploy; nothing committed or pushed.

### 2026-10-23 (D1 — Closure Session: Verification, Admin-Subdomain Routing, Repo Hygiene)

#### Verification (live Docker test stack — no rebuild needed, container/image untouched)
- **Cache publication suite (D-081) verified end-to-end** — disposable script run inside `ariotd1-web-1`: **37/37 checks pass** across all 8 required behaviours — published post in `/blog`; posts in homepage/Robotics/solutions( IoT)/Research sections; admin edit visible without image rebuild (container `StartedAt` + image digest identical before/after); unpublish removes public visibility; drafts private; slug rename invalidates old (not-found, no content) and new slugs; repeated reloads serve fresh content while caching HITs (cache active, not bypassed); a not-found cached before publish flips to content after publish (no permanent stale data). Fixtures are disposable `d1-cache-*` rows in the isolated stack only.
- **Soft-404 observed and classified** — `notFound()` on matched dynamic segments renders HTTP 200 (site-wide, pre-existing; content never leaks) → recorded as **I-035**, not a D1 regression.

#### Config / Infrastructure
- **`deploy/Caddyfile`** — added the `admin.ariottech.com` site block (`encode` + `reverse_proxy web:3000`): owner-confirmed admin dashboard host, same `web` container (host routing only, RBAC unchanged). Validated with `caddy validate` (exit 0). DNS prerequisite documented.
- **`docs/07_DECISIONS.md`** — new **D-082**: admin subdomain architecture + the exact Better Auth changes deferred to D2 (verified against installed `better-auth@1.6.23` source: origin check, host-only OAuth state cookie, `redirect_uri` derived from `BETTER_AUTH_URL`).
- **`.env.production.example`** — no value changes required (placeholders verified intact); admin-callback requirement recorded in D-082 / `deploy/README.md` § 10.

#### Repo hygiene (GitHub readiness)
- **CRLF → LF normalization** on 9 text files (`.gitignore`, `app/(marketing)/blog/page.tsx`, `app/(marketing)/blog/[slug]/page.tsx`, `pnpm-workspace.yaml`, `components/marketing/blog-category-icon.ts`, `components/marketing/blog-markdown.tsx`, `lib/utils/format-date.ts`, `lib/utils/markdown-toc.ts`, `tests/blog-post-integration.test.ts`) — content-identical; fixes `git diff --check` (exit 0). Root cause: Windows-era files (I-033 migration).
- **GitHub readiness audited** — 64 essential untracked paths (source, tests, deployment files, migration, brand PNGs); secrets scan clean; `.env`/generated dirs properly ignored; **exclude `z.txt`** (Cline tool artifact) from any commit.

#### Docs
- **`docs/06_PROGRESS_LOG.md`**, **`docs/08_KNOWN_ISSUES.md`** (I-035/I-036/I-037 + footer counts), **`docs/10_AI_AGENT_CONTEXT.md`**, **`deploy/README.md`** (DNS row, admin callback note, I-034 first-deploy ordering, tagged-cache editorial note) reconciled to verified facts.

#### Final verification (runner-derived)
- `npx prisma validate` ✅ · `npx prisma generate` ✅ · `pnpm typecheck` ✅ · `pnpm lint` (0 warnings) ✅ · `pnpm build` ✅ (67 pages) · `git diff --check` ✅ · full canonical suite: **474 tests / 473 pass / 0 fail / 1 skipped (opt-in R2 smoke)** across 30 files.

### 2026-10-23 (D1 — Publication/Cache Defect Fix)

#### Code
- **`server/public/tagged-cache.ts`** (new): Tagged read cache for DB-backed public content. Wraps reads in `unstable_cache` with an explicit `public-blog` tag (plus a per-slug tag) so the cached page entry carries the tag metadata Next.js needs. Also exports `IMMEDIATE_INVALIDATION` (`{ expire: 0 }`) — the only profile that expires a tag at the moment of the call.
- **`server/public/blog.ts`**: `listPublishedPosts` and `getPublishedPostBySlug` now read through the tagged cache. The cache is bypassed when a caller supplies a non-default `db` (the disposable-database test seam), so integration tests never read another database's rows. The uncached read logic moved into `readPublishedPosts` / `readPublishedPostBySlug`.
- **`app/api/admin/blog/route.ts`**, **`app/api/admin/blog/[id]/route.ts`**: Publish/update now call `revalidateTag(PUBLIC_BLOG_TAG, IMMEDIATE_INVALIDATION)` (and the per-slug tag) **before** `revalidatePath(...)`.

#### Defect fixed (verified in the live Docker stack)
Publishing a post through the admin API returned HTTP 200, but the public `/blog`, `/`, and `/blog/[slug]` pages kept serving the old content **indefinitely** — `x-nextjs-cache: HIT` forever, with no rebuild or restart involved.

Root cause (traced through `next@16.2.4`): a cached `APP_PAGE` entry is invalidated only when a tag in its `x-next-cache-tags` header has been revalidated. That header is written from `workUnitStore.tags`, which is populated **only** by `unstable_cache` / `"use cache"` + `cacheTag()`. The public pages read PostgreSQL through plain Prisma calls, so they carried no tag metadata and `revalidatePath('/blog', 'page')` matched nothing — a silent no-op.

#### Tests
- Full suite: 468 tests / 62 suites — **467 pass, 0 fail, 1 skip** (opt-in R2 smoke).

### 2026-10-22 (D1 — Production Docker Preparation)

#### Infrastructure (new)
- **`Dockerfile`** (new): Multi-stage build — `deps` (pnpm, frozen lockfile) → `build` (prisma generate + `next build` with `output: 'standalone'`) → `runtime` (standalone server, non-root `node` user, HEALTHCHECK on `/api/health`) / `migrate` (prod-only deps + `prisma migrate deploy`) / `seed` (full source, explicit one-shot seed). Pinned `node:24.22.0-bookworm-slim`. No `.env` in any image; no secrets as build args.
- **`compose.production.yml`** (new): `web` (private network only), `db` (PostgreSQL 16.10, `pgdata` volume, no published port), `migrate` (one-shot, `service_completed_successfully` gate), `caddy` (only published ports 80/443/443-udp, `caddy_data` volume for certs), `seed` (profile `initial`, never automatic). Restart policies, health checks, and memory limits sized for a 4 GB VPS.
- **`.dockerignore`** (new): Excludes `.env*`, `node_modules`, `.next`, `tests`, `docs`, `deploy`, local agent dirs.
- **`deploy/Caddyfile`** (new): Automatic HTTPS for `ariottech.com`; `www.ariottech.com` → apex 308 redirect. App security headers (CSP/HSTS) stay in `next.config.ts` — not duplicated.
- **`deploy/README.md`** (new): Canonical runbook — OVH Ubuntu setup, firewall, Docker Engine/Compose, DNS, Caddy, env, migrations, seed, admin bootstrap, Resend domain verification, media dir, releases, backups, rollback (code vs migration), monitoring.
- **`.env.production.example`** (new): Every variable the app actually reads (`server/env.ts`) + Compose infra vars, with `CHANGE_ME` placeholders and the OAuth callback path.
- **`docs/VPS_DEPLOYMENT.md`** (rewritten): Retired the PM2 + host Nginx + Certbot guide; now points at the Docker/Compose runbook.

#### Code
- **`next.config.ts`**: `output: 'standalone'` (self-hosted deployment).
- **`server/env.ts`**: Optional string vars now treat an empty string as unset (Compose renders absent optional vars as `''`).
- **`app/api/health/route.ts`** (new): Minimal liveness probe for the container HEALTHCHECK.
- **`app/favicon.ico`** (modified): Replaced the default Next.js scaffold icon with a 16/32/48/64 multi-resolution ICO derived from the official ARIOT "A" mark (gradient and proportions preserved, transparent padding).
- **`prisma/seed.ts`**: Seed is now **insert-only** (`ON CONFLICT … DO NOTHING`) for all content rows — a rerun can no longer overwrite admin-edited posts/categories/roles/media nor force re-publication. SystemSetting bookkeeping still updates in place.
- **`deploy/ecosystem.config.js.example`, `deploy/nginx.conf.example`**: Removed (PM2/Nginx are not part of the Docker architecture).

#### Tests
- **`tests/seed-safety.test.ts`** (new, 4 tests): Seed safety + idempotency + `prisma migrate deploy` on an empty DB (asserts `StockMovement` exists and no migration failed/rolled back).
- **`tests/database-timezone.test.ts`**: Disposable DB is now explicitly set to a non-UTC timezone so the test's premise ("the DB itself is not UTC") holds on UTC hosts.
- **`tests/media-upload-r2.smoke.test.ts`**: Partial-config detection now mirrors the app contract (`server/env.ts`): the four `R2_*` credentials + `MEDIA_UPLOAD_TOKEN_SECRET`; `R2_PUBLIC_BASE_URL` is optional. The opt-in R2 smoke test correctly skips again.
- **Full suite**: 468 tests / 62 suites — **467 pass, 0 fail, 1 skip** (opt-in R2 smoke).

#### Docs
- `docs/09_CHANGELOG.md`, `docs/10_AI_AGENT_CONTEXT.md`, `docs/06_PROGRESS_LOG.md`, `docs/07_DECISIONS.md`, `docs/08_KNOWN_ISSUES.md` — D1 entry.

### 2026-09-01 (L3 — Minimal Marketing CMS for Launch)

#### Code
- **`prisma/seed.ts`** (modified): BlogPost rows now seeded `PUBLISHED` with `publishedAt = file mtime` (honest, deterministic). Dead `enableExtensions` removed from `blog-post-integration.test.ts`. Added `fileMtimeIso()` helper.
- **`tests/helpers/register-hooks.mjs`** (modified): Resolves `next/*` subpath exports (`next/headers`, etc.) so `node --test` can import production server modules. Loads `.env` into `process.env` at startup.
- **`tests/blog-post-integration.test.ts`** (modified): `pushSchema()` no longer uses Prisma 7-removed `--skip-generate` flag. Extensions (`citext`, `pg_trgm`) created before `prisma db push` (fixes schema-push failure). `auditCount` TS signature fixed.
- **`components/admin/blog/blog-editor.tsx`** (modified): Slug auto-gen moved from `useEffect` to `updateField` handler (lint-clean). `routerRef` uses `useEffect` + nullable type.
- **`components/admin/blog/media-picker.tsx`** (modified): Initial load moved from `useEffect` to open-toggle click handler (lint-clean).

#### Tests (+25 files, +463 tests across 28 files)
- **`tests/blog-post-integration.test.ts`** (14) — L3 blog integration: create draft, draft-not-public, publish, published-visible, slug-unique, unknown-fields rejected, update, no-op, unauthorized-denied, read-only-denied, unpublish, archive, category filter, homepage ordering.
- **Full suite regressions**: 463 pass / 0 fail / 1 expected opt-in skip (R2 smoke). All 28 test files green.

#### Verification
- `npx prisma validate` ✅ · `npx prisma generate` ✅ · `pnpm typecheck` 0 errors ✅ · `pnpm lint` 0 warnings ✅ · `pnpm build` ✅ (64 routes). No schema/migration change. No deployment.

#### Docs
- `docs/SITE_MAP.md` — added `/robotics`, `/research`, `/workspace`, `/components` public routes; blog + admin routes annotated with L3 status; contact verified.
- `docs/PAGE_BLUEPRINTS.md` — added `/robotics` and `/research` sections; blog section annotated with DB-backed implementation note.
- `docs/05_IMPLEMENTATION_MASTER_PLAN.md` — steps 2.5.1/2/4, 2.7.2/4 marked ✅ L3; 2.5.3 marked `[future]`.
- `docs/06_PROGRESS_LOG.md` — L3 completion entry; Phase 2: 12/43 steps (28%).
- `docs/10_AI_AGENT_CONTEXT.md` — L3 status, test counts, launch scope.
- `docs/ADMIN_DASHBOARD_PLAN.md` — blog admin marked LIVE.

### 2026-08-29 (Step 2.4.6-0 — UTC Timestamp Infrastructure Correction + Inventory Architecture)

#### Code
- **`server/db-timezone.ts`** (new): Central UTC session policy (`D-070`). `utcPoolConfig()` builds a pg `PoolConfig` that pins every PrismaPg/raw-pg session to UTC via the libpq startup option `-c timezone=UTC`, decodes naive `timestamp` columns as UTC (not host-local), and forces `pg` to encode `Date` params as UTC. Single source of truth — no per-query patches, no `process.env.TZ` reliance.
- **`server/db.ts`** (modified): Prisma client now `new PrismaClient({ adapter: new PrismaPg(utcPoolConfig(getDatabaseUrl())) })` — every application session runs in UTC.
- **`server/db-health.ts`** (new): `checkDatabaseTimezone()` / `assertDatabaseTimezoneUtc()` — verify a live session reports `TimeZone = UTC` without exposing credentials.
- **`app/api/admin/health/database/route.ts`** (new): `GET /api/admin/health/database` (SUPER_ADMIN only) exposes the UTC invariant check (observed/expected only).
- **`scripts/set-database-timezone-utc.ts`** (new): `pnpm db:timezone` — dry-run by default; `--apply` runs `ALTER DATABASE <dev> SET timezone TO 'UTC'` on a loopback-only, non-staging/non-production DB and verifies on a NEW connection.
- **`scripts/bootstrap-admin.ts`**, **`scripts/reconcile-role-permissions.ts`** (modified): raw-pg pools now use `utcPoolConfig`.
- **`tests/local-upload-integration.test.ts`**, **`media-upload-local.smoke.test.ts`**, **`upload-complete-integration.test.ts`**, **`product-media-integration.test.ts`**, **`product-denied-write.test.ts`**, **`product-editor-integration.test.ts`**, **`product-variants-integration.test.ts`** (modified): disposable-DB raw-pg/PrismaPg connections now route through `utcPoolConfig`, removing the old `.env` timezone hack.

#### Tests (+2 files, +36 tests)
- **`tests/db-timezone-config.test.ts`** (new, 30): pure config guards — connection-string merge, naive-timestamp decoder, type-parser dispatch, pool-config shape.
- **`tests/database-timezone.test.ts`** (new, 6): real round trips against a deliberately non-UTC disposable DB — Prisma/pg/DB-default paths, concurrency token, audit serialization, host-`TZ` independence (Asia/Dhaka, America/Los_Angeles, UTC).
- **`tests/helpers/timezone-host-probe.ts`** (new): child-process probe for host-`TZ` independence.
- **`package.json`** (modified): added `db:timezone` and `test:timezone` scripts.

#### Decisions
- **D-070** UTC Database/Application Timestamp Policy. **D-071** Physical stock semantics (never negative; BACKORDER ≠ negative). **D-072** Stock authority (variant vs product). **D-073** Inventory mutation boundary (Inventory only surface). **D-074** Inventory RBAC (`inventory.read`/`inventory.adjust` matrix). **D-075** StockMovement ledger timing. **D-076** Negative-BACKORDER correction. **D-077** Adjustment concurrency (`SELECT ... FOR UPDATE`, `deltaQty`, reason+note).

#### Docs
- `docs/07_DECISIONS.md` (+8 decisions), `docs/08_KNOWN_ISSUES.md` (I-029 → Runtime Mitigated / Historical Local Data Review Pending), `docs/ECOMMERCE_PLAN.md` §7 corrected (physical stock never negative), `docs/06_PROGRESS_LOG.md` (2.4.6-0 entry), `docs/10_AI_AGENT_CONTEXT.md`, `docs/05_IMPLEMENTATION_MASTER_PLAN.md`, `docs/ADMIN_DASHBOARD_PLAN.md`, `docs/DATABASE_SCHEMA_PLAN.md` updated.

#### Verification
- `npx prisma validate` ✅ · `npx prisma generate` ✅ · `pnpm typecheck` 0 errors · `pnpm lint` 0 warnings · `pnpm build` ✅. Full suite **413 tests / 412 pass / 0 fail / 1 skipped** (R2 smoke). Dev DB `ariot` (localhost `::1`) default `TimeZone = UTC`; server default `Asia/Dhaka` (disposable test DBs inherit it, but `utcPoolConfig` pins sessions to UTC). No schema/migration change; no inventory implementation; historical rows untouched.

### 2026-08-29 (Step 2.4.6A1 — Inventory Mutation Surface)

#### Code
- **`server/admin/inventory/inventory-schema.ts`** (new): `adjustInventoryRequestSchema` (strict; `productId` required, `variantId` optional, `deltaQty` int, `reason` required min 3 / max 120, `note` optional max 500); `InventoryRow` / `InventoryListResult` types.
- **`server/admin/inventory/inventory-helpers.ts`** (new): `InventoryResult` discriminated type; `authorizeInventoryRead` / `authorizeInventoryAdjust`; `canAdjustInventory`; `actorRole`.
- **`server/admin/inventory/adjust-inventory-executor.ts`** (new): the ONLY stock-mutation path. Resolves authority (D-072): `variantId` → variant row; absent → product row only when zero active variants (else reject). Locks the authoritative row with `SELECT … FOR UPDATE` inside one `$transaction`, computes `before + deltaQty`, rejects negative (D-071) with no write/audit, and on success updates stock + writes `AuditLog` action `INVENTORY_ADJUSTED` (before/after/deltaQty/reason/note/productId[+variantId]).
- **`server/admin/inventory/inventory-auth.ts`** (new): `requireInventoryAdjust` / `requireInventoryRead` (session-wrapping RBAC).
- **`server/admin/inventory/adjust-inventory.ts`**, **`list-inventory.ts`** (new): production wrappers.
- **`app/api/admin/inventory/route.ts`** (new): `GET` list (200/401/403/500) + `POST` adjust (200/400/403/404/500).
- **`app/(admin)/admin/inventory/page.tsx`** (new) + **`loading.tsx`** (new) + **`components/admin/inventory/inventory-table.tsx`** (new, client: DataTable + Adjust dialog) + **`inventory-table-skeleton.tsx`** (new) + Inventory nav leaf.
- **`server/auth/permission-catalog.ts`** (modified): added `PERMISSIONS.inventory` (`inventory.read` / `inventory.adjust`); granted `inventory.read` to CONTENT_ADMIN + SALES_ADMIN (D-074).
- **`scripts/reconcile-role-permissions.ts`**, **`prisma/seed.ts`** (modified): same D-074 grant.
- **`components/admin/products/variant-form.tsx`** (modified): Stock input now disabled/read-only (D-073).
- **`server/admin/products/create-product-variant-executor.ts`** (modified): variant creation initializes `stock: 0`; stock removed from audit snapshot (D-073).
- **`server/admin/products/update-product-variant-executor.ts`**, **`product-variant-mutation-helpers.ts`** (modified): variant update no longer writes/compares `stock` (D-073).

#### Tests (+2 files, +24 tests)
- **`tests/inventory-adjustment-integration.test.ts`** (new, 12): real executors on disposable `ariot_inventory_service_test` PG — product/variant adjust, negative reject, active-variant guard, forbidden/reads, audit written, failed-no-audit, atomicity/rollback, concurrency row-lock.
- **`tests/inventory-permission.test.ts`** (new, 12): D-074 matrix + schema contract.
- **`tests/product-variants-service-integration.test.ts`** (modified): tests 19/24/31 updated for stock-now-read-only (D-073).

#### Decisions
- **D-073** (implemented), **D-074** (implemented), **D-077** (concurrency implemented; ledger pending A3). D-071/D-072 honored by the executor.

#### Docs
- `docs/05_IMPLEMENTATION_MASTER_PLAN.md` (2.4.6A1 row), `docs/06_PROGRESS_LOG.md` (2.4.6A1 entry + next step), `docs/07_DECISIONS.md` (D-073/D-074/D-077 → Implemented), `docs/10_AI_AGENT_CONTEXT.md` updated.

#### Verification
- `pnpm typecheck` 0 errors · `pnpm lint` 0 warnings · `pnpm build` ✅. Full suite **437 tests / 436 pass / 0 fail / 1 skipped** (R2 smoke) across **26 files**. No schema/migration change; no secret committed; no public-site behavior change.

### 2026-08-29 (Step 2.4.6A3 — StockMovement Ledger)

#### Code
- **`prisma/schema.prisma`** (modified): new `StockMovement` model (append-only inventory ledger; scalar `productId`/`variantId` FK references; `deltaQty`, `quantityBefore`, `quantityAfter`, `reason`, `note`, `referenceType`/`referenceId` reserved, `createdAt`, `createdBy`). Indices on `productId`, `variantId`, `createdAt`, `createdBy`.
- **`prisma/migrations/20260829000100_add_stock_movement/migration.sql`** (new): creates `StockMovement` + trigger `stock_movement_immutable` / function `deny_stock_movement_write` that reject UPDATE/DELETE (immutability by design). Applied to local dev DB via `prisma migrate deploy`.
- **`server/admin/inventory/adjust-inventory-executor.ts`** (modified): every successful adjustment now writes exactly one `StockMovement` (quantityBefore/After/deltaQty/reason/note/createdBy = ctx.userId) inside the SAME `SELECT … FOR UPDATE` transaction as the stock update + `AuditLog` (D-077) — atomic, all-or-nothing.
- **`server/admin/inventory/inventory-schema.ts`** (modified): added `StockMovementRow`, `ListStockMovementsParams`, `StockMovementListResult`.
- **`server/admin/inventory/list-movements-executor.ts`** (new): read-only ledger list (`requireInventoryRead`, cursor pagination, productId/variantId filters, ascending by createdAt).
- **`server/admin/inventory/list-movements.ts`** (new): production wrapper.
- **`app/api/admin/inventory/movements/route.ts`** (new): `GET` list (200/400/401/403/500) with `productId`/`variantId`/`cursor`/`pageSize` (clamped 1–100).
- **`components/admin/inventory/inventory-table.tsx`** (modified): added read-only **History** dialog (DataTable) showing movements per product/variant for any `inventory.read` role; Adjust still gated by `inventory.adjust`.
- **`prisma generate`** run.

#### Tests (+1 file; A1 seed updated; +13 tests)
- **`tests/stock-movement-integration.test.ts`** (new, 13): real executors on disposable `ariot_stock_movement_test` PG — movement created on product/variant adjust, quantityBefore/After/deltaQty correct, negative rejected (no movement), forbidden/validation create none, concurrency preserves qty, immutability via trigger (UPDATE/DELETE rejected), unauthorized create none, read-only cannot adjust, archived-product adjustment rejected but history preserved.
- **`tests/inventory-adjustment-integration.test.ts`** (modified): seed now creates `StockMovement` table + `deny_stock_movement_write` trigger; `resetState` truncates `StockMovement`.

#### Decisions
- **D-075** (implemented): `StockMovement` ledger introduced (append-only, distinct from `AuditLog`). **D-077** ledger-write concurrency implemented.

#### Docs
- `docs/05_IMPLEMENTATION_MASTER_PLAN.md` (2.4.6A3 row), `docs/06_PROGRESS_LOG.md` (2.4.6A3 entry + next step), `docs/07_DECISIONS.md` (D-075 → Implemented), `docs/08_KNOWN_ISSUES.md` (I-030 migration deploy-gated), `docs/10_AI_AGENT_CONTEXT.md`, `docs/DATABASE_SCHEMA_PLAN.md` (`StockMovement` implemented), `docs/ADMIN_DASHBOARD_PLAN.md` (Inventory History dialog) updated.

#### Verification
- `pnpm typecheck` 0 errors · `pnpm lint` 0 warnings · `pnpm build` ✅. Full suite **450 tests / 449 pass / 0 fail / 1 skipped** (R2 smoke) across **27 files**. No secret committed; no public-site behavior change; disposable test DBs dropped by test hooks.

### 2026-08-18 (Step 2.4.5 FINAL — Production-Service Verification + I-028 Correction)

#### Code
- **`server/admin/products/create-product-variant-executor.ts`** (new), **`update-product-variant-executor.ts`** (new), **`archive-product-variant-executor.ts`** (new), **`get-product-variants-executor.ts`** (new): Context-injected executors containing the full mutation/loader logic. First action: `authorizeProductWrite` / `authorizeProductRead(ctx)` — the SHARED production authorization boundary (`hasAllPermissions`, `AuthorizationError`) identical to `requirePermission`, so real-service tests can inject a controlled context. Executors never touch the session.
- **`server/admin/products/variant-auth.ts`** (new): Session wrappers `requireProductWrite()` / `requireProductRead()` (Better Auth → `requirePermission`). Imported only by the production wrappers, never by tests.
- **`server/admin/products/create-product-variant.ts`**, **`update-product-variant.ts`**, **`archive-product-variant.ts`**, **`get-product-variants.ts`** (rewritten): Thin wrappers — resolve session context via `variant-auth`, delegate to the executor. Public API, route contract, and page contract unchanged. `get-product-variants.ts` re-exports the DTO types.
- **`server/admin/products/product-variant-mutation-helpers.ts`** (modified): Removed `requireProductWrite` and the runtime `@/server/auth/permissions` import; added `authorizeProductWrite`/`authorizeProductRead` (`hasAllPermissions` + `AuthorizationError`, `import type { AuthorizationContext }`). Module chain is now node-safe (db + schema + catalog + errors only).
- **`server/admin/products/update-product-variants.ts`** (deleted): Stale orphan monolith from before the split — nothing imported it; contained mojibake.
- **`server/admin/products/product-details-schema.ts`** (modified): **I-028 fixed** — `priceMinor` transform rewritten to the safe pattern (digits-only regex + `ctx.addIssue` + `return z.NEVER`, trimmed string out, `''`/null → null). `safeParse` never throws for malformed prices.
- **`tests/helpers/register-hooks.mjs`** (new): Node 24 native-TS loader hooks — resolves `@/` path alias + extensionless relative imports so the REAL production server modules import cleanly under `node --test` without tsx/CJS interop. Canonical runner: `node --import ./tests/helpers/register-hooks.mjs --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/*.test.ts`.
- **`package.json`** (modified): `tsx` added then REMOVED (unused — native loader replaced it); no net dependency change.

#### Tests (+73, total 377 across 22 files)
- **`tests/product-variants-service-integration.test.ts`** (new, 31): Executes the REAL production executors through the shared authorization boundary against a disposable `ariot_variants_service_test` PostgreSQL DB (session forced to UTC to keep PrismaPg and the raw pool reading identical `updatedAt` instants). Controlled contexts: writer (`products.read`+`write`), reader (`products.read`), super (`["*"]`), namespace-wildcard (`["products.*"]`, denied per D-060), none. Covers create/update/archive/loader, deny vs allow, SKU + combination uniqueness, no-op, stale-token conflict, audit + token bumps, default clearing, price BigInt beyond `Number.MAX_SAFE_INTEGER`, media/stock field isolation, archived SKU reservation, loader exclusion/ordering, final integrity.
- **`tests/product-variant-schema.test.ts`** (modified, +31 → 67): Task 5 lifecycle/identity matrix — every request schema rejects `actorId`/`actorRole`/`userId`/`role`/`roles`/`permissions`/`createdAt`/`updatedAt`/`deletedAt` + unknown keys; I-028 pattern — priceMinor `safeParse` never throws, 300-digit valid parse, huge-malformed reject.
- **`tests/product-details-validation.test.ts`** (modified, +11 → 36): I-028 regression — `doesNotThrow` for `-100`/`abc`/`123abc`/`10.5`/`  -7  `, zero/positive/300-digit accept, negative/decimal/alpha/mixed/huge-malformed → `success:false`, whitespace trim, `''` → null.

#### Docs
- **`docs/08_KNOWN_ISSUES.md`** (updated): I-028 → Resolved (2026-08-18, Step 2.4.5 final). Added I-029 (Open, Low) — PrismaPg reads `timestamptz` as wall-clock UTC when the session timezone is non-UTC; test harness forces UTC; production should keep DB session timezone UTC.
- **`docs/06_PROGRESS_LOG.md`** (updated): Step 2.4.5 → Verified/Closed with final totals (376/376 pass + 1 opt-in R2 skip, 22 files), executor/wrapper architecture, I-028 fix, default-variant invariant deferred, archived-SKU verified, I-029 note.
- **`docs/10_AI_AGENT_CONTEXT.md`** (updated): Current state refreshed — real-service verification done, totals, runner command, executor boundary, I-028 resolved, I-029 note, next step.
- **`docs/05_IMPLEMENTATION_MASTER_PLAN.md`** (updated): Step 2.4.5 → closed with final evidence.
- **`docs/ADMIN_DASHBOARD_PLAN.md`** (updated): §4.2 variants — real-service verification + default-variant invariant deferred (no DB constraint; zero/multiple allowed today; service clears only when setting `true`).

### 2026-08-18 (Step 2.4.5 CLOSED — Product Editor Variants Tab)

#### Code
- **`server/admin/products/product-variant-schema.ts`** (new): Zod-only schema module (strip-types safe). `normalizeSku` (trim + collapse whitespace + uppercase), `normalizeOptionValues` (trim keys/values; max 20 keys, key ≤ 40, value ≤ 100; rejects non-object/empty key/empty value/non-string; `{}` allowed), `optionCombinationKey` (order-independent sorted-key JSON fingerprint), `variantFieldsSchema` (`.strict()`), `createVariantRequestSchema`/`updateVariantRequestSchema`/`archiveVariantRequestSchema`. `priceMinor` nullable digit-string → BigInt via `ctx.addIssue` (never throws), `currency` BDT/USD|null, `stock` non-negative Int, `isDefault` default false.
- **`server/admin/products/get-product-variants.ts`** (new): Loader — `requirePermission(PERMISSIONS.products.read)`, `canEdit = hasPermission(products.write)`, product NOT NULL + not deleted, variants `deletedAt: null` ordered `createdAt asc, id asc`; returns `AdminProductVariantsDto` (priceMinor string|null; `updatedAt` = product concurrency token).
- **`server/admin/products/product-variant-mutation-helpers.ts`** (new): `VariantMutationResult` union, `requireProductWrite`, `loadProduct`, `checkConcurrency` (Product.updatedAt token), `findSkuConflict` (global across all variants incl. archived + active products), `loadCombinationKeys` (active variants, exclude self), `isUniqueConstraintError` (P2002), `actorRole`, `buildSnapshot`, `detectChanges` (no-op detection), `CurrentVariant`.
- **`server/admin/products/create-product-variant.ts`** (new): Zod-validated create — SKU/combination uniqueness → clears existing default when `isDefault: true` → insert → touch `Product.updatedAt` + `updatedBy` → AuditLog `PRODUCT_VARIANT_CREATED` (entityType Product, entityId productId).
- **`server/admin/products/update-product-variant.ts`** (new): No-op → success without audit/token change; else uniqueness checks (self-excluding) → default clearing → update → token bump → AuditLog `PRODUCT_VARIANT_UPDATED`.
- **`server/admin/products/archive-product-variant.ts`** (new): Soft-delete `deletedAt`; idempotent no-op when already archived; token bump + AuditLog `PRODUCT_VARIANT_ARCHIVED`.
- **`app/api/admin/products/variants/route.ts`** (new): `POST` dispatcher on `action` (`createVariant`/`updateVariant`/`archiveVariant`), payload `{ productId, expectedUpdatedAt, ... }`; status map ok→200, forbidden→403, conflict→409, not_found→404, else 400; missing/unknown action → 400; catch → sanitized 500.
- **`app/(admin)/admin/products/[id]/variants/page.tsx`** (new): `force-dynamic`; auth redirects; `notFound()` for missing product; renders `ProductVariantsShell` with `expectedUpdatedAt`.
- **`components/admin/products/product-variants-shell.tsx`** (new): Boundary shell loading variants via `getProductVariants`, passes token + `canEdit` down.
- **`components/admin/products/product-variants-editor.tsx`** (new): Optimistic updates — create appends returned variantId + submitted data; update replaces row + flips others' isDefault=false when isDefault true; archive filters out; conflict → error banner with Reload; responsive table (`min-w-[880px]`, `overflow-x-auto`), option chips, inline edit/archive, empty state, read-only when `!canEdit`.
- **`components/admin/products/variant-form.tsx`** (new): Create/update form — name, SKU, dynamic option key/value rows (add/remove), price, currency, stock, barcode, isDefault toggle.
- **`components/admin/products/variant-form-field.tsx`** (new): Shared `FormField` label/error wrapper + `formInputClass` input styling.
- **`components/admin/products/product-editor-header.tsx`** (modified): Added Variants tab between Media and Specifications; `isActive` handles `/variants`.

#### Tests (+65, total 304 across 21 files)
- **`tests/product-variant-schema.test.ts`** (new, 36): normalizeSku, normalizeOptionValues, optionCombinationKey order-independence, variantFieldsSchema, all three request schemas.
- **`tests/product-variants-integration.test.ts`** (new, 18): Disposable DB `ariot_variants_test` mirroring service rules — create (row/audit/token/normalization), SKU collisions (variant + product), duplicate combination (key-order independent), invalid options, default clearing, update (row/audit/token), no-op (no audit/token), duplicate SKU/combination on update, stale-token conflict, missing variant, archive (deletedAt/audit/token), archive idempotency, loader excludes archived, archived SKU reserved, isDefault default false, final integrity.
- **`tests/product-variants-api-security.test.ts`** (new, 11): Route contract — imports only the three public services, type-only helper import, no schema import, no actor/permission/role fields, action dispatch, status mapping, sanitized 500, no Prisma/SQL/stack exposure.

#### Docs
- **`docs/06_PROGRESS_LOG.md`** (updated): Added row `2.4.5-variants` → Done (2026-08-18); recommended-next updated to Step 2.4.6.
- **`docs/08_KNOWN_ISSUES.md`** (updated): Added I-028 — `product-details-schema.ts` price transform throws instead of `ctx.addIssue` (latent robustness; variants schema already fixed the pattern).
- **`docs/10_AI_AGENT_CONTEXT.md`** (updated): Status/current-step/completion-table refreshed — Step 2.4.5 → Done.
- **`docs/05_IMPLEMENTATION_MASTER_PLAN.md`** (updated): Step 2.4.5 status flipped to Done with variant summary.
- **`docs/07_DECISIONS.md`** (updated): Added D-069 (SKU normalized to uppercase; variant concurrency via Product.updatedAt; soft-delete archive). Total decisions 64 → 67.
- **`docs/ADMIN_DASHBOARD_PLAN.md`** (updated): §4.2 variants subsection marked implemented.
- **`docs/DATABASE_SCHEMA_PLAN.md`** (updated): ProductVariant usage notes (optionValues free-form, soft-delete, SKU normalization, global uniqueness).

#### Code
- **`server/storage/media-storage-provider.ts`** (new): `MediaStorageProvider` interface (`name`, `getPublicUrl(storageKey, cdnUrl)`, `checkHealth`) + `MediaStorageProviderName` union (`'local' | 'r2'`).
- **`server/storage/media-storage-config.ts`** (new): `LocalMediaConfig`, `getLocalMediaConfig()`, `assertSafeLocalRoot()` — absolute-only root; rejects literal `..` segments (checked on the raw value) and roots inside the Next.js `public/` dir; dev default `resolve(cwd, '..', 'ariot-media-dev')`.
- **`server/storage/local-storage-fs.ts`** (new): `resolveKeyPath`, `writeTempFile` (exclusive `wx`), `promoteToPublic` (atomic rename), `deleteOwnedKey`, `statPublicKey`, `isRootWritable` — provider-neutral canonical key handling; absolute paths never persisted.
- **`server/storage/local-media-storage.ts`** (new): `LocalMediaStorageProvider` — `getPublicUrl` = persisted `cdnUrl` else `${publicBaseUrl}/media/...` else `/media/...`; `checkHealth` verifies root writability.
- **`server/storage/r2-media-storage.ts`** (new): `R2MediaStorageProvider` — `getPublicUrl` = `cdnUrl` else `/${storageKey}`; `checkHealth` = `getR2ClientSafe()` presence.
- **`server/storage/get-media-storage-provider.ts`** (new): `resolveProviderName()` + `getMediaStorageProvider()` + `resetMediaStorageProviderForTests()`. Unset → `local` in dev, fail-closed in production; unknown value → fail-closed; `r2` requires the full R2 env set else fail-closed.
- **`server/storage/media-file-verification.ts`** (new): `verifyUploadedBuffer()` — file-type sniff of the first 64 KiB (≥12 bytes) vs declared MIME; 6 approved formats.
- **`server/storage/local-upload.ts`** (new): `localUploadFromForm(form, req, deps)` — `requireMediaWrite` gate → strict Zod form contract (`file` File + `mimeType` + `kind`, exactly one file) → MIME/kind agreement → size caps (10 MB image / 200 MB video) → server `newMediaAssetId()` + canonical temp/public keys → `writeTempFile` → `verifyUploadedBuffer` → `promoteToPublic` → size re-stat → `persistCompletedAsset` (cdnUrl from provider) → compensation `deleteOwnedKey` on failure.
- **`server/storage/upload-persist.ts`** (modified): Signature now `persistCompletedAsset(payload: PersistPayload, actorRole, options, deps)` — `config: R2Config` param removed; `PersistOptions` gains `cdnUrl?: string | null`; new structural `PersistPayload` type (no token metadata).
- **`server/storage/upload-complete.ts`** (modified): R2 finalize computes `cdnUrl` from `config.publicBaseUrl` and passes it through `PersistOptions`.
- **`server/storage/storage-service.ts`** (modified): Barrel exports `localUploadFromForm`, `getMediaStorageProvider`, `resolveProviderName`, provider types.
- **`server/admin/products/get-product-media.ts`** (modified): Media URL generation centralized via `mediaStorageProvider.getPublicUrl(storageKey, cdnUrl)`.
- **`server/admin/media/media-policy.ts`** (modified): Added `APPROVED_EXT_TO_MIME` + `getMimeForExtension()` (delivery route MIME resolution).
- **`server/env.ts`** + **`.env.example`** + **`.env`** (modified): Added `MEDIA_STORAGE_PROVIDER` (z.enum local/r2, optional), `MEDIA_LOCAL_ROOT` (absolute-path refine, optional), `MEDIA_PUBLIC_BASE_URL` (z.url, optional); `.env` set to `local` + `F:/My_projects/ariot-media-dev`.
- **`app/api/admin/media/uploads/local/route.ts`** (new): Thin dispatcher — Content-Length pre-guard (`MAX_VIDEO_SIZE_BYTES + 1 MiB` → 413) then `request.formData()` → `localUploadFromForm`.
- **`app/api/admin/media/upload/mode/route.ts`** (new): `GET` → `{ ok, provider }` server-resolved provider for the client.
- **`app/api/admin/media/storage/health/route.ts`** (new): `GET` → provider `checkHealth`, admin-gated.
- **`app/media/[...segments]/route.ts`** (new): Public delivery — Node runtime; only active when provider `instanceof LocalMediaStorageProvider`; reconstructs `public/{...}` key via `parsePublicMediaKey`; GET + explicit HEAD; Range support (206/416, `MAX_RANGE_LENGTH` 10 MiB); `Cache-Control: public, max-age=31536000, immutable`; `tmp/` unreachable; no listing; MEDIA_LOCAL_ROOT never leaked.
- **`features/admin/media/use-media-upload.ts`** (rewritten): Provider-agnostic — resolves mode via `GET /api/admin/media/upload/mode` (cached); shared `xhrSend` transport; `runLocalUpload` (multipart, progress/abort) vs `runR2Upload` (initiate/PUT/complete); hook interface unchanged.
- **`components/admin/products/media-upload.tsx`** (modified): Header comment only — upload wiring unchanged.

#### Tests (+45, total 239 across 18 files)
- **`tests/media-storage-config.test.ts`** (new, 15): provider selection (local default; unknown fails closed), local/R2 public-URL rules, `assertSafeLocalRoot` (absolute OK, relative/`..`/inside-`public` rejected), ext→MIME map, env-contract fail-closed via dynamic import of `env.ts`.
- **`tests/local-upload-validation.test.ts`** (new, 19): route-contract checks (thin dispatcher, mode route, health route, delivery-route key parsing), form contract (permission denied, 0/multi-file, unknown fields, unsupported MIME, kind/MIME mismatch, empty file, image/video size caps), signature verification (JPEG-as-PNG rejected + cleanup, PNG-as-MP4 rejected), `verifyUploadedBuffer` cases.
- **`tests/local-upload-integration.test.ts`** (new, 10): Disposable DB `ariot_local_upload_test` + isolated temp root — happy path (rows + promoted file + clean temp + correct URLs), distinct server assets for identical uploads, permission-denied (no row/files), signature mismatch (no row, temp cleaned), too-small file, multi-file, unknown field, size cap, promoted stat matches bytes.
- **`tests/media-upload-local.smoke.test.ts`** (new, 1): End-to-end local smoke (write → verify → promote → persist → deliver) — self-contained (os.tmpdir root + disposable DB `ariot_media_smoke_test`), ALWAYS runs (unlike the credential-gated R2 smoke).

#### Docs
- **`docs/07_DECISIONS.md`** (updated): Added D-068 (media storage provider abstraction; local default; R2 retained). Total decisions 63 → 64.
- **`docs/06_PROGRESS_LOG.md`** (updated): Added row `2.4.4-local` ✅ Done (2026-08-18); recommended-next updated to Step 2.4.5.
- **`docs/08_KNOWN_ISSUES.md`** (updated): I-027 scoped to R2-only (no longer blocks Step 2.4.4, which ships on the local provider).
- **`docs/10_AI_AGENT_CONTEXT.md`** (updated): Status/current-step/completion-table refreshed — Step 2.4.4 ✅ Done via local provider.
- **`docs/05_IMPLEMENTATION_MASTER_PLAN.md`** (updated): Step 2.4.4 status flipped to Done with local-provider summary.
- **`docs/LOCAL_MEDIA_STORAGE.md`** (new): Local provider runbook — env contract, storage layout, Nginx `location /media/ { alias ... }` delivery (doc only), backup = PG dump + `MEDIA_LOCAL_ROOT/public/` off-server, R2 migration design (no migration script).
- **`docs/CLOUDFLARE_R2.md`** (updated): Noted provider abstraction — R2 is now the opt-in alternative behind `MEDIA_STORAGE_PROVIDER=r2`.
- **`docs/TECH_ARCHITECTURE.md`** (updated): Documented the storage provider layer, local routes, and delivery path.
- **`docs/DATABASE_SCHEMA_PLAN.md`** + **`docs/ADMIN_DASHBOARD_PLAN.md`** (updated): Noted no schema change; media uploads now active under the local provider.

#### Verification
- **238/239 node:test pass** (1 opt-in R2 smoke skipped without credentials), 0 fail, across 18 test files.
- `tsc --noEmit` ✅ (0 errors) · `eslint --max-warnings 0` ✅ (0 errors, 0 warnings) · `next build` ✅ (59 routes incl. `/media/[...segments]`) · `git diff --check` clean.
- No schema/migration change. Scratch files (`mandate.txt`, `.claude-spec-tmp.txt`, `New Text Document.txt`, `test-baseline.log`) removed.

#### Out of scope (explicitly NOT changed)
- Step 2.4.5 (Variants tab) — not started.
- Private media, documents, firmware, 3D uploads — still deferred per D-067.
- Live R2 dev-bucket smoke test — still blocked on env creds; I-027 scoped to R2 only and no longer gates Step 2.4.4 closure.

---

### 2026-08-17 (Step 2.4.4 — R2 Upload Implementation Security Correction)

#### Code (security corrections against STORAGE-1R / D-067)
- **`server/storage/media-id.ts`** (new): Server-side id minting via `cuid` (matches Prisma `MediaAsset.id` type); strict regex `^c[a-z0-9]{24}$` validator. Removes the client-controlled `mediaAssetId` defect (D1).
- **`server/storage/upload-initiate.ts`** (modified): Strict Zod initiation schema (`filename`, `mimeType`, `sizeBytes`, `kind` only); client no longer controls `userId`/`mediaAssetId`/keys (D2, D3). Server generates id, `tempKey`, `publicKey`; binds `userId` from auth into the minted token. 5-minute presigned PUT (`PutObjectCommand` + `getSignedUrl`) — fixes presigned POST/PUT ambiguity (D5). All direct package declarations verified (D6).
- **`server/storage/upload-complete.ts`** (modified): Strict completion contract (`completionToken`, optional `altText`/`caption`); same-user authorization check (`auth.userId !== payload.userId` → reject); bounded 64 KiB ranged GET with `readBounded`; real `file-type@^21` signature detection (6 approved formats: jpeg/png/webp/avif/mp4/webm) (D7); ETag-bound `CopyObject` via `CopySourceIfMatch` (D10); permanent-object HEAD reverify; best-effort `DeleteObject` temp cleanup (D9). Idempotency is `MediaAsset.id` (PK), not an in-memory `Set` of JTIs (D8).
- **`server/storage/upload-persist.ts`** (modified): PK-based pre-transaction `findUnique` idempotency; P2002 race catch; in-transaction MediaAsset + AuditLog.
- **`server/storage/upload-context.ts`** (modified): `getR2ConfigSafe()` wrapper; auth-context override seam for tests; `requireMediaWrite(req?)` accepts optional Request.
- **`server/storage/r2-client.ts`** (modified): `resetR2ClientForTests()` helper; relative import for `env.ts` (avoids `@/` alias issue under `node --experimental-strip-types`).
- **`server/env.ts`** (modified): `MEDIA_UPLOAD_TOKEN_SECRET` min-length AND base64-decoded-byte-length ≥ 32.
- **`features/admin/media/use-media-upload.ts`** (rewritten): Sends only `{filename, mimeType, sizeBytes, kind}` on initiate; sends only `{completionToken}` on complete; XHR abort + `inflightRef` duplicate-submit guard; mirrors MAX_IMAGE_BYTES=10 MB / MAX_VIDEO_BYTES=200 MB.
- **`app/api/admin/media/upload/initiate/route.ts`** + **`app/api/admin/media/upload/complete/route.ts`** (modified): Map `not_configured` to HTTP 503.

#### Tests (corrects the unsupported completion claims)
- **`tests/upload-complete-integration.test.ts`** (new, 12 scenarios): Disposable PostgreSQL DB with seeded `MediaAsset` + `AuditLog` (MediaKind + RoleKey enums); mocked S3 client implements `HeadObject` / `GetObject` (stream) / `CopyObject` (with ETag-bound precondition) / `DeleteObject`; covers happy-path + replay idempotency (exactly one MediaAsset + one AuditLog), ETag-bound copy failure (concurrent PUT), size-mismatch, content-type mismatch, detected-MIME mismatch (JPEG bytes vs declared PNG), zero-byte body, declared-VIDEO-but-image, tampered tempKey path-traversal, concurrent same-token completes (one asset + one audit), temp-cleanup failure not rolling back, permanent-object HEAD verification failure, and ranged-GET stream failure (no row) (D11).
- **`tests/media-upload-r2.smoke.test.ts`** (new): Opt-in end-to-end smoke test against a real R2 dev bucket. Skips if any `R2_*` / `MEDIA_UPLOAD_TOKEN_SECRET` is absent; fails on partial config; explicitly refuses production bucket names; cleans up `tmp/` and `public/` objects it creates (D12).
- **`tests/upload-complete-logic.test.ts`** (modified): Updated same-user assertion to match the production check.
- **`tests/upload-token.test.ts`** (13) + **`tests/upload-keys.test.ts`** (18) + **`tests/upload-complete-logic.test.ts`** (8): all passing.
- **All `node --experimental-strip-types --test` runs (verified 2026-08-17)**: **159 unit/contract tests pass** (10 files) + **34 PostgreSQL integration tests pass** (3 files; 12 of them are the R2 upload-complete scenarios) + **1 R2 smoke test correctly skips without credentials** = 193 pass / 1 skipped / 0 fail across 14 test files.

#### Docs
- **`docs/06_PROGRESS_LOG.md`** (updated): Step 2.4.4 row updated with verified test counts (159 unit/contract + 34 integration + 1 opt-in smoke) and security-correction summary.
- **`docs/07_DECISIONS.md`** (updated): D-067 supplementary note listing the 13 defects closed in the security-correction pass.
- **`docs/08_KNOWN_ISSUES.md`** (updated): I-027 wording updated — corrected test totals (prior 181 and 34 totals both mis-stated coverage); R2 credentials still required for smoke test.
- **`docs/10_AI_AGENT_CONTEXT.md`** (updated): Implementation status, current-step status, build-status block, completion table all refreshed to reflect the verified test counts and the security-correction pass.
- **`docs/CLOUDFLARE_R2.md`** (updated): §4 flow diagram corrected to show `PUT` (not POST) presigned upload; §5 smoke-test runbook now lists the 12 scenarios covered by the integration suite and points to the opt-in smoke test module.

#### Verification
- **193/194 node:test pass** (159 unit/contract across 10 files + 34 PostgreSQL integration across 3 files), **1 opt-in smoke skipped** without credentials, 0 fail.
- `tsc --noEmit` ✅ (0 errors) · `eslint --max-warnings 0` ✅ (0 errors, 0 warnings) · `next build` ✅ (58 routes) · `prisma validate` ✅ · `prisma generate` ✅ · `git diff --check` clean.
- No schema/migration change. Direct deps verified: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `cuid`, `file-type`, `pg` all declared in `package.json`.

#### Out of scope (explicitly NOT changed)
- Step 2.4.5 (Variants tab) — not started.
- Private media, documents, firmware, 3D uploads — explicitly deferred per D-067.
- Real R2 dev-bucket smoke test against live credentials — still blocked on env; I-027 remains open. Step 2.4.4 stays 🟨 In Progress until the live smoke test passes.

---

### 2026-08-05 (Step 2.4.4 closure — STORAGE-1R Cloudflare R2 Uploads)

#### Code
- **`server/storage/upload-token.ts`** (modified): HMAC-SHA256 upload-completion token `v1.<base64url-payload>.<base64url-hmac>`. Strict Zod payload (10 fields) binding `mediaAssetId`, keys, `mimeType`, `sizeBytes`, `kind`, `userId`; 15-minute lifetime; `jti` ≥128 bits entropy; constant-time HMAC comparison. Fixed relative import depth to `../admin/media/media-policy.ts`.
- **`server/storage/upload-keys.ts`** (modified): Canonical key builders (`tmp/uploads/{yyyy}/{mm}/{id}.{ext}`, `public/products/{images|videos}/{yyyy}/{mm}/{id}.{ext}`) + strict regex parsers (reject traversal/`//`/`\`/uppercase ext), `isSafeObjectKey` defense-in-depth guard, and `validateTokenKeys` (temp+public key id/kind/ext cross-check against the token). `.ts`-extension relative imports so modules run under `node --test`.
- **`server/storage/upload-context.ts`** (new): `getR2ConfigSafe` (typed R2 config from `server/env.ts`, `null` when unconfigured) + `requireMediaWrite` service-level RBAC gate.
- **`server/storage/upload-initiate.ts`** (new): `initiateUpload` — `media.write` gate, strict Zod input, image (10 MB) / video (200 MB) size limits, kind↔MIME agreement, canonical keys from the preallocated MediaAsset id, minted completion token, 5-minute presigned PUT with `Content-Type` bound.
- **`server/storage/upload-persist.ts`** (new): Transactional `MediaAsset` create + `MEDIA_ASSET_UPLOADED` AuditLog; `MediaAsset.id` is the idempotency boundary (replay returns the same verified asset); best-effort temp-object cleanup after promote.
- **`server/storage/upload-complete.ts`** (new): `completeUpload` — `media.write` + same-user binding (D-067), token verify, `validateTokenKeys`, HEAD (exact size + MIME + ETag), ≤64 KiB ranged GET with `IfMatch` + real file-signature detection (file-type, six approved formats only), `CopyObject` promote to immutable `public/` with `Cache-Control: public, max-age=31536000, immutable`, permanent-object reverify, then persist.
- **`server/storage/storage-service.ts`** (rewritten): Barrel re-export keeping the two route import paths stable (`initiateUpload`/`completeUpload`).
- **`tests/upload-token.test.ts`** (new): 13 tests (format, round-trip, TTL, jti entropy/uniqueness, bad-signature, tampered payload, malformed, non-JSON, strict-payload, expired, unknown-field rejection).
- **`tests/upload-keys.test.ts`** (new): 24 tests (key round-trips, zero-pad, year/month bounds, malformed/injected keys, kind↔folder, `isSafeObjectKey`, `validateTokenKeys` acceptance/rejection paths).
- **`tests/upload-complete-logic.test.ts`** (new): 8 tests (minted-token end-to-end binding, same-id invariant, swapped keys, kind mismatch, forged/stale tokens, D-067 same-user source contract).
- **`tests/product-media-validation.test.ts`** (modified): +4 route-contract tests for the initiate/complete dispatchers and the search route.

#### Config
- **`.env.example`** (modified): Added `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (per-env bucket), `R2_PUBLIC_BASE_URL`, `MEDIA_UPLOAD_TOKEN_SECRET`.

#### Docs
- **`docs/CLOUDFLARE_R2.md`** (new): R2 provisioning guide — bucket-per-environment, credentials, CORS, custom-domain delivery, WAF default-deny with only `/public/*` reachable, smoke-test runbook.
- **`docs/07_DECISIONS.md`**, **`docs/08_KNOWN_ISSUES.md`** (I-027), **`docs/06_PROGRESS_LOG.md`**, **`docs/10_AI_AGENT_CONTEXT.md`**, **`docs/05_IMPLEMENTATION_MASTER_PLAN.md`** (updated).

#### Verification
- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `next build` ✅ (58 routes) · **181/181 node:test pass** (13 token + 24 keys + 8 completion logic + route contracts).
- Real R2 dev-bucket smoke test **NOT run** — no R2 credentials present in local `.env`. Tracked as I-027. Step remains 🟨 In Progress pending the smoke test.

---

### 2026-07-26 (Step 2.4.4 — Product Editor: Media Tab)

#### Code
- **`server/admin/media/media-policy.ts`** (new): Centralized MIME allowlists, size limits, media-kind constants.
- **`server/admin/products/get-product-media.ts`** (new): Server-only product media loader + media library search with cursor pagination.
- **`server/admin/products/update-product-media.ts`** (new): 9 narrowly-scoped mutations (setHeroImage, clearHeroImage, setHeroVideo, clearHeroVideo, addGalleryImage, removeGalleryImage, reorderGallery, addGalleryVideo, removeGalleryVideo). Strict Zod schemas, optimistic concurrency, MIME validation, transactional audit logging.
- **`app/(admin)/admin/products/[id]/media/page.tsx`** (new): Protected Server Component for Media tab.
- **`app/api/admin/products/media/route.ts`** (new): POST endpoint dispatching media mutations by action field.
- **`app/api/admin/media/search/route.ts`** (new): GET endpoint for media library search.
- **`components/admin/products/product-editor-header.tsx`** (new): Shared tab navigation with real links for Details/Media, disabled for future tabs.
- **`components/admin/products/product-media-shell.tsx`** (new): Media tab shell wrapping shared header + editor.
- **`components/admin/products/product-media-editor.tsx`** (new): Media editor UI — hero image, gallery, videos, upload placeholder, 3D placeholder.
- **`components/admin/products/media-selector.tsx`** (new): Server-backed media library selector dialog with search, type filter, cursor pagination, alt text input.
- **`components/admin/products/product-editor-shell.tsx`** (modified): Now uses shared `ProductEditorHeader` for consistent tab navigation.
- **`tests/product-media-validation.test.ts`** (new): 12 tests (MIME policy, route contracts).
- **`tests/product-media-integration.test.ts`** (new): 11 tests (hero set/clear, MIME rejection, no-op, gallery, concurrency, no hard delete).

#### Architecture Gap
- **Storage provider**: No approved provider configured. Decision D-015 ("S3-compatible") is frozen/deferred. No SDK installed, no signing service, no upload route. Upload section clearly disabled in UI. Step remains 🟨 In Progress.

#### Verification
- Unit tests: 114/114 pass (36 perm + 30 validation + 11 queue + 12 auth + 13 API security + 12 media) ✅
- Integration tests: 26/26 pass (11 mutation + 4 denied-write + 11 media) ✅
- Total: 140 tests, all pass ✅
- `prisma validate` ✅ · `tsc --noEmit` ✅ · `eslint . --max-warnings 0` ✅ · `next build` ✅ (57 routes)
- No schema/migration change. Disposable DBs dropped after tests.

---

### 2026-07-26 (Step 2.4.3 Closure — Shared Authorization Orchestration)

#### Code
- **`server/admin/products/authorized-product-update.ts`** (new): Shared orchestration factory `createAuthorizedProductDetailsUpdater()`. Accepts `authorize` + `executeUpdate` dependencies. Used by both production and tests. Sanitizes executor failures.
- **`server/admin/products/update-product-details.ts`** (modified): Production `updateProductDetails` is now created by the shared factory (not a separate hand-written wrapper). Imports `createAuthorizedProductDetailsUpdater`. Removed separate `AuthorizationContext` import.
- **`tests/product-auth-wrapper.test.ts`** (rewritten): Removed separate `createTestableWrapper`. Now imports and exercises the same `createAuthorizedProductDetailsUpdater` factory as production. 12 tests: auth success, denial, sanitization, passthrough.
- **`tests/product-denied-write.test.ts`** (new): Disposable PostgreSQL integration test. Creates/drops `ariot_auth_denial_test`. 4 tests: read-only denied (Product/AuditLog unchanged), empty denied, products.* denied, global "*" permitted + restored.
- **`tests/product-api-route-security.test.ts`** (new): Static security contract verification. 13 tests: import assertions, no actor/permission/role acceptance, sanitized errors, correct HTTP status mapping.
- **`tests/product-editor-integration.test.ts`** (modified): Now self-manages disposable DB lifecycle (creates/drops `ariot_editor_test`). No external setup required.

#### Verification
- Unit tests: 102/102 pass (36 perm + 30 validation + 11 queue + 12 auth + 13 API security) ✅
- Integration tests: 15/15 pass (11 mutation + 4 denied-write) ✅
- Total: 117 tests, all pass ✅
- `prisma validate` ✅ · `prisma generate` ✅ · `tsc --noEmit` ✅ · `eslint . --max-warnings 0` ✅ · `next build` ✅ (54 routes)
- No schema/migration change. Disposable databases dropped after tests.
- D-065 added (shared orchestration factory decision).

---

### 2026-07-25 (Step 2.4.3 — Product Editor: Details Tab)

#### Code
- **`server/admin/products/product-details-schema.ts`** (new): Zod validation schema for product details fields. `normalizeSlug` helper. Enum constants for SalesType, Currency. `status` field excluded from schema (D-064).
- **`server/admin/products/get-product.ts`** (new): Server-only product loader. Requires `products.read`. Returns `AdminProductDetailsDto` + `canEdit` flag (based on `products.write`). Includes category list for selects.
- **`server/admin/products/update-product-details.ts`** (new): Production authorized wrapper (`updateProductDetails`) + internal testable service (`executeProductDetailsUpdate`). Requires `products.write`. Validates input, checks optimistic concurrency (`updatedAt`), detects actual changes (no-op skips write+audit), checks slug/SKU uniqueness, validates category existence. Status field NOT accepted. Writes in transaction with AuditLog.
- **`app/(admin)/admin/products/[id]/page.tsx`** (new): Dynamic route, force-dynamic, auth-gated, notFound for missing products.
- **`app/api/admin/products/update-details/route.ts`** (new): POST endpoint calling authorized wrapper only.
- **`components/admin/products/product-editor-shell.tsx`** (new): Page header (back link, name, SKU, status chip, read-only badge), tab strip (Details active, 5 future tabs as "Soon"), metadata panel (id, dates, stock).
- **`components/admin/products/product-details-editor.tsx`** (new): Single-flight save queue (at most one request active; pending edits queued; manual Save joins queue). 1000ms debounce. Status displayed read-only. beforeunload warning.
- **`components/admin/products/products-table.tsx`** (modified): Product name now links to `/admin/products/[id]`.
- **`app/(admin)/admin/products/page.tsx`** (modified): Updated subtitle.
- **`package.json`** (modified): Added `test:product-details` script.
- **`tsconfig.json`** (modified): Added `allowImportingTsExtensions: true`.
- **`tests/product-details-validation.test.ts`** (new): 23 unit tests (slug, validation, request schema).
- **`tests/product-editor-integration.test.ts`** (new): 8 integration tests against disposable PostgreSQL (update, no-op, concurrency, duplicate slug/SKU, invalid category, BigInt price, restore).

#### Verification
- Integration tests: 11/11 pass against real disposable PostgreSQL ✅
- Unit tests: 30 validation + 36 permissions + 11 save-queue = 77 total ✅
- `tsc --noEmit` ✅ · `eslint . --max-warnings 0` ✅ · `next build` ✅ (54 routes)
- No schema/migration change. Disposable DB dropped after tests.
- D-064 added (lifecycle exclusion from autosave).
- Strict Zod `.strict()` rejects forbidden fields atomically (verified with DB state).

---

### 2026-07-25 (Corrective Step C.1 — Resolve I-025 Permission Wildcard Mismatch)

#### Code

- **`server/auth/permission-catalog.ts`** (new, ~200L): Central permission catalog. `PERMISSIONS` object with all explicit permission constants. `GLOBAL_WILDCARD = '*'`. `Permission` type union. `ROLE_PERMISSION_SETS` for all 4 roles. `WILDCARD_EXPANSION` mapping for reconciliation. Pure evaluators: `hasPermission`, `hasAllPermissions`, `hasAnyPermission`.
- **`server/auth/permissions.ts`** (modified): `requirePermission` and `requireAnyPermission` now delegate to `hasAllPermissions`/`hasAnyPermission` from the catalog. Inline wildcard checks removed. JSDoc updated to note namespace wildcards are not supported (D-060, D-063).
- **`server/admin/products/list-products.ts`** (modified): Comment updated — CONTENT_ADMIN now listed as ✓ (C.1 reconciled).
- **`prisma/seed.ts`** (modified): All role permission arrays replaced with explicit values. No namespace wildcards.
- **`scripts/reconcile-role-permissions.ts`** (new, ~240L): Offline idempotent reconciliation CLI. Dry-run default. `--apply` for writes. `--production` for non-local DBs. Transactional. AuditLog entry per changed role. Fails closed on unknown wildcards/roles.
- **`tests/permission-evaluator.test.ts`** (new, ~330L): 36 focused tests using `node:test`. Covers exact match, missing permission denial, global `"*"`, namespace wildcard denial, ALL/ANY semantics, role set validation, structural invariants.
- **`package.json`** (modified): Added `permissions:reconcile` and `test:permissions` scripts.
- **`tsconfig.json`** (modified): Added `allowImportingTsExtensions: true` (required for Node `--experimental-strip-types` test runner).

#### Database changes (local only, via reconciliation CLI)

- **CONTENT_ADMIN**: `["products.*", "categories.*", "blog.*", "media.*", "support_articles.*"]` → `["blog.read", "blog.write", "categories.read", "categories.write", "media.read", "media.write", "products.read", "products.write", "support_article.read", "support_article.write"]`
- **SUPPORT_ADMIN**: `["tickets.*", "customers.read_masked", "products.read", "support_articles.*"]` → `["customer.read", "media.read", "media.write", "order.read", "products.read", "support_article.read", "support_article.write", "ticket.read", "ticket.reply"]`
- **SALES_ADMIN**: `["quotes.*", "orders.*", "customers.*", "products.read", "analytics.sales.read"]` → `["analytics.sales.read", "customer.read", "customer.write", "order.read", "order.refund", "order.transition", "products.read", "quote.read", "quote.respond", "ticket.read"]`
- **SUPER_ADMIN**: Unchanged (`["*"]`)
- 3 AuditLog entries created (one per changed role, action `ROLE_PERMISSIONS_RECONCILED`)
- Pre-apply backup: `C:\Users\princ\backups\ariot\ariot_pre_c1_20260725_205020.dump`

#### Verification

- `tsc --noEmit` ✅ · `eslint . --max-warnings 0` ✅ · `next build` ✅ (53 routes) · Permission tests 36/36 ✅ · `prisma validate` ✅ · Second CLI apply = no-op ✅.
- I-025 resolved. D-060 resolved. D-063 added.

---

### 2026-07-25 (Corrective Step C.2 — Final Verification & Closure)

#### Verification only — no schema, migration, or source code changes.

- **Stable backup created**: `C:\Users\princ\backups\ariot\ariot_pre_c2_20260725_201317.dump` (77.4 KB, pg_dump custom format, PostgreSQL 18.3). Archive verified with `pg_restore --list` (190 TOC entries, gzip compressed).
- **Migration record verified**: `corrective_c2_drop_search_vectors` exists exactly once in `_prisma_migrations`, applied successfully, no rollback, correct order (3rd of 3).
- **4-way Prisma migrate diff**: (A) migrations→database: empty diff, (B) schema→database: empty diff, (C) migrations→schema: empty diff, (D) fresh disposable replay: all 3 migrations applied cleanly.
- **Future migration probe**: Disposable `ariot_probe_c2` database created from zero. Temporary `c2MigrationProbe String?` field added to AuditLog. `prisma migrate dev --create-only` succeeded. Generated SQL contained only `ALTER TABLE "AuditLog" ADD COLUMN "c2MigrationProbe" TEXT`. Probe field reverted, probe migration deleted, disposable databases dropped, no artifacts remain.
- **Primary DB re-verified**: Row counts unchanged (Product:6, Category:6, BlogPost:3, Role:4, User:1, MediaAsset:9, AuditLog:0). Product IDs/slugs unchanged. No searchVector columns. 5 trigram GIN indexes present (`Product_name_idx`, `Product_tagline_idx`, `Product_description_idx`, `BlogPost_title_idx`, `BlogPost_body_idx`).
- **Application regression**: `prisma validate` ✅ · `prisma generate` ✅ · `prisma migrate status` ✅ · `tsc --noEmit` ✅ · `eslint . --max-warnings 0` ✅ · `next build` ✅ (53 routes, `/admin` ƒ, `/admin/products` ƒ) · `git diff --check` ✅.
- **Documentation updated**: `06_PROGRESS_LOG.md`, `08_KNOWN_ISSUES.md`, `09_CHANGELOG.md`, `10_AI_AGENT_CONTEXT.md`, `IMPLEMENTATION_BASELINE.md`, `DATABASE_SCHEMA_PLAN.md`, `05_IMPLEMENTATION_MASTER_PLAN.md`.
- **C.2 Status**: ✅ Completed.

---

### 2026-07-10 (Corrective Step C.2 — Resolve I-019 / I-026 generated-column drift)

#### Root cause
`Product.searchVector` and `BlogPost.searchVector` were created in the init migration as `GENERATED ALWAYS AS (...) STORED tsvector` columns. `schema.prisma` declared them as plain `Unsupported("tsvector")?` without the generated expression. Every Prisma migration diff proposed `ALTER COLUMN "searchVector" DROP DEFAULT` — invalid on PostgreSQL `GENERATED ALWAYS AS` columns (ERROR 42601). This blocked all future `prisma migrate dev` runs.

#### Code changes
- **`prisma/schema.prisma`**: Removed `searchVector Unsupported("tsvector")?` from both `Product` and `BlogPost` models. Removed `@@index([searchVector], type: Gin)` from both models. Comment added explaining the removal. All other indexes (trgm GIN on name/tagline/description/title/body) preserved.
- **`prisma/migrations/corrective_c2_drop_search_vectors/migration.sql`** (new): `DROP INDEX IF EXISTS "Product_searchVector_idx"`, `ALTER TABLE "Product" DROP COLUMN IF EXISTS "searchVector"`, same for BlogPost. Full SQL comments explaining root cause, resolution, and data safety rationale.

#### Verification
- Local backup created: `ariot_backup_c2_20260710_225649.dump` (80 KB, pg_dump custom format, PostgreSQL 18).
- Pre-correction baseline: 6 Products, 6 Categories, 3 BlogPosts, 4 Roles, 1 User, 9 MediaAssets, 0 AuditLogs — all unchanged after correction.
- Clean-replay test (disposable `ariot_c2_test` DB): all 3 migrations applied cleanly; searchVector columns absent; trgm indexes preserved.
- Primary DB corrected: searchVector columns and GIN indexes dropped; all row counts identical; product IDs/slugs unchanged.
- `prisma validate` ✅ · `prisma generate` ✅ · `prisma migrate status` → "3 migrations / up to date" ✅ · `tsc` ✅ · `eslint --max-warnings 0` ✅ · `next build` ✅ (exit 0).
- I-019 closed. I-026 closed. D-062 added.

---

### 2026-07-10 (Corrective planning — complete admin scope, homepage CMS, promotions, and workspace booking architecture)

#### Documentation only — no source code, no Prisma schema, no migrations changed.

#### Scope additions
- **New categories 2.10–2.16**: R&D Management, Structured Homepage CMS, Central Promotions Engine, Workspace Plans & Online Booking, Component Catalog & Inventory, SEO Management, Content Expansion.
- **Corrective steps C.1 (permission wildcard) and C.2 (I-019 migration drift)**: formal prerequisites before any new schema migration.
- **Complete admin IA**: all planned nav sections documented in ADMIN_DASHBOARD_PLAN §9 (Overview, Catalog, R&D, Workspace, Promotions, Content, SEO, Sales, Support, Operations, Settings) with route map, permission matrix, and phase table.
- **Planned data models** in DATABASE_SCHEMA_PLAN §12: HomepageConfig, HomepageSection (JSON), HomepageRevision, Promotion, PromotionPlacement, Coupon, WorkspacePlan, Booking (with separate `bookingStatus` and `paymentStatus` enums), AvailabilityRule, BlackoutPeriod, StockMovement, RdProject, RdUpdate.
- **FEATURE_ROADMAP Phase 2**: extended scope section added.
- **Decisions D-056–D-061**: shared catalog, structured CMS, promotions engine, booking status separation, permission strategy, I-019 blocker.
- **Issues I-019** severity elevated to CRITICAL (blocks all schema changes). **I-025** (permission wildcard). **I-026** (schema-change blocker). 

---

### 2026-07-10 (Step 2.4.2 — Admin products list)

#### Pre-step DataTable hardening
- **`components/admin/data-table.tsx`**: (A) `handleKeyDown` fix — `if (e.target !== e.currentTarget) return;` prevents nested button/link Enter from activating the row. (B) Pagination count — added `rowCount: number` to `PaginationProps`; display is "Showing X records" (no total) or "Showing X of Y records" (when `itemCount` provided); hidden while loading. Pass `rowCount={rows.length}` from DataTable.
- **`components/admin/admin-nav.tsx`**: Products leaf enabled — removed `soon: true`, permission corrected from `'product.read'` to `'products.read'` (matches seed). Categories remains disabled (Step 2.4.7).

#### Code (Admin Products — Step 2.4.2)
- **`server/admin/products/list-products.ts`** (new, 208L, server-only): `requirePermission('products.read')` before any DB access. Allowlisted sort keys (name/sku/status/stock/updatedAt → forward+backward `Prisma.ProductOrderByWithRelationInput` pairs). Keyset cursor pagination: forward (cursor + skip:1 + take:n+1) and backward (reversed sort + cursor + skip:1 + take:n+1, then reverse results); P2001 stale-cursor → falls back to first page. Search via `contains/mode:'insensitive'` on name/sku/slug — NOT searchVector (I-019 open). `deletedAt: null` for soft-delete. `priceMinor: BigInt` → string in DTO. `heroImage.cdnUrl/altText` included. Returns `{ items, pagination, categories }`.
- **`app/(admin)/admin/products/page.tsx`** (new, 96L): `export const dynamic = 'force-dynamic'`. Parses and validates URL searchParams (sort/status/categoryId/q/cursor/cursorDirection/pageSize — all allowlisted). Calls `listProducts`, catches `AuthenticationError`/`AuthorizationError` (redirect) and all other errors (error state). Passes serialized DTOs to `ProductsTable`.
- **`components/admin/products/products-table.tsx`** (new, 235L, client): `useTransition` + `router.push` for smooth navigation. 7 columns: Product (thumbnail + name + slug), SKU (monospace), Category, Status (AdminStatusChip: DRAFT=neutral, PUBLISHED=success, ARCHIVED=inactive), Stock, Price (formatted BigInt, BDT ৳/USD $), Updated (absolute date). Toolbar: search (keydown Enter / onChange clear), status filter, category filter, clear-filters button. URL-backed navigation; resetCursor on search/filter/sort change; cursor/cursorDirection preserved on pagination. Read-only — no mutations, no onRowActivate.

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅. `/admin/products` ƒ dynamic. No Prisma/schema/migration/auth/public-nav changed. **Not browser-verified**. Local DB has 6 seeded products (all DRAFT) but no active session to perform runtime pagination tests.

---

### 2026-07-10 (Step 2.4.1 — Shared admin data-table foundation)

#### Code (Admin Data Table — Step 2.4.1)
- **`app/globals.css`**: Added `--adm-cell-px` (16/12px), `--adm-cell-py` (10/6px), `--adm-thead-py` (8/4px) to comfortable/compact density blocks. Added `.adm-td { padding: var(...) }` and `.adm-th { padding: var(...) }` CSS classes (unlayered, override Tailwind utilities).
- **`components/admin/data-table-types.ts`** (new, 151 lines): All exported TypeScript types. `DataTableSort`, `DataTableColumn<T>` (sortKey, align, width, hideBelow, cell renderer), `DataTableCursorPagination` (opaque cursors, hasNextPage/hasPreviousPage, optional itemCount/pageSize), `DataTableEmptyState`, `DataTableErrorState`, `DataTableProps<T>` (fully controlled: columns, rows, getRowId, sort, onSortChange, pagination callbacks, loading, skeletonRowCount, error, emptyState, toolbar, caption, onRowActivate, rowActions).
- **`components/admin/data-table-states.tsx`** (new, 104 lines): `SortIcon` (ArrowUp/Down/ChevronsUpDown), `SkeletonRows` (animate-pulse bars with varying widths), `EmptyRow` (Inbox icon, parent-overridable title/description/action), `ErrorRow` (AlertCircle, optional retry button with danger styling).
- **`components/admin/data-table.tsx`** (new, 289 lines): `DataRow<T>` (optional `onRowActivate`, `rowActions`, Enter key, click-bubble prevention on interactive children), `DataTablePagination` (Previous/Next with disabled state, optional item count), `DataTable<T>` (main export; assembles toolbar, scroll container, thead with sort buttons + aria-sort, tbody routing loading/error/empty/rows, sr-only loading status, pagination). Re-exports all types from `data-table-types.ts`. No external grid library.

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅ (exit 0). `/admin` ƒ dynamic. No feature pages, no fake business data. No Prisma/auth/public-nav changed. File sizes: types 151L, states 104L, main 289L — all under 300. **Not browser-verified**.

---

### 2026-07-10 (Step 2.3.4 — Admin notifications panel foundation)

#### Minor pre-step correction
- **`components/admin/admin-density-toggle.tsx`**: density button label changed from `"Comfy"` → `"Comfortable"`. Stored values (`comfortable` / `compact`) and storage key (`ariot-admin-density`) unchanged.

#### Code (Admin Notifications — Step 2.3.4)
- **`components/admin/admin-notifications-panel.tsx`** (new): Complete notifications UI foundation.
  - **Model**: `AdminNotificationSeverity` (`'info' | 'success' | 'warning' | 'danger'`); `AdminNotification` interface (id, title, description?, createdAt, read, severity?, href?). No Prisma dependency; no backend code.
  - **`formatDate`**: deterministic absolute date formatter (`Intl.DateTimeFormat('en-US')`; no relative time to avoid hydration mismatch; invalid dates return `'—'`).
  - **`NotificationItem`**: severity dot + sr-only label (colour not sole indicator); read/unread styling; `href` items render as Next.js `Link`; date shown in mono text.
  - **`EmptyState`**: "You're all caught up" with honest description naming which modules will generate notifications once connected. Bell icon in a muted circle. No fake item, no fake timestamp.
  - **`AdminNotificationsPanel`**: `absolute top-full right-0 w-[360px] max-w-[calc(100vw-2rem)]`; `role="region" aria-label="Notifications"`; header with unread count; scrollable content area (`max-h-[400px]`); click-outside closes via `mousedown` listener; Escape handled by parent shell's global handler.
- **`components/admin/admin-shell.tsx`** (targeted edits): Added import; `EMPTY_NOTIFICATIONS = []` + `NOTIF_UNREAD = 0` module-level constants; notification trigger gets `aria-haspopup="true"`, `aria-label="Open notifications"`, `aria-expanded`; unread badge (hidden when count=0, format 9+/99+); inline old popover replaced with `<AdminNotificationsPanel>`. Shell: 296 lines.

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅ (exit 0). `/admin` ƒ dynamic. No fake notifications rendered. No backend/DB/Prisma/auth/public-nav changed. **Not browser-verified**.

---

### 2026-07-10 (Step 2.3.3 — Admin theme, density, and semantic status system)

#### Code (Admin Theme & Density — Step 2.3.3)
- **`app/globals.css`**: Added `.theme-admin` scope (re-declares dark surface tokens for self-containment; density CSS vars `--adm-row-py`, `--adm-leaf-py`, `--adm-gutter`, `--adm-content-py`; `.theme-admin[data-density="compact"]` overrides for ~32px rows/12px gutter; mobile tap-target exception at `< 1023px` restores comfortable padding). Density-sensitive class rules: `.adm-nav-link`, `.adm-nav-group-btn`, `.adm-nav-leaf` (unlayered CSS > `@layer utilities`, overrides Tailwind `py-*` for nav items).
- **`components/admin/admin-shell-ui.tsx`** (new): Extracted `Popover`, `EnvironmentChip`, `initials` from admin-shell to keep shell under 300 lines. `'use client'` — Popover uses `useEffect`/ref for outside-click.
- **`components/admin/admin-status-chip.tsx`** (new): Dark semantic status primitive. Variants: neutral/info/success/warning/danger/pending/inactive. Optional `dot` boolean; `size: 'default' | 'sm'`. Status communicated in text label (not colour alone). Explicitly admin-only — distinct from the public `Badge` component.
- **`components/admin/admin-density-toggle.tsx`** (new): Two-button segmented control (`Comfy` / `Compact`). `aria-pressed` on each button. Pure controlled UI — parent owns state and persistence.
- **`components/admin/admin-shell.tsx`** (rewrite): Imports `AdminDensityToggle`, `AdminShellUI` utilities. Root div gets `theme-admin` class + `data-density={density}`. Density state: `useState<Density>('comfortable')`; `useEffect` reads `localStorage['ariot-admin-density']` (validated; errors silently ignored; hydration-safe). `handleDensityChange` updates state + localStorage. `AdminDensityToggle` rendered in profile popover between role chips and sign-out. Main content padding driven by `--adm-content-py` via inline `style`. Shell: 286 lines (under 300).
- **`components/admin/admin-nav-rail.tsx`** (targeted edits): Added `adm-nav-link` to Overview link, `adm-nav-group-btn` to group buttons, `adm-nav-leaf` to all leaf items (both disabled spans and enabled links).
- **`app/(admin)/admin/page.tsx`** (updated): Uses `AdminStatusChip` for module "Coming soon" chips (variant=neutral, size=sm) and access-verified section header (variant=success, dot). 

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅ (exit 0). `/admin` ƒ dynamic, RBAC guard intact. No Prisma/auth/public-nav changed. File sizes: admin-shell.tsx 286L, admin-shell-ui.tsx 75L, admin-status-chip.tsx 87L, admin-density-toggle.tsx 59L. **Not browser-verified**.

---

### 2026-07-10 (Step 2.3.2 — Admin navigation structure)

#### Code (Admin Navigation — Step 2.3.2)
- **`components/admin/admin-nav.tsx`** (rewrite): Full typed grouped config. `AdminNavEntry` union: `kind:'link'` for the standalone Overview link, `kind:'group'` for 6 collapsible groups (Catalog, Sales, Support, Content, Operations, Settings). `AdminNavLeaf` carries `label`, optional `href` (present even on `soon` items for breadcrumb lookup), `permission` (informational, not a security boundary), and `soon` flag. Exported helpers: `isLeafActive(pathname, href, soon)` — exact for `/admin`, prefix for others, always false for `soon` items; `breadcrumbForPath(pathname)` — traverses grouped structure, capitalises-and-de-hyphenates unknown segments.
- **`components/admin/admin-nav-rail.tsx`** (new client component): Renders the grouped nav inside the sidebar. Group expand/collapse state (all default-open, in-session, `Record<string,boolean>`). Single link (Overview) at top with a separator below. Collapsible groups: toggle button with ChevronDown, `aria-expanded`, group brightens when a child is active. Leaf items: disabled `<span aria-disabled>` with "Soon" badge (not colour-only) for `soon` items; `<Link aria-current="page">` with `bg-cyan-faint text-cyan-300` active state for enabled items. `onNavigate` callback closes the mobile admin drawer on selection.
- **`components/admin/admin-shell.tsx`** (targeted edits): Import updated (`adminNav` removed, `AdminNavRail` added). `<aside>` gets `flex flex-col` for proper height layout. Old flat `<nav>` block (42 lines) replaced with `<AdminNavRail pathname={pathname} onNavigate={() => setNavOpen(false)} />`. Shell: 333 → 297 lines (under the 300-line limit). No auth/RBAC/profile/topbar/sign-out/popover logic changed.

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅ (exit 0). `/admin` present as `ƒ` (dynamic, RBAC guard intact). No soon item links to a missing route. No Prisma/migration/seed/auth/public-nav files changed. File sizes: admin-nav.tsx 192L, admin-nav-rail.tsx 189L, admin-shell.tsx 297L — all under 300. **Not browser-verified** (no in-environment browser tool).

---

### 2026-07-10 (Phase 1 visual redesign — browser verification close)

#### Manual browser inspection
Corrective steps 1.0.1–1.0.5 verified by project team in a real browser at **390×844** and **360×800**.

Confirmed at both sizes:
- Mobile drawer opens from the right at approximately 88vw (317px at 360px, 343px at 390px)
- No large black panel remains
- All navigation links (Home, R&D, Workspace, Components, Solutions, About, Blog, Support) visible and tappable
- "Request a quote" and "Contact ARIOT" CTA buttons fully visible inside the drawer
- X button, backdrop tap, Escape key, and navigation-link selection all close the drawer
- Body scroll locked while drawer is open
- Pages verified: Homepage, R&D, Workspace, Components, Products, Solutions, About, Contact, Sign-In
- Admin console remains dark and functional

**Phase 1 visual redesign marked ✅ complete.** I-024 resolved.

---

### 2026-07-10 (Mobile drawer portal fix, glassmorphism system, full page polish — corrective step 1.0.5)

#### Root cause confirmed
The sticky `SiteHeader` uses `backdrop-filter: blur(12px)` (`backdrop-blur-md`). In WebKit/Safari (and some Chromium configurations), `backdrop-filter` on an ancestor creates a new containing block for `position:fixed` descendants, confining the fixed drawer to the header element's bounds (~60–72px tall × viewport width) rather than the viewport. This produced the rendered symptom of a ~150px-wide narrow light strip + large black panel covering the rest of the screen. Replacing `position:fixed` with a `createPortal(…, document.body)` approach removes all parent constraint.

#### Code (Drawer — Step 1.0.5)
- **`components/layout/mobile-drawer.tsx`** (rewrite): `createPortal` to `document.body`. Portal root = `fixed inset-0 z-[200]`. Veil = `absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]`. Panel = `absolute inset-y-0 right-0 w-[88vw] max-w-[360px] h-dvh`. `theme-light` applied directly to panel; inherits light tokens even outside any marketing wrapper. CSS `drawer-slide-in` animation. All a11y preserved (focus trap, Escape, scroll lock, focus-return, reduced-motion via global block).

#### Code (Visual System — Step 1.0.5)
- **`app/globals.css`**: Added `.glass-panel` (`rgba(255,255,255,0.82)`, `blur(16px)`), `.glass-panel-strong` (`rgba(255,255,255,0.92)`, `blur(20px)`), `@keyframes drawer-in-right` + `.drawer-slide-in`.
- **`components/ui/card.tsx`**: Glass variant → uses `.glass-panel-strong` CSS class; interactive variant adds hover lift (`-translate-y-0.5`) and shadow. Steel variant uses `shadow-1` (softer).
- **`components/layout/more-menu.tsx`**: Dropdown updated to `glass-panel` with appropriate text contrast.

#### Code (Page Polish — Step 1.0.5)
- **`app/(marketing)/page.tsx`**: Hero 3D wrapper → relative `rounded-2xl` container; glass status overlay at bottom ("Active R&D · Prototype stage").
- **`app/(marketing)/products/page.tsx`**: All brackets removed; filter labels improved; custom-build CTA de-bracketed.
- **`app/(marketing)/contact/page.tsx`**: Brackets removed; fake email/phone removed; map placeholder replaced with honest BD locator card.
- **`app/(marketing)/quote/page.tsx`**: Brackets removed; next-steps panel de-bracketed; glass card updated.
- **`app/(marketing)/blog/page.tsx`**: Brackets removed; categories de-bracketed; lab feature section updated.
- **`app/(marketing)/support/page.tsx`**: Brackets removed; categories/FAQs/downloads honest copy; search helper updated.
- **`app/(marketing)/research/page.tsx`**: Hero grid layout with glass status panel (R&D status breakdown).
- **`app/(marketing)/workspace/page.tsx`**: Hero grid layout with glass rental-period summary panel.
- **`app/(auth)/sign-in/sign-in-form.tsx`**: Card → `glass` variant; improved ARIOT brand header; Google button → `secondary` variant.
- **`app/(auth)/sign-in/page.tsx`**: Background → `bg-bg-raised` with blueprint grid overlay; return-link ring-offset updated.

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅ (exit 0). All 20+ public routes present. No auth/RBAC/DB/admin code changed. **Screenshots not captured** — no headless browser in environment. Portal approach verified as definitive fix for WebKit fixed-position containing-block bug.

---

### 2026-07-10 (Public IA, mobile nav, and new pages — corrective step 1.0.4)

#### Code (Navigation, Pages, Content)
- **`components/layout/site-header.tsx`** — New `NAV_ITEMS`: Home(`/`), R&D(`/research`), Workspace(`/workspace`), Components(`/components`), Solutions(`/solutions`), About(`/about`). Added `MOBILE_NAV_ITEMS` (same + Blog + Support). Imports `MoreMenu`. Desktop right-side: Contact + Request a quote buttons.
- **`components/layout/more-menu.tsx`** (new) — Client dropdown for secondary nav (Blog `/blog`, Support `/support`). Closes on route change, outside click, and Escape. Active state detection.
- **`components/layout/mobile-drawer.tsx`** — Width hardened to `w-[88vw] max-w-[360px]`. Blog + Support included in mobile nav.
- **`components/layout/site-footer.tsx`** — Reorganised columns: Company, R&D, Workspace, Components, Solutions, Resources. Dead links removed (`/innovation-lab`, `/about/press`, `/careers`, `/support/ticket`). Placeholder email/phone display removed; contact handled via Request a quote + Contact buttons. Tagline de-bracketed. Copyright updated to "ARIOT Technologies."
- **`app/(marketing)/research/page.tsx`** (new) — R&D page: 6 research areas with status badges, validation approach, honest copy; no fake commercial claims.
- **`app/(marketing)/workspace/page.tsx`** (new) — Workspace page: "Planned Initiative" badge, who-it-is-for grid, planned facilities, rental periods (pricing TBA), intended use, interest-registration CTA.
- **`app/(marketing)/components/page.tsx`** (new) — Components page: "Store in Development" badge, 9 category cards, manual order-request flow (3 steps), no cart/checkout/payments.
- **`app/(marketing)/_home-content.ts`** — Rewritten: brackets removed; `BUSINESS_AREAS`, `COMPONENT_TEASERS` added; `METRICS` now uses honest status labels instead of invented numbers.
- **`app/(marketing)/page.tsx`** — Rewritten homepage: 10 sections in recommended order (hero, capability strip, business areas, R&D, workspace, components, products, solutions, status metrics, blog, CTA). Hero headline updated to approved "Building the Robotics Ecosystem of Bangladesh." Eyebrow badge de-bracketed. Scroll cue de-bracketed.
- **`app/(marketing)/about/page.tsx`** — De-bracketed throughout: eyebrow, subhead, mission statement, story timeline (no fake years/milestones/deployments), focus areas, team section replaced with honest note, partner placeholders and press section made transparent.
- **`app/(marketing)/solutions/page.tsx`** — De-bracketed throughout: eyebrow, hero subhead, industry cards, approach stack, engagement timeline, case study placeholder text updated to honest statement.

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅. Routes `/research`, `/workspace`, `/components` all present as `○` (static). No auth/RBAC/DB/admin code changed. `MoreMenu` lint fixed (same pattern as admin-shell: eslint-disable inline comment for `react-hooks/set-state-in-effect`). NOT browser-verified. I-019 open.

---

### 2026-07-10 (Phase 1 Visual Redesign & Premium Light-Theme Correction)

#### Code (Visual System — corrective)
- **`app/globals.css`** — Added a `.theme-light` scope that re-binds every token CSS variable to a light palette (white/`#F7F9FC` surfaces, navy `#0F172A` primary text, slate `#475569` secondary, `#E2E8F0` borders, blue `#2563EB` accent, restrained semantic colors, soft shadows, light glass gradient). Because all components use token utilities, the public site re-skins with zero per-component edits.
- **`app/(marketing)/layout.tsx`** — Wrapped the chrome in `<div className="theme-light ...">` so the entire public site renders light while the admin route group (no `.theme-light`) keeps the original dark tokens.
- **`app/(auth)/sign-in/page.tsx`** — Tagged the sign-in `main` with `theme-light` so the auth page matches the public light language.
- **`lib/design-tokens.ts`** — Updated the TS mirror (`colors`, `shadows`) to the light values, per its own sync rule.
- **`components/ui/card.tsx`** — `glass` variant border `white/[0.06]` → `steel-700` (was invisible on light).
- **`components/three/hero-scene.tsx`** — Robot/dom materials recolored to slate/blue on a pale `#EEF2F7` dome; sensor-ring emissive intensity lowered (no neon).
- **`public/media/home/home-hero-cinematic-arm-01-21x9.svg`** + **`...-9x16.svg`** — Recolored hero artwork to the light blueprint palette.

#### Scope / safety
- NO changes to Better Auth, Google OAuth, RBAC, admin bootstrap, Prisma schema/migrations, seed, API/email/rate-limit logic, admin routes, ecommerce, support, or IoT. The admin console remains on the dark tokens (separate route group, untouched).
- `colorScheme` meta intentionally left `'dark'` to avoid altering the dark admin console rendering.

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅. Compiled CSS confirms `.theme-light` overrides present and utilities reference runtime `var(--bg-base)` etc., so scoping cascades.
- **Not browser-verified** in this environment (no headless browser available); visual claims are based on code/CSS inspection, not rendered screenshots.

---

### 2026-07-10 (Step 2.3.1 — Admin layout shell)

#### Code (Admin Shell — Step 2.3.1)
- **`app/(admin)/layout.tsx`** (new): server-side security boundary for all admin routes. `getAuthorizationContext()` → `redirect('/sign-in')` when no valid session; `redirect('/')` when authenticated but lacking any admin role (SUPER_ADMIN/CONTENT_ADMIN/SUPPORT_ADMIN/SALES_ADMIN). Admin display name resolved from DB. No middleware added — smallest server-side guard per plan §2.2.
- **`components/admin/admin-shell.tsx`** (new, client): top bar (logo, breadcrumb derived from `usePathname`, disabled search placeholder, notifications empty-state popover, profile menu with role chips + sign-out) and left rail (sticky on desktop, drawer on mobile with overlay + Escape close). Tokens only; drawer animates `transform` only; respects `prefers-reduced-motion`.
- **`components/admin/admin-nav.tsx`** (new): single source of truth for the rail — sections Overview/Catalog/Sales/Support/Content/Operations/Settings. Only Overview has a real `/admin` route; the rest render as honest disabled "Soon" items. Step 2.3.2 adds leaf links by setting `href`s here.
- **`app/(admin)/actions.ts`** (new): server action `adminSignOut` — `auth.api.signOut` then `redirect('/sign-in')`.
- **`app/(admin)/admin/page.tsx`** (new): Overview placeholder with real copy (access-verified banner, module cards, getting-started steps referencing `GOOGLE_CLIENT_ID`/`admin:bootstrap`).

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅ (route `/admin` present, dynamic). Prisma validated/generated unchanged.
- **Not runtime-tested with a live session** — no Google OAuth credentials and no bootstrapped admin in the local DB. Gate logic is straightforward redirects; full sign-in → admin flow requires env credentials + `pnpm admin:bootstrap --apply` (prerequisite carried from 2.2.5).
- Pre-existing build-time `BetterAuthError` ("default secret") appears during `/sign-in` prerender when `BETTER_AUTH_SECRET` is unset in the build env — not introduced by this step.

---

### 2026-07-10 (Step 2.2.5 — Secure admin bootstrap)

#### Code (Scripts — Step 2.2.5)
- **Bootstrap CLI** — `scripts/bootstrap-admin.ts` (new): offline, operator-run, never invoked by app startup/build/migration. Dry-run by default; writes require `--apply`; non-local DB requires `--apply --production`. Loads `.env` inline (no dotenv dep). Zod-validates `BOOTSTRAP_ADMIN_EMAIL` (preprocess: trim + lowercase), `BOOTSTRAP_ADMIN_CONFIRM` (literal `GRANT_SUPER_ADMIN`), `BOOTSTRAP_ADMIN_NAME` (optional, default `"ARIOT Administrator"`). Preflight: DB connect, SUPER_ADMIN role must exist (seed prerequisite), user must not be suspended/deleted. Write (transaction): creates User with `emailVerified=true`/no `passwordHash` or Account/Session, or reuses ACTIVE user; idempotent `UserRole` assign; system `AuditLog` row (`actorId=null`, `action=ADMIN_BOOTSTRAPPED`). Production guard: exits if DATABASE_URL is non-local without `--production`. Email masked in all output. Local verification passed (dry-run, apply, idempotency, cleanup).
- **`server/auth.ts` account security (Steps 2.2.5 TASK 8 & 9)** — `account.accountLinking`: `enabled: true`, `disableImplicitLinking: false` (Google auto-links on matching-email sign-in), `allowDifferentEmails: false`, `updateUserInfoOnLink: false`. `account.encryptOAuthTokens: true` (AES-256-GCM, uses `BETTER_AUTH_SECRET`, no new key). These settings ensure the pre-provisioned User can be linked by Google and that tokens are protected at rest.

#### Config / Dependencies
- **`package.json`** — Added `admin:bootstrap` script: `node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/bootstrap-admin.ts`.
- **`.env.example`** — Added bootstrap env var block (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_CONFIRM`). No real values.
- **`@types/pg` devDep added** — `pg@8.22.0` ships no built-in types; `@types/pg@8.20.0` added to devDependencies so `scripts/bootstrap-admin.ts` typechecks correctly.

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅ · `npx prisma validate` ✅ · `npx prisma generate` ✅ · `git diff --check` ✅.
- **Local bootstrap verification:** dry-run→no rows; apply→User(ACTIVE, emailVerified=true, no passwordHash, no Account, no Session) + UserRole(SUPER_ADMIN) + AuditLog all created and correct; re-apply→no-op for User/UserRole; production guard→exit 1 without `--production`; cleanup→DB fully restored.
- **LIVE GOOGLE OAUTH NOT TESTED** — no credentials available. No admin user in repo or docs.

---

### 2026-07-10 (Step 2.2.4 — Server-side RBAC guardrails)

#### Code (Auth — Step 2.2.4)
- **Typed authorization errors** — `server/auth/errors.ts` (new): `AuthzError` base, `AuthenticationError` (code `AUTHENTICATION_REQUIRED`, HTTP 401), `AuthorizationError` (code `AUTHORIZATION_DENIED`, HTTP 403). No `NextResponse`, no sensitive details, distinguishable by `instanceof`/`code`/`httpStatus`.
- **Authorization context + helpers** — `server/auth/permissions.ts` (new): `AuthorizationContext` interface (`userId`, `email`, `roles: RoleKey[]`, `permissions: string[]`). `getAuthorizationContext()` — returns null for anon/inactive/deleted users; enforces `User.status === ACTIVE` and `deletedAt === null`. `requireAuthenticatedUser()` — throws 401. `requireRole(roles, headers?)` — **ANY** semantics (one matching role is sufficient), throws 403. `requirePermission(perms, headers?)` — **ALL** semantics (all listed perms required), throws 403, empty list fails closed. `requireAnyPermission(perms, headers?)` — **ANY** semantics, throws 403. Single focused Prisma query (no N+1): `User.findUnique` with `userRoles → role { key, permissions }`. Roles and permissions are deduplicated. All server-only by convention.
- **`"*"` wildcard discovery** — runtime smoke test against local DB revealed the seed assigns `permissions: ["*"]` to `SUPER_ADMIN`. This is handled explicitly: if `ctx.permissions.includes("*")` all per-key permission checks pass. Documented in code and decisions log (see D-036).
- **`getSession()` updated** — `server/auth.ts`: now accepts an optional `Headers` parameter (backward-compatible). Route handlers may pass request headers directly; server components continue to call it without arguments.

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅ · `npx prisma validate` ✅ · `npx prisma generate` ✅ · `git diff --check` ✅ (pre-existing CRLF warnings only).
- **Runtime DB smoke (read-only, local dev DB):** Role.count()=4, UserRole.count()=1, Role.permissions JSON readable as array. resolveContext() returns SUPER_ADMIN context for the seeded user (ACTIVE, deletedAt=null). Unknown role → not in context (fail-closed). Unknown permission → not in context (fail-closed). Missing userId → `null` (unauthenticated branch verified against real data).
- **No admin routes, no middleware, no admin bootstrap, no schema/migration change.**

---

### 2026-07-10 (Step 2.2.3 — Google OAuth provider + sign-in UI shell)

#### Code (Auth — Step 2.2.3)
- **Google OAuth provider** — `server/auth.ts`: configured Better Auth `socialProviders.google`, enabled ONLY when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present. `disableSignUp: true` (unknown Google users cannot create ARIOT accounts), identity-only scopes `openid`/`email`/`profile` (no Drive/Calendar/Gmail/contacts, no One Tap). Public signup remains disabled.
- **Origin/trust posture hardened** — Removed `trustHost`. Added explicit `baseURL` (prefers `BETTER_AUTH_URL`, falls back to `NEXT_PUBLIC_SITE_URL`) and `trustedOrigins` (derived from those URLs, no `*`/protocol-agnostic wildcards). Production without `BETTER_AUTH_URL`/`BETTER_AUTH_SECRET` fails closed (Better Auth requires an explicit secret in production).
- **Typed env for Google** — `server/env.ts`: added `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (optional, parsed through the existing Zod system, both-or-neither config error, no secrets logged). Added both-or-neither validation after parse.
- **Better Auth client** — `lib/auth-client.ts` (new): single shared `createAuthClient()` instance; no secrets, no server-only imports; re-exports `signIn`/`signUp`/`useSession`.
- **Sign-in UI shell** — `app/(auth)/sign-in/page.tsx` (server, `noindex`) + `app/(auth)/sign-in/sign-in-form.tsx` (client): "Admin sign in" heading, internal-access explanation, "Continue with Google" button, loading/error/provider-unavailable states, safe `?error=` → user-safe message mapping (no stack traces/secrets), return-to-public-site link. Google action uses `authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/sign-in?error=oauth' })`. No email/password, sign-up, or forgot-password UI.
- **Session-read helper** — `server/auth.ts`: `getSession()` (server-only, returns session or `null`; authentication only — no roles/permissions, no RBAC inference).

#### Config
- `.env.example` — Replaced generic OAuth placeholders with Google-only `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (empty), with commented local/production callback URLs (`/api/auth/callback/google`). No real values.

#### Verification
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅ (new dynamic route `/sign-in`) · `npx prisma validate` ✅ · `npx prisma generate` ✅ · `git diff --check` ✅ (pre-existing CRLF warnings only).
- **Runtime (local built app, no Google creds):** `GET /sign-in` → HTTP 200 with provider-unavailable state; `GET /api/auth/get-session` → HTTP 200 / `null` (auth server initializes; unauthenticated session read returns null). With `BETTER_AUTH_SECRET` set, handler is 200/`null`; without it (production mode) Better Auth correctly refuses to start (fail-closed).
- **LIVE GOOGLE OAUTH NOT TESTED** — no Google credentials available in this environment. Callback URL (`/api/auth/callback/google`), redirect generation, and the `disableSignUp` enforcement were verified by configuration, not by a live OAuth round-trip. No admin user created.

#### Notes
- No Prisma schema or migration change (Step 2.2.3 is schema-free per the strict DB rule). I-019 remains open.
- RBAC, middleware/proxy, admin routes, custom password auth, public registration, and admin bootstrap are explicitly NOT implemented in this step (deferred to 2.2.4 / 2.2.5).

---

### 2026-07-10 (Step 2.2.2 — migration + runtime verification finish)

#### Code (Env fix)
- **`server/env.ts` parse fix** — `serverSchema.safeParse(...)` previously omitted `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, so `auth.ts` always received `undefined` for them despite both being defined in the schema. The parse call now passes both values through. No behavior change when the vars are absent (still optional).

#### Infrastructure (Migration)
- **Better Auth migration generated + applied (LOCAL DEV DB ONLY)** — `prisma/migrations/20260710081202_auth_better_auth_foundation/migration.sql`: adds `User.emailVerified BOOLEAN NOT NULL DEFAULT false`, adds `Session.updatedAt TIMESTAMP(3) NOT NULL` (safe — `Session` empty, no live auth users), creates `Account` + `Verification` tables with Better Auth field shapes, FKs (`Account.userId → User` CASCADE) and indexes. **Removed** two spurious `ALTER TABLE ... ALTER COLUMN "searchVector" DROP DEFAULT` statements that Prisma emitted for the `GENERATED ALWAYS AS (...) STORED` columns — those statements are invalid on generated columns (`ERROR 42601`) and unrelated to auth; documented inline in the SQL. No business tables dropped or altered beyond the four auth-affected columns/tables. A pre-existing ghost migration record (`20260710053809_auth_better_auth`, folder deleted from disk) was removed from `_prisma_migrations` on the local dev DB before applying.
- **Prisma state** — `prisma validate` ✅, `prisma generate` ✅. `migrate deploy` applied both migrations to `localhost:5432/ariot`.

#### Runtime DB Smoke Test (LOCAL DEV DB — PASSED)
- Prisma client connects ✅; Better Auth initializes with the project field mappings ✅; `User` (1 existing row, `emailVerified` defaulted `false`), `Session` (0), `Account` (0), `Verification` (0) all queryable ✅; `auth.api.getSession()` returns `null` cleanly (exercises `Session` via `token→tokenHash` mapping) ✅; `toNextJsHandler` from `better-auth/next-js` builds ✅. No unknown-model/field errors. No production user created; no OAuth tested.

#### Docs
- **Known issues** — `docs/08_KNOWN_ISSUES.md`: I-018 resolved for Step 2.2.2 (auth migration applies + verified); new I-019 opened for the residual `searchVector` generated-column drift that will affect FUTURE `migrate dev`/`db push`.
- **Progress log / AI context / master plan / baseline / DB plan / decisions** — updated to reflect: schema validated, migration generated, migration APPLIED (local only), runtime DB VERIFIED (local only).

#### Verification Status (Step 2.2.2)
- `npx tsc --noEmit` ✅ · `npx eslint . --max-warnings 0` ✅ · `npx next build` ✅ · `npx prisma validate` ✅ · `npx prisma generate` ✅ · `git diff --check` ✅ (only pre-existing CRLF normalization warnings).
- **MIGRATION APPLIED: YES (local dev DB `ariot` only — NOT production).**
- **RUNTIME DATABASE VERIFICATION: YES (local dev DB only — NOT production).**

---

### 2026-07-10

#### Code (Auth — Step 2.2.2 corrective)

- **Replaced Auth.js with Better Auth** — Removed `next-auth@5.0.0-beta.31` and `@auth/prisma-adapter@2.11.2`; installed `better-auth@1.6.23`. Deleted root `auth.ts` and `app/api/auth/[...nextauth]/route.ts`; removed `AUTH_SECRET` from `server/env.ts` + `.env.example`. Auth.js base was incompatible with ARIOT's custom field names and was superseded before any real auth data existed (see docs/07_DECISIONS.md D-035).
- **Better Auth base config** — `server/auth.ts` (new): `betterAuth()` with `prismaAdapter` on the existing `server/db.ts` singleton, `provider: 'postgresql'`, `trustHost: true`, `secret`/`baseURL` from typed `server/env.ts`. Custom model/field mapping: `user.modelName: 'User'`, `user.fields.image → 'avatarUrl'`, `session.modelName: 'Session'`, `session.fields.token → 'tokenHash'`, `session.fields.ipAddress → 'ip'`, `account.modelName: 'Account'`, `verification.modelName: 'Verification'`. No UI/RBAC/middleware/providers; decision D-035 details the rationale and mapping.
- **Better Auth API route** — `app/api/auth/[...all]/route.ts` (new): `toNextJsHandler(auth)` GET/POST.
- **Env wiring** — `server/env.ts`, `.env.example`: `BETTER_AUTH_SECRET` (optional), `BETTER_AUTH_URL` (optional), placeholder OAuth client var names. No real secrets.

#### Infrastructure (Schema — additive compatibility correction, replaces Auth.js models)

- **Better Auth adapter models** — `prisma/schema.prisma`: Added `emailVerified Boolean @default(false)` to `User`; added `updatedAt` to `Session`. Replaced Auth.js `Account` with Better Auth shape (`accountId`, `providerId`, `accessToken`, `refreshToken`, `idToken`, `*ExpiresAt`, `scope`, `password`). Replaced `VerificationToken` with Better Auth `Verification` (`identifier`, `value`, `expiresAt`). Preserved existing `User`/`Session` business fields (`emailVerifiedAt`, `avatarUrl`, `tokenHash`, `ip`, etc.). `prisma generate` regenerated the client successfully.

#### Docs
- **Decisions** — `docs/07_DECISIONS.md`: D-034 marked Superseded; D-035 added (Better Auth replaces Auth.js). D-014 updated.
- **Progress log** — `docs/06_PROGRESS_LOG.md`: 2.2.2 rewritten to reflect Better Auth replacement; I-017 resolved context preserved.
- **Known issues** — `docs/08_KNOWN_ISSUES.md`: I-017 closed (resolved by D-035); I-018 opened (pre-existing generated-column `BlogPost.searchVector` / `Product.searchVector` migration drift blocks ALL `db push` / `migrate dev`, including unrelated additive auth changes).
- **AI Context** — `docs/10_AI_AGENT_CONTEXT.md`: Auth provider updated to Better Auth; next step 2.2.3.

#### Verification

- `npx tsc --noEmit` ✅ PASS. `npx eslint . --max-warnings 0` ✅ PASS. `npx next build` ✅ PASS. `npx prisma validate` ✅ PASS. `npx prisma generate` ✅ PASS.
- **Runtime DB verification BLOCKED** by pre-existing generated-column migration drift (I-018). `prisma db push` / `prisma migrate dev` fail with `ERROR 42601: column "searchVector" of relation "BlogPost" is a generated column`. Not caused by auth changes. Auth adapter compile/build verified, but runtime read against the local Postgres could not be executed. Do not describe this step as fully runtime-verified.
- Login/OAuth/RBAC NOT tested (not implemented in this step).

---

## 2026-07-02 (Steps 1.4–1.9 implementation)

### Code

- **Steps 1.4.1–1.4.11 confirmed complete** — `app/(marketing)/page.tsx`, `components/marketing/hero-shell.tsx`, `feature-stack.tsx`, `feature-grid.tsx`, `metric-band.tsx`, `logo-strip.tsx`, `testimonial.tsx`, `cta-band.tsx` — Homepage fully assembled with all 8 sections. Progress log updated.
- **Steps 1.5.2–1.5.4 confirmed complete** — `app/(marketing)/products/page.tsx`, `products/[slug]/page.tsx`, `components/marketing/feature-card.tsx` — Product catalog and detail pages confirmed built. FeatureCard used in lieu of a dedicated product-card.tsx.
- **Step 1.5.5 (Category Page)** — `app/(marketing)/products/category/[slug]/page.tsx` — New. Filtered product grid per category. 6 slugs pre-rendered (robotics, smart-city, smart-building, prosumer, education, custom).
- **Step 1.5.6 (Category Seed Data)** — `app/(marketing)/products/_data.ts` — Added `CATEGORIES` array with 6 full category objects; `getCategoryBySlug` + `getProductsByCategory` helpers.
- **Step 1.6.1 (Solution Seed Data)** — `features/solutions/_data.ts` — New. 6 solution entries (smart-factory, smart-agriculture, smart-city, energy-utilities, education, custom) with stats, approach items, tech stack, related product slugs.
- **Steps 1.6.2 + 1.6.4 confirmed complete** — `app/(marketing)/solutions/page.tsx`, `components/marketing/timeline.tsx` — Progress log updated.
- **Step 1.6.3 (Solution Detail)** — `app/(marketing)/solutions/[slug]/page.tsx` — New. Hero, metrics band, approach feature stack, tech stack chips, case study placeholder, related products, CTA band.
- **Steps 1.7.1, 1.7.2, 1.7.5, 1.7.9 confirmed complete** — About, Blog index, Support hub, Quote pages — Progress log updated.
- **Step 1.7.3 (Blog Post)** — `app/(marketing)/blog/[slug]/page.tsx` — New. Hero, article body with sections, author bio card, related posts grid, CTA band.
- **Step 1.7.4 (Blog Seed Data)** — `features/blog/_data.ts` — New. 3 seed posts: autonomous robots in Bangladesh, IoT agriculture, regional robotics. Body content as [BRACKETED] sections (MDX wiring deferred — see known issues).
- **Step 1.7.6 (Support Article)** — `app/(marketing)/support/article/[slug]/page.tsx` — New. Article body, sidebar with contact CTA, helpful-feedback buttons, related articles. 3 seed articles in `features/support/_data.ts`.
- **Step 1.7.7 (Support Static Pages)** — `app/(marketing)/support/manuals/page.tsx`, `firmware/page.tsx` — New. Manuals list with placeholder download links; firmware releases with status chips.
- **Step 1.8.1 (Legal Layout)** — `app/(marketing)/legal/layout.tsx` — New. Breadcrumb header, legal nav footer strip.
- **Step 1.8.1 (Legal Index)** — `app/(marketing)/legal/page.tsx` — New. Grid linking all 5 legal pages.
- **Step 1.8.2 (Legal Pages)** — `legal/privacy/page.tsx`, `terms/page.tsx`, `cookies/page.tsx`, `warranty/page.tsx`, `shipping/page.tsx` — New. All 5 legal pages with [BRACKETED] placeholder content. `components/marketing/legal-page.tsx` shared prose component.
- **Step 1.8.3 confirmed complete** — `components/layout/site-footer.tsx` — LEGAL_LINKS array already present; legal pages now created so links resolve.
- **Step 1.9.1 (R3F Setup)** — `package.json`, `components/three/r3f-wrapper.tsx` — Installed @react-three/fiber 9.6.1, @react-three/drei 10.7.7, three 0.185.1, @types/three 0.185.0. Lazy-loaded IntersectionObserver-gated wrapper with Suspense skeleton.
- **Step 1.9.2 (Hero 3D Scene)** — `components/three/hero-scene.tsx` — New. Geometric robot placeholder (disc chassis, dome, cyan sensor ring, LiDAR turret). Scroll dolly (first 20%), DPR [1,1.75], 15°/s rotation.
- **Step 1.9.3 (Mobile Fallback)** — `components/three/hero-3d-client.tsx` — New. useReducer viewport detection. < 768px shows Seedance-pending placeholder. Desktop loads R3FWrapper via next/dynamic ssr:false.
- **Homepage updated** — `app/(marketing)/page.tsx` — Hero section now uses 2-column layout with Hero3DClient on the right (hidden on mobile).

### Docs

- **Progress log updated** — `docs/06_PROGRESS_LOG.md` — Steps 1.4.1–1.9.3 marked complete. Phase 1 at ~84% (62 of 74 steps).
- **Master plan updated** — `docs/05_IMPLEMENTATION_MASTER_PLAN.md` — Categories 1.5–1.9 all marked ✅.
- **AI agent context updated** — `docs/10_AI_AGENT_CONTEXT.md` — Current step, completion %, recently modified files, next recommended step.
- **Decisions log updated** — `docs/07_DECISIONS.md` — Decision D-25: FeatureCard used instead of dedicated ProductCard; D-26: Blog/support content as TypeScript sections (MDX deferred); D-27: 3D packages added as planned dependency.

### 2026-07-03

#### Code

- **Step 1.12.6 — Command Palette Placeholder** — `components/layout/command-palette.tsx` — New. Ctrl/Cmd+K command palette shell with modal search input, static navigation suggestions (Products, Solutions, Support, Blog, About, Contact, Request a quote), Motion animation (backdrop + panel), focus trap, body scroll lock, auto-focus on open, and Esc/backdrop to close. Wired into `app/(marketing)/layout.tsx` so available on all marketing pages.
- **Step 1.13.1 — Generate Hero Assets** — `content/ai-prompts/home-hero-cinematic-arm-01.json` — New. Full Seedream/Seedance prompt JSON with still + video specs, presets (Preset A — Cinematic Robotics), negative prompts, output formats, budgets. Seedance variant: 8s seamless loop, H.264 MP4 + AV1 WebM, ≤1.8MB. Mobile variant: 9:16 recomposition.
- **Step 1.13.1 — Hero Placeholder SVGs** — `public/media/home/home-hero-cinematic-arm-01-21x9.svg`, `-9x16.svg`, `-poster-21x9.svg` — New. SVG placeholder assets using ARIOT design language (geometric robot arm, graphite base, cyan rim lighting) at correct aspect ratios and pixel targets. Will be replaced by real Seedream/Seedance assets.
- **Step 1.13.1 — Hero Image Layer** — `components/marketing/hero-shell.tsx` — Added priority-loaded `<Image>` layer behind CSS gradients using the hero still SVG as LCP candidate. Image at 70% opacity blends with existing cyan vignette + grid overlays.
- **Step 1.13.1 — Mobile Fallback Updated** — `components/three/hero-3d-client.tsx` — Mobile fallback (< 768px) now renders the 9:16 poster SVG via `next/image` instead of CSS gradient placeholder with `[SEEDANCE VIDEO PENDING]` text.
- **Step 1.13.2 — Generate Product & Solution Images** — Created full asset infrastructure: 20 SVG placeholder assets across products/ (6 hero), solutions/ (6 scenes + index hero), blog/ (3 covers + build log), about/ (lab hero), home/ (3 engineering pillars), products index. Created 21 prompt JSONs for all asset families with Seedream/Seedance specs. Wired assets into 6 pages: product detail MediaGallery, about hero card, FeatureStack FeatureMedia, blog build-log, solutions case study, solutions detail case study. All pages import `next/image` with proper `fill`, `sizes`, and `alt` text.

- **Step 1.13.3 — Optimize All Images** — `app/(marketing)/products/[slug]/page.tsx` — Added `priority` prop to product detail hero Image (above-fold LCP candidate). Audited all 11 Image components across 8 files: HeroShell (priority ✅), feature-stack, hero-3d-client mobile fallback, about hero card, product detail gallery (2 Images), blog build-log, solutions case study (2 pages). All `sizes` attributes verified correct per layout. All images use `fill` with proper parent positioning and aspect-ratio anchor classes preventing CLS. SVGs are vector-native — AVIF/WebP conversion deferred until real Seedream raster assets are generated. Phase 1 complete: 74/74 steps.

---

### 2026-07-08

#### Code (Security)

- **API rate limiting** — `server/rate-limit.ts` (new) — In-memory fixed-window limiter, default 10 req/min/IP. Applied to `app/api/contact/route.ts`, `app/api/quote/route.ts`, `app/api/newsletter/route.ts`. Returns HTTP 429 with `Retry-After`; no PII/IP logged. Decision D-029; limitation tracked as I-015.

#### Code (Config)

- **DATABASE_URL relaxed** — `server/env.ts` — `DATABASE_URL` is now optional at the base env layer so a Phase 1 static deploy does not fail without a database. Phase 2 DB code must assert it before connecting (I-015 context). No code currently reads `env.DATABASE_URL`.

#### Docs

- **Baseline regenerated** — `docs/IMPLEMENTATION_BASELINE.md` — Stale 2026-07-02 snapshot replaced with real state (Phase 1 100%, Phase 2 11.6%, ~137 files, deps accurate).
- **AI context regenerated** — `docs/10_AI_AGENT_CONTEXT.md` — Motion/3D status, Phase 2 5/43, source count, rate-limit + DATABASE_URL notes corrected.
- **Known issues updated** — `docs/08_KNOWN_ISSUES.md` — I-005 (Motion) and I-012 (DB) closed (I-R14, I-R15); added I-015 (rate-limit scale-out) and I-016 (unverified Phase 1 gates).
- **Decisions log** — `docs/07_DECISIONS.md` — Added D-029 (rate-limiting approach).
- **AGENTS.md §14 index** — Added all 7 tracking docs (06/07/08/09/10, IMPLEMENTATION_BASELINE, PROJECT_FREEZE).
- **Master plan paths** — `docs/05_IMPLEMENTATION_MASTER_PLAN.md` — `app/marketing/...` corrected to `app/(marketing)/...`; `features/product/_data.ts` (solutions) corrected to `features/solutions/_data.ts`.
- **Progress log** — `docs/06_PROGRESS_LOG.md` — 2026-07-08 closeout addendum; verification results recorded.

#### Code

- **Step 2.1.6 — Prisma client singleton** — `server/db.ts` (new) — Module-level `PrismaClient` with `globalThis` guard. Prisma 7 requires a runtime driver adapter, so `@prisma/adapter-pg` (7.8.0) + `pg` (8.22.0) added to `package.json` and wired via `new PrismaPg(process.env.DATABASE_URL ?? '')`. `DATABASE_URL` stays optional at the base env layer (lazy connect). `import 'server-only'` omitted (not installed; file in `server/`). Verification: typecheck/lint/build pass; `prisma validate` + `prisma generate` pass.

#### Verification

- `pnpm typecheck` — PASS (zero errors). `pnpm lint` — PASS (zero warnings). `pnpm build` — PASS (48 routes prerendered). Lighthouse / axe-core / Rich Results / live email NOT executed (no local tooling/keys) — see I-016.

---

### 2026-07-03

#### Infrastructure

- **Step 2.1.1 — Install Prisma + PostgreSQL** — Installed `prisma@7.8.0` + `@prisma/client@7.8.0`. Installed PostgreSQL 16 via winget (`PostgreSQL.PostgreSQL.16`). Created `ariot` database on local PostgreSQL. Ran `npx prisma init` — generated `prisma/schema.prisma` with `provider = "postgresql"`, `prisma.config.ts`, and `.env`. Updated `.env` with local connection string (`postgresql://postgres@localhost:5432/ariot?schema=public`). Added `DATABASE_URL` to `server/env.ts` for Zod validation. Added `DATABASE_URL` to `.env.example` with documentation. Verified with `npx prisma db push` — connection succeeds, schema in sync.

### 2026-07-03

#### Infrastructure

- **Step 2.1.2 — Core Schema Models** — `prisma/schema.prisma` — Full Prisma schema with all 11 models from DATABASE_SCHEMA_PLAN.md §1–§2. §1 Identity & Access: User (soft delete, email unique, passwordHash, locale, preferredCurrency, UserStatus enum, sessions/userRoles relations), Session (userId FK, tokenHash unique, indexed), Role (RoleKey enum unique, permissions Json), UserRole (composite PK userId+roleId, Cascade/Restrict onDelete). §2 Catalog: Category (self-referencing parent/child tree, soft delete, products relation), Product (all fields from schema plan: slug, tagline, description categoryId FK, sku unique, salesType enum, priceMinor BigInt, stockPolicy enum, specs/highlights/inTheBox Json, status enum, soft delete, 7 indices), ProductVariant (optionValues Json, priceMinor override, images/videos back-references, soft delete), ProductImage (variantId FK to ProductVariant with SetNull, isPrimary indexed), ProductVideo (variantId FK to ProductVariant with SetNull), ProductDownload (DownloadKind enum, sizeBytes BigInt), ProductRelation (composite PK productId+relatedProductId+kind, named relations ProductRelationSource/ProductRelationTarget). 8 enums: UserStatus, RoleKey, Currency, SalesType, StockPolicy, ProductStatus, RelationKind, DownloadKind. All FK indices, all cascade/restrict/setnull policies set. Validated: `npx prisma validate` ✅, `prisma generate` ✅, `prisma db push` ✅, `pnpm typecheck` ✅.

---

**Last Updated**: 2026-10-23

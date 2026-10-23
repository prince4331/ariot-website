# 10_AI_AGENT_CONTEXT.md

**AI Handoff Context** — Everything a future AI coding agent needs to continue this project without prior conversation history.

**Last Updated**: 2026-10-23
**Phase**: Phase 2 (Product CMS / Admin) + L3 Launch CMS + **D1 Production Docker Preparation**
**Planning Status**: ✅ COMPLETE
**Implementation Status**: 🟢 IN PROGRESS — **D1 Production Docker Preparation ✅ COMPLETED (2026-10-22)** — Docker/Compose production stack for `https://ariottech.com` on an OVH VPS (4 GB): `Dockerfile` (multi-stage: runtime/migrate/seed), `compose.production.yml` (`web`/`db`/`migrate`/`caddy` + explicit `seed` profile), `deploy/Caddyfile` (automatic HTTPS), `deploy/README.md` (canonical runbook), `.env.production.example`. Production seed is now **insert-only** (a rerun can never overwrite admin-edited content — D-079, regression-tested). Verified: **474 tests / 473 pass / 0 fail / 1 opt-in R2 skip** across 30 test files, `tsc`/`eslint`/`next build` green, migrations apply cleanly on an empty DB. **D1 closed 2026-10-23** — final verification session: live cache suite **37/37** (all 8 D-081 publication behaviours, disposable Docker data, no rebuild), production config verified (compose/image/migrate/health/media/env template), `git diff --check` green after CRLF→LF repair, GitHub readiness audited (exclude `z.txt`). **Not deployed yet** (D1/D2 stop before the OVH deploy). **D2 Production Auth ✅ COMPLETED (2026-10-23, D-083)** — admin-subdomain authentication: `BETTER_AUTH_URL=https://admin.ariottech.com` with **runtime-verified** Google callback `https://admin.ariottech.com/api/auth/callback/google` (matches the downloaded OAuth client) and **runtime-verified `403 INVALID_ORIGIN`** for untrusted cookie-bearing origins; exact two-origin trust list (no wildcards; loopback excluded in production); host-only cookies; loop-safe host routing via new `proxy.ts` (Next 16 middleware) + Caddy `handle` blocks; `app/(admin)/layout.tsx` loop-proof. Env-driven contact/quote/newsletter mail routing (`MAIL_FROM`/`MAIL_TO`, production fail-closed, dev placeholders never published). Fixed latent Caddyfile break (bare `{$CADDY_ACME_EMAIL}`). Launch blockers: I-031 (Resend verification of `ariottech.com` + owner-decided `MAIL_FROM`/`MAIL_TO`) + user config (Google OAuth creds in `.env`, real secrets, DNS incl. the `admin` A/CNAME) — see `docs/08_KNOWN_ISSUES.md`. Live Google login **unverified** until a post-deploy HTTPS browser flow. Next: **D3 — GitHub + OVH deployment preparation**.

---

## Project Summary

**ARIOT Technologies** (*Autonomous Robotics and IoT*) — Premium full-stack company website for a Bangladesh-based R&D-stage robotics and IoT company.

**Business Reality**: Currently in **research and development stage** — not yet commercially launched. Developing autonomous industrial floor cleaning robots (prototype stage). Website purpose is to build credibility for fundraising, showcase engineering capability, and generate future customer/partner pipeline.

**Quality Bar**: $20,000+ studio-grade website. Premium dark aesthetic with electric cyan accent. Every detail must pass professional scrutiny.

**Target Market**: Bangladesh + South Asia. BDT primary currency, USD secondary. English primary, Bangla bilingual-ready in future phase.

---

## Current Architecture

### Tech Stack (Installed & Active)
- **Framework**: Next.js 16.2.4 (App Router) + React 19.2.4
- **Language**: TypeScript `strict: true`
- **Styling**: Tailwind CSS v4 + design tokens (CSS-based config, not tailwind.config.ts)
- **Linting**: ESLint 9+ flat config (`eslint.config.mjs`, not .eslintrc.cjs)
- **Tooling**: Husky 9.1.7 + lint-staged 17.0.8 (pre-commit), Prettier 3.8.3, @next/bundle-analyzer 16.2.10
- **UI Components**: shadcn/ui-style locally-owned components
- **Animation**: Motion (Framer Motion successor) — *installed and used* (`components/layout/command-palette.tsx`)
- **3D**: React Three Fiber + drei + Three.js — *installed* (`components/three/`)
- **Validation**: Zod ^4.3.6 at every input boundary
- **Package Manager**: pnpm 10.33.2
- **Node**: `>=20` declared in `package.json`, but the toolchain needs **>= 22** for native TS type stripping (dev machine + Docker image: **24.22.0**) — see I-032

### Project Structure
```
app/
  (marketing)/       # All public pages complete: home, products (catalog+detail+category), solutions (index+detail), blog (index+post), about, contact, quote, support (hub+article+manuals+firmware), legal (layout+5 pages)
  api/                # 3 API routes (contact, newsletter, quote)
  layout.tsx          # Root layout with header/footer
  error.tsx           # Error boundary
  not-found.tsx       # 404 page
  globals.css         # Design tokens

components/
  layout/             # site-header, site-footer, mobile-drawer, nav-link
  marketing/          # hero-shell, feature-grid, feature-stack, cta-band, metric-band, legal-page, etc. (14 components)
  seo/                # JSON-LD structured data components (Organization, WebSite, BreadcrumbList, Product, BlogPosting, TechArticle, FAQPage, Service)
  three/              # r3f-wrapper, hero-scene, hero-3d-client (3D hero system)
  ui/                 # button, card, input, label, select, textarea, etc. (13 primitives)

lib/
  design-tokens.ts    # Color, spacing, typography tokens
  motion/tokens.ts    # Easing, duration tokens
  seo/                # metadata.ts, site.ts
  validators/         # Zod schemas (contact, quote, newsletter)
  utils/cn.ts         # clsx + tailwind-merge

features/
  forms/              # contact-form, quote-form, newsletter-form, use-form-submit
  blog/               # _data.ts (3 seed posts)
  solutions/          # _data.ts (6 seed solutions)
  support/            # _data.ts (3 seed articles)

server/
  env.ts              # Zod-validated environment

tests/                # 18 test files (238 pass / 1 opt-in smoke skipped): permission-evaluator (36), product-details-validation (30), product-save-queue (11), product-auth-wrapper (12), product-denied-write DB (4), product-api-route-security (13), product-editor-integration (11), product-media-validation (14), product-media-integration (11), upload-token (13), upload-keys (18), upload-complete-logic (8), upload-complete-integration (12), media-upload-r2.smoke (1, opt-in), media-storage-config (15), local-upload-validation (19), local-upload-integration (10), media-upload-local.smoke (1)
scripts/              # Build/utility scripts
content/              # MDX content files
public/               # Static assets

.husky/pre-commit     # Husky pre-commit hook → lint-staged
```

### Design System
- **Base**: Graphite/steel neutral scale (`--bg-base: #08090B`, `--steel-*`)
- **Accent**: Electric cyan (`--cyan-400: #3DD8F7`)
- **Typography**: Space Grotesk (display), Inter (body), JetBrains Mono (technical)
- **Motion**: `ease-out-quart`, `ease-out-expo` with 200–400ms UI, 600–1200ms cinematic

---

## Current Implementation Phase

**Phase**: Phase 2 — Product CMS / Admin

**Completion**: 10 of 43 steps complete (23%) + Corrective C.1 and C.2 complete + Step 2.4.5 ✅ Closed (2026-08-18)

**Note**: Prisma 7.8.0 + PostgreSQL 16 active. **Step 2.4.5 (Product Editor Variants Tab) ✅ CLOSED (2026-08-18, final production-service verification)**: `/admin/products/[id]/variants` page + tab in `product-editor-header.tsx` + single dispatch endpoint `POST /api/admin/products/variants` (`action`: `createVariant`/`updateVariant`/`archiveVariant`), gated server-side by `products.write`; read via `products.read` with `canEdit` to the client. Variants use **free-form `optionValues`** key/value pairs (no hard-coded option names) — normalized server-side (trim; ≤20 keys; key ≤40; value ≤100; `{}` allowed but once per product), **order-independent combination uniqueness** via `optionCombinationKey`; **SKU normalized uppercase** (trim + collapse whitespace) with **global uniqueness** across all variants (incl. archived) + active products; per-variant name/SKU/priceMinor (non-negative BigInt, BDT/USD)/stock (non-negative Int)/barcode/isDefault. **Archive = soft-delete** `deletedAt` (idempotent; archived SKU stays reserved). **Concurrency**: `Product.updatedAt` is the aggregate token (`expectedUpdatedAt` in / new token out); stale → 409. **Audit**: every successful mutation writes AuditLog (entityType `Product`, entityId productId; `PRODUCT_VARIANT_CREATED`/`_UPDATED`/`_ARCHIVED`) + touches `Product.updatedBy`; no-op updates succeed with no audit/no token change. UI: responsive table (min-w 880 + horizontal scroll), option chips, inline edit/archive, add form, optimistic updates with conflict banner + Reload, empty + read-only states. **FINAL VERIFICATION**: business rules exercised by running the **real production executors** through the shared authorization boundary (`authorizeProductWrite/Read` in `product-variant-mutation-helpers.ts`; `hasAllPermissions` + `AuthorizationError` — identical to `requirePermission`) against a disposable `ariot_variants_service_test` PostgreSQL DB. Architecture: session wrappers (`variant-auth.ts`) → context-injected executors (`*-executor.ts`); stale orphan `update-product-variants.ts` deleted. **Totals**: **376/376 node:test pass (1 opt-in R2 smoke skipped)** across **22 files** (+73: 31 real-service PG + 31 variant-schema lifecycle-field matrix/I-028 pattern + 11 details I-028); `tsc`/`eslint`/`next build` (62/62 static pages) green. No schema/migration change. **I-028 RESOLVED** (`product-details-schema.ts` priceMinor → `ctx.addIssue` + `z.NEVER`; never throws). Default-variant invariant **deferred** (no DB constraint; zero/multiple defaults possible; service clears only when setting `true`). New **I-029** (PrismaPg reads `timestamptz` as wall-clock UTC under non-UTC session — harness forces UTC via `?options=-c%20timezone%3DUTC`; keep production DB session UTC). **Canonical test runner**: `node --import ./tests/helpers/register-hooks.mjs --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/*.test.ts` (Node 24 native TS + `@/`/extensionless resolver; no tsx). Next: **Step 2.4.6** (Inventory/SEO/Related/Downloads/History tabs).

**Source Files**: ~137 TypeScript/TSX files (incl. ~28 generated Prisma client files) + Prisma schema + config

**Build Status**: ✅ All checks pass: `tsc --noEmit`, `eslint --max-warnings 0`, `next build` (62 static pages). Steps 2.2.1–2.2.5 + 2.3.1 complete. **Phase 1 Visual Redesign complete and browser-verified (2026-07-10)** — public site light; drawer portaled to body (WebKit fixed-position containing-block bug confirmed and fixed, verified at 390×844 and 360×800); all public pages de-bracketed; glassmorphism system added; admin console dark and functional (unchanged). **I-019 resolved and fully verified (2026-07-25)**: 4-way Prisma migrate diff clean, disposable migrate dev probe succeeded, primary DB unchanged. **I-025 resolved (2026-07-25)**: All namespace wildcards replaced with explicit permissions via `server/auth/permission-catalog.ts` + reconciliation CLI. CONTENT_ADMIN now satisfies `products.read`. 36 permission tests pass. I-024 resolved. Stable backup at `C:\Users\princ\backups\ariot\ariot_pre_c1_20260725_205020.dump`. **Step 2.4.4 STORAGE-1R uploads + D-068 local provider default (2026-08-18)**: verified totals — **238/239 node:test pass** (1 opt-in R2 smoke skipped), `next build` ✅ (59 routes), no schema change. **Step 2.4.5 variants tab (2026-08-18, FINAL)**: **413 tests / 412 pass** (across 24 files incl. 31 real-service PG variant + 36 UTC + 30 UTC-config), `next build` ✅ (62/62 static pages), no schema change.

**Recently Modified Files**:
- `server/storage/media-storage-provider.ts` — `MediaStorageProvider` interface + provider-name union (new, D-068).
- `server/storage/media-storage-config.ts` — `LocalMediaConfig`/`getLocalMediaConfig`/`assertSafeLocalRoot` (new).
- `server/storage/local-storage-fs.ts` — `resolveKeyPath`/`writeTempFile`/`promoteToPublic`/`deleteOwnedKey`/`statPublicKey`/`isRootWritable` (new).
- `server/storage/local-media-storage.ts` — `LocalMediaStorageProvider` (new).
- `server/storage/r2-media-storage.ts` — `R2MediaStorageProvider` (new).
- `server/storage/get-media-storage-provider.ts` — `resolveProviderName`/`getMediaStorageProvider`/`resetMediaStorageProviderForTests` (new).
- `server/storage/media-file-verification.ts` — `verifyUploadedBuffer` file-signature check (new).
- `server/storage/local-upload.ts` — `localUploadFromForm` multipart pipeline (new).
- `server/storage/upload-persist.ts` — refactored to provider-neutral `PersistPayload` + `cdnUrl` option (modified).
- `server/storage/upload-complete.ts` — R2 finalize computes/passes `cdnUrl` (modified).
- `server/storage/storage-service.ts` — barrel exports for the local provider (modified).
- `server/env.ts` — `MEDIA_STORAGE_PROVIDER`/`MEDIA_LOCAL_ROOT`/`MEDIA_PUBLIC_BASE_URL` (modified).
- `app/api/admin/media/uploads/local/route.ts` — local multipart route (new).
- `app/api/admin/media/upload/mode/route.ts` — server-resolved provider mode (new).
- `app/api/admin/media/storage/health/route.ts` — provider health (new).
- `app/media/[...segments]/route.ts` — public delivery route (new).
- `features/admin/media/use-media-upload.ts` — provider-agnostic client (rewritten).
- `server/admin/products/get-product-media.ts` — URL generation via `provider.getPublicUrl` (modified).
- `server/admin/media/media-policy.ts` — `APPROVED_EXT_TO_MIME`/`getMimeForExtension` (modified).
- Tests: `tests/media-storage-config.test.ts` (15), `tests/local-upload-validation.test.ts` (19), `tests/local-upload-integration.test.ts` (10), `tests/media-upload-local.smoke.test.ts` (1) — new.
- `docs/LOCAL_MEDIA_STORAGE.md` — local provider runbook + Nginx delivery + backup + R2 migration design (new).

---

## 2026-07-08 Phase 1 Closeout

**Security fix**: Added `server/rate-limit.ts` (in-memory fixed-window, 10 req/min/IP) and applied it to `/api/contact`, `/api/quote`, `/api/newsletter` (HTTP 429 + `Retry-After`). No PII/IP logged. Decision D-029; limitation tracked as I-015.

**Env fix**: `DATABASE_URL` is now optional at the base env layer (`server/env.ts`) so a Phase 1 static deploy does not fail without a database. Phase 2 DB code must assert it before connecting (I-015 context).

**Docs fixed**: `IMPLEMENTATION_BASELINE.md` and this file regenerated to reflect real state; `08_KNOWN_ISSUES.md` I-005 (Motion) and I-012 (DB) closed; `AGENTS.md` §14 index now lists all 7 tracking docs; `05_IMPLEMENTATION_MASTER_PLAN.md` route-group path inconsistencies corrected.

**Verification**: `pnpm typecheck`, `pnpm lint`, `pnpm build` all PASS (48 routes). Lighthouse / axe-core / Rich Results / live email NOT executed — see I-016.

---

## Current Milestone

**Milestone**: Phase 2 — Product CMS / Admin + **L3 Launch CMS**
**Current Step**: **L3 Minimal Marketing CMS ✅ Completed (2026-09-01)** — Admin Blog CRUD, public DB-backed blog + homepage/robotics/research/IoT updates, seed imports MDX as PUBLISHED, contact verified real. **463 tests / 463 pass** (1 opt-in R2 smoke skip) across **28 test files**; `tsc`/`eslint`/`next build` green (64 routes). Step 2.4.6A3 (StockMovement ledger) also completed 2026-08-29. Per the user's instruction: **do NOT deploy to VPS during L3** — launch scope is frozen; next step is VPS preparation.

**Build Status**: ✅ All pass: `tsc --noEmit`, `eslint --max-warnings 0`, `next build` (64 routes). `prisma validate`, `prisma generate`. 463 tests pass + 1 opt-in smoke skipped.

**Blocking**: None for L3. (R2 live smoke test remains pending on R2 credentials — I-027, R2-only.) Full sign-in → admin flow untested: requires `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` + `pnpm admin:bootstrap --apply` with a real admin email.
---

## Current Next Step

**Recommended**: **VPS preparation** (post-L3) — deploy the launch site with the seeded blog content + admin. Pre-deploy checklist: set `RESEND_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, run `pnpm admin:bootstrap --apply`, run `prisma db push` + `prisma db seed` on the target, verify `/blog`, `/admin/blog`, contact submission. No deployment in this step per launch scope freeze.

---

## Current Priorities

| Priority | Step | Status |
|----------|------|--------|
| 🟢 1 | CMS schema models (2.1.3) | ✅ Done |
| 🟢 2 | Operations schema models (2.1.4) | ✅ Done |
| 🟢 3 | Prisma client singleton (2.1.6) | ✅ Done |
| 🟢 4 | Choose auth provider (2.2.1) | ✅ Done — Better Auth selected (decision D-035, supersedes D-034 Auth.js) |
| 🟢 5 | Auth provider install + base config (2.2.2) | ✅ Done — Better Auth installed; `server/auth.ts` + route created; migration applied (local) + runtime DB verified (local) |
| 🟢 6 | Session creation + auth UI shell (2.2.3) | ✅ Done — Google OAuth provider + sign-in UI shell; `lib/auth-client.ts`, `/sign-in` route, `getSession()` helper; LIVE Google OAuth not tested (no creds) |
| 🟢 7 | Server-side RBAC guardrails (2.2.4) | ✅ Done — `server/auth/errors.ts` (AuthenticationError/AuthorizationError); `server/auth/permissions.ts` (getAuthorizationContext, requireAuthenticatedUser, requireRole, requirePermission, requireAnyPermission); `"*"` wildcard for SUPER_ADMIN |
| 🟢 8 | Secure admin bootstrap (2.2.5) | ✅ Done — `scripts/bootstrap-admin.ts` offline CLI; dry-run / --apply / --production; idempotent; no password/Account/Session; emailVerified=true; accountLinking + encryptOAuthTokens in auth.ts |
| 🟢 9 | Admin layout shell (2.3.1) | ✅ Done — `app/(admin)/layout.tsx` server gate (redirect /sign-in or /); `components/admin/admin-shell.tsx` chrome (top bar + drawer rail); `adminNav` config; `adminSignOut` server action; Overview placeholder |
| 🟢 10 | Product editor Media tab (2.4.4) | ✅ Done (2026-07-26) — hero image/video, gallery add/remove/reorder, existing-media selector, MIME validation, optimistic concurrency, audit logging |
| 🟢 11 | STORAGE-1R R2 uploads (2.4.4 closure, D-067) | ✅ Done (2026-08-18, part of D-068 closure) — initiate/presigned PUT/complete pipeline in `server/storage/`; R2 retained behind `MEDIA_STORAGE_PROVIDER=r2`, fail-closed without full config |
| 🟢 12 | Media storage provider abstraction + local provider (2.4.4, D-068) | ✅ Done (2026-08-18) — `local` is the working default (`MEDIA_STORAGE_PROVIDER=local`); local upload route, mode route, health route, public delivery `/media/[...segments]`, provider-agnostic client; 238/239 tests pass (1 opt-in R2 smoke skipped), build green |
| 🟢 13 | Product editor Variants tab (2.4.5) | ✅ Closed (2026-08-18, final production-service verification) — `/admin/products/[id]/variants` + `POST /api/admin/products/variants` (create/update/archive dispatch); free-form `optionValues` + order-independent combination uniqueness; uppercase SKU global-unique (incl. archived); `Product.updatedAt` concurrency; soft-delete archive; audit logging; optimistic UI; wrapper+executor architecture verified on disposable PG; 413 tests / 412 pass (1 opt-in R2 smoke skipped), build green across 24 files |
| 🟢 14 | **L3 Minimal Marketing CMS (launch)** | ✅ Complete (2026-09-01) — Admin Blog CRUD (`/admin/blog`, `/admin/blog/new`, `/admin/blog/:id`; `POST /api/admin/blog`, `POST /api/admin/blog/:id`); `server/admin/blog/*` services with strict Zod + slug dedupe + optimistic concurrency + audit; public blog from DB (`server/public/blog.ts`); homepage + `/robotics` + `/research` + `/solutions` consume `safe*` wrappers; seed imports MDX as PUBLISHED with file-mtime dates; contact verified real (Resend). 463 tests / 463 pass (1 opt-in R2 smoke skip), build green |

---

## Known Constraints

1. **MDX active** — `@next/mdx` configured; blog + support content in `content/` MDX files; TOC works via IntersectionObserver (I-013 + I-014 resolved)
2. **No real content** — All copy is `[BRACKETED]` placeholders
3. **Email integration wired** — Resend installed (`resend` 6.16.0). `server/mail/client.ts` with lazy client, dev stub fallback. Three HTML email templates (contact notification, quote notification, newsletter welcome) using ARIOT design tokens. API routes `/api/contact`, `/api/quote`, `/api/newsletter` all send emails. `RESEND_API_KEY` env var required for production (optional in dev).
4. **SEO infrastructure complete** — 9 schema.org components (`components/seo/`); wired into all key pages. Sitemap (`app/sitemap.ts`) with 39 public URLs; robots (`app/robots.ts`) with proper allow/disallow rules. Dynamic OG images (`app/api/og/route.tsx`) via Edge runtime with per-page branding and page-type badges.
5. **3D model placeholder** — Geometric shapes only; real GLTF model pending AI asset pipeline (step 1.13)
6. **Tests active** — 506 tests via `node --test` across 33 files: 505 pass / 0 fail / 1 opt-in R2 smoke skip (expected). Blog L3 integration (14), product variants (65), inventory (13), upload pipeline (82), media + storage (44), permissions/auth (49), product details/validation (121), D2 admin-subdomain/auth/email (32: proxy 16, auth-config 9, contact-mail 7), misc (75). Run: `node --import ./tests/helpers/register-hooks.mjs --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test "tests/*.test.ts"`.
7. **Motion used** — `components/layout/command-palette.tsx` uses `motion/react`; no scroll-triggered page animations yet (acceptable for Phase 1).
8. **remark-gfm not loaded** — Turbopack serialization constraint; GFM pipe tables not supported; MDX files use JSX table syntax
9. **Analytics wired** — Vercel Analytics (`@vercel/analytics` 2.0.1) + Plausible Analytics (script tag, deferred). `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` env var optional — omit to disable Plausible. Custom event tracking via `lib/analytics.ts` (typed `trackEvent`): forms, product views, CTA clicks.
10. **API rate-limiting active** — In-memory fixed-window limiter (`server/rate-limit.ts`), 10 req/min/IP, on `/api/contact`, `/api/quote`, `/api/newsletter` (HTTP 429 + `Retry-After`). Single-instance only; needs shared store before scale-out (I-015).
11. **Media storage: local provider default, R2 opt-in (D-068)** — `MEDIA_STORAGE_PROVIDER=local` is the working default (persistent root via `MEDIA_LOCAL_ROOT`, default `resolve(cwd,'..','ariot-media-dev')`; production must set it explicitly). Delivery via `app/media/[...segments]` (Node, Range + immutable cache, `tmp/` unreachable). R2 path retained (`MEDIA_STORAGE_PROVIDER=r2`) but no R2 credentials in local `.env`, so `tests/media-upload-r2.smoke.test.ts` skips (I-027). Provision per `docs/CLOUDFLARE_R2.md` §2 before switching to R2. Local runbook: `docs/LOCAL_MEDIA_STORAGE.md`.

---

## Design Philosophy

1. **Premium dark aesthetic** — Near-black/graphite base (`--bg-base: #08090B`), brushed-steel neutrals, electric-cyan accent
2. **Engineering-first** — Showcase technical credibility; no gimmicks
3. **Honest** — Transparent about R&D stage; no false availability claims
4. **Accessible** — WCAG 2.2 AA compliance; keyboard navigable; screen reader compatible
5. **Performant** — Fast on mid-range mobile on regional networks; Lighthouse ≥90

---

## Important Documentation

### Must Read Before Implementing

| Doc | Purpose |
|-----|---------|
| `AGENTS.md` | **Master operating manual** — rules, standards, workflow |
| `docs/05_IMPLEMENTATION_MASTER_PLAN.md` | Step-by-step implementation roadmap |
| `docs/PROJECT_FREEZE.md` | Architecture freeze declaration |
| `docs/IMPLEMENTATION_BASELINE.md` | Current project state snapshot |

### Reference Documents

| Doc | Purpose |
|-----|---------|
| `docs/TECH_ARCHITECTURE.md` | Folder structure, frontend/backend/db architecture |
| `docs/DESIGN_SYSTEM.md` | Tokens, typography, components, motion grammar |
| `docs/PAGE_BLUEPRINTS.md` | Section-by-section structure of every page |
| `docs/SITE_MAP.md` | Every route the site will eventually expose |
| `docs/CONTENT_STRATEGY.md` | Voice, copy direction, SEO |
| `docs/FEATURE_ROADMAP.md` | Phase 1–5 sequencing and exit criteria |
| `docs/DATABASE_SCHEMA_PLAN.md` | Prisma model sketch |
| `docs/ADMIN_DASHBOARD_PLAN.md` | Admin pages, RBAC, UX rules |
| `docs/ECOMMERCE_PLAN.md` | Catalog → checkout → orders flow |
| `docs/AI_ASSET_PIPELINE.md` | Seedream/Seedance usage, naming, optimization |
| `docs/AI_ASSET_REQUIREMENTS.md` | Asset slot inventory with direction and budgets |

### Tracking Documents

| Doc | Purpose |
|-----|---------|
| `docs/06_PROGRESS_LOG.md` | Step-by-step progress tracking |
| `docs/07_DECISIONS.md` | Architectural and business decisions log |
| `docs/08_KNOWN_ISSUES.md` | Known issues and technical debt |
| `docs/09_CHANGELOG.md` | Reverse-chronological change history |

---

## Recommended Next Command

**Step 2.4.6A3 is ✅ Completed — Inventory foundation (Step 2.4.6) complete:**
```
Step 2.4.6A3 delivered the immutable StockMovement ledger (model + migration trigger + executor wiring + GET /api/admin/inventory/movements + /admin/inventory History dialog), per D-075/D-077. Per the user's instruction, STOP after A3: do not begin public-website or ecommerce work.
```

**Optional (R2-only follow-up, no longer blocks anything):**
```
Set R2_* + MEDIA_UPLOAD_TOKEN_SECRET per docs/CLOUDFLARE_R2.md, run the §5 smoke-test runbook to verify the R2 provider, then switch MEDIA_STORAGE_PROVIDER=r2
```

**Open hardening item (I-028, pre-existing, low severity):**
```
product-details-schema.ts price transform throws instead of ctx.addIssue — fix with the same pattern already used in product-variant-schema.ts
```

---

## Estimated Completion

| Phase | Status | % |
|-------|--------|---|
| **Planning** | ✅ Complete | 100% |
| **Phase 1 Implementation** | ✅ Complete | 100% (74/74 steps) |
| **Phase 2 CMS / Admin** | 🟢 In progress | 23% (10/43 steps + C.1 + C.2; Step 2.4.5 ✅ Closed) |
| **Phase 3 Ecommerce** | ⬜ Not started | 0% |
| **Phase 4 Support** | ⬜ Not started | 0% |
| **Phase 5 IoT** | ⬜ Not started | 0% |
| **Overall Project** | — | ~23% |

---

**Last Updated**: 2026-10-23

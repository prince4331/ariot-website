# 05_IMPLEMENTATION_MASTER_PLAN.md

Phase 1 implementation roadmap — **Premium Public Website**. One step at a time. No step is skipped, reordered, or merged without explicit approval.

**Phase 1 Goal**: a marketing website credible enough to anchor every sales conversation and investor due diligence. No customer-facing transactions yet.

**Exit Criteria** (from `FEATURE_ROADMAP.md`):
- Lighthouse mobile ≥ 90 on `/`, `/products`, `/products/:slug`, `/blog/:slug`, `/support/article/:slug`
- LCP ≤ 2.5 s on regional 4G profile
- WCAG 2.2 AA passes axe-core on all public pages
- All copy is real or `[BRACKETED]` — no lorem ipsum
- Contact + quote + newsletter forms verified end-to-end with email delivery
- One signed-off premium reference page (product detail or case study)

---

## Category 1.0 — Visual Redesign & Premium Light-Theme Correction (corrective)

> Cross-cutting corrective work performed after the dark-theme Phase 1 build.
> Does NOT renumber existing steps. Implemented before continuing the admin
> roadmap (2.3.x). See also `docs/07_DECISIONS.md` D-041.

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.0.1 | ✅ **Light-first visual system** | Flip the shared token CSS variables to a light palette scoped behind `.theme-light`, applied to the `(marketing)` and `(auth)/sign-in` route groups only. Admin console (separate route group, `app/(admin)`) keeps the original dark tokens untouched. Palette: white/`#F7F9FC` surfaces, navy `#0F172A` primary text, slate `#475569` secondary, soft `#E2E8F0` borders, refined robotics blue `#2563EB` accent, restrained teal `#0F766E`-family cyan. WCAG-readable contrast. | Public site renders light; admin unchanged |
| 1.0.2 | ✅ **Chrome + primitives + hero** | Header/footer/mobile-drawer/command-palette inherit the scope. Card `glass` border fixed to `steel-700`. Hero SVGs (21x9, 9x16) recolored to light blueprint. 3D hero robot recolored to slate/blue on pale dome. Homepage, products, solutions, about, blog, support, contact, quote, legal, sign-in all share the light language. | Coherent premium light site; sign-in matches |
| 1.0.3 | ✅ **Build/lint/typecheck** | `tsc`, `eslint --max-warnings 0`, `next build` all pass. No auth/RBAC/DB/admin logic changed. | Verified green |
| 1.0.4 | ✅ **Public IA, mobile nav, new pages** | Corrective IA step: primary nav → Home/R&D/Workspace/Components/Solutions/About + More(Blog,Support) + Contact/Quote. Mobile drawer hardened (w-[88vw] max-w-[360px], inherits theme-light, Blog+Support added). Footer reorganised (columns: Company/R&D/Workspace/Components/Solutions/Resources; dead links removed; placeholder contact removed). New routes: `/research`, `/workspace`, `/components` (all static ○). Homepage reorganised (10 sections, approved positioning, honest status labels, no fake numbers). About + Solutions pages de-bracketed. `tsc`/`eslint`/`next build` pass. | All required routes exist; no dead links |
| 1.0.5 | ✅ **Drawer portal fix, glassmorphism system, full page polish** | Root cause: sticky header `backdrop-filter` in WebKit creates containing block for fixed-position descendants, confining drawer to ~60px header bounds (visible as 150px narrow strip + black panel). Fix: `createPortal` to `document.body` escapes all parent constraints; panel `absolute inset-y-0 right-0 w-[88vw] max-w-[360px]` in a `fixed inset-0 z-[200]` root; `theme-light` on panel directly. CSS keyframe `drawer-slide-in`. Glass utilities `.glass-panel`/`.glass-panel-strong` in globals.css. Card glass variant → proper `glass-panel-strong`. More-menu glass dropdown. Homepage hero glass status overlay. Research/workspace glass status panels. All public pages fully de-bracketed (products, contact, quote, blog, support, sign-in). Sign-in card → glass + blueprint grid bg. `tsc`/`eslint`/`next build` pass. **Browser-verified 2026-07-10** at 390×844 and 360×800. | ✅ Portal confirmed; pages verified in browser |

## Category 1.1 — Project Scaffold & Config

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.1.1 | ✅ **Initialize Next.js project** | `pnpm create next-app` with App Router, TypeScript strict, Tailwind CSS, src directory off. Confirm `.gitignore`, `.eslintrc`, `postcss.config.mjs`, `next.config.ts` are generated. | Build passes |
| 1.1.2 | ✅ **Configure tooling** | Add Prettier (`.prettierrc` with project conventions), ESLint strict config, Husky + lint-staged for pre-commit checks. Add `@next/bundle-analyzer`. | `pnpm lint` zero warnings |
| 1.1.3 | ✅ **Set up path aliases and env** | Configure `@/` alias in `tsconfig.json`. Create `.env.example` with all required vars (NEXT_PUBLIC_*). Create `server/env.ts` with Zod-validated env access. | Build passes with env |
| 1.1.4 | ✅ **Establish folder structure** | Create all top-level directories per `TECH_ARCHITECTURE.md` §1: `app/`, `components/`, `lib/`, `server/`, `features/`, `docs/`, `public/`, `content/`, `tests/`, `scripts/`. Add `index.ts` barrel files where appropriate. | Directory tree matches architecture doc |

---

## Category 1.2 — Design System & UI Primitives

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.2.1 | **Design tokens in code** | Create `lib/design-tokens.ts` exporting all tokens from `DESIGN_SYSTEM.md`: color palette (steel, cyan, semantic), typography scale, spacing scale, border radii, shadows, elevation, breakpoints. Also populate `app/globals.css` with CSS custom properties for tokens. | Token import resolves |
| 1.2.2 | **Typography system** | Configure `next/font` with Inter (or project font) + JetBrains Mono. Set up base font sizes, line heights, letter spacing in Tailwind theme extension. Add `html` base styles with `font-feature-settings`. | Text renders correctly at all scales |
| 1.2.3 | **UI Primitive: Button** | Build `components/ui/button.tsx` — variants: primary, secondary, ghost, destructive. States: hover, focus-visible, active, disabled, loading (spinner). Sizes: sm, md, lg. Loading state shows spinner, disables interaction. | All states render, keyboard accessible |
| 1.2.4 | **UI Primitive: Input, Textarea, Select, Label, FormField** | Build `components/ui/input.tsx`, `textarea.tsx`, `select.tsx`, `label.tsx`, `form-field.tsx`. Consistent height (40px), border, focus ring, error state, disabled state. FormField wraps input + label + error message. | Forms render correctly |
| 1.2.5 | **UI Primitive: Card, Badge, Separator, Container, Section** | Build `components/ui/card.tsx` (with optional hover lift), `badge.tsx` (color variants), `separator.tsx`, `container.tsx` (max-width + padding responsive), `section.tsx` (vertical rhythm tokens). | All render, responsive |
| 1.2.6 | **UI Primitive: SkipLink** | Build `components/ui/skip-link.tsx` — visually hidden, appears on focus. Links to `#main-content`. | Keyboard nav reaches it |
| 1.2.7 | **Motion tokens & utilities** | Create `lib/motion/tokens.ts` with project easing curves (`ease-out-quart`, `ease-out-expo`), default durations, and a `prefers-reduced-motion` utility hook. Create `components/marketing/` directory with placeholder for animated section reveals. | `useReducedMotion()` hook works |
| 1.2.8 | **cn() utility** | Create `lib/utils/cn.ts` — `clsx` + `tailwind-merge` wrapper. | Import resolves |

---

## Category 1.3 — Layout Shell

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.3.1 | **Root layout** | Update `app/layout.tsx`: font loading, base metadata (title template, description, icons, OG defaults), `<html lang="en">`, `<body>` with skip-link, global header + footer slots. Wrap in any required providers (theme, analytics placeholder). | Site loads with correct fonts and metadata |
| 1.3.2 | **Global header** | Build `components/layout/site-header.tsx` — sticky, 72px desktop / 60px mobile. Left: logo. Center: nav links (Products, Solutions, Support, Blog, About). Right: search trigger, cart icon (placeholder), account icon. Scroll: bg opacity + backdrop blur. Mobile: hamburger → full-height drawer with nav + bottom CTA. | Desktop + mobile render, scroll effect works |
| 1.3.3 | **Global footer** | Build `components/layout/site-footer.tsx` — 4-column desktop (brand+social, products+solutions, support+company, newsletter+address+payment logos). Bottom row: copyright + legal links. Mobile: stacked columns, accordion nav. | Desktop + mobile render |
| 1.3.4 | **Marketing layout** | Create `app/(marketing)/layout.tsx` — wraps marketing pages with header/footer. Sets marketing-specific metadata defaults. | Marketing pages use correct layout |
| 1.3.5 | **NavLink component** | Build `components/layout/nav-link.tsx` — active state detection, underline animation, aria-current. | Nav highlights current page |

---

## Category 1.4 — Homepage

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.4.1 | **HeroShell component** | Build `components/marketing/hero-shell.tsx` — full-bleed container with aspect ratio, background slot (for R3F/Seedance/image), eyebrow, headline, subhead, CTA row, scroll-cue. Responsive: 88vh mobile, full desktop. | Renders with placeholder background |
| 1.4.2 | **Homepage hero section** | Implement `app/(marketing)/page.tsx` hero: eyebrow `[ROBOTICS · IOT · ENGINEERED IN BD]`, display-1 headline `[HERO_HEADLINE]`, body-lg subhead, two CTAs (primary "Explore products", secondary "Request a quote"), scroll-cue. Background: Seedance loop with poster fallback (3D scene comes in step 1.9). | Hero renders on desktop + mobile |
| 1.4.3 | **Trust strip** | Build `components/marketing/logo-strip.tsx` — horizontal row of partner/customer/certification logos (placeholder lockups). 60% opacity, hover 100%. 6 logos max. Responsive scroll on mobile. | Logos render, responsive |
| 1.4.4 | **Feature stack (What ARIOT Does)** | Build `components/marketing/feature-stack.tsx` — alternating layout (text left / media right, then flip). Three rows: Autonomous Robotics, Connected IoT Systems, Custom Solutions. Each: title, 2-line body, CTA link, square media tile (Seedream image). Entrance animation: 16px translate + opacity on viewport entry. | Three rows render, alternating layout, mobile stacks |
| 1.4.5 | **Feature grid (Products Preview)** | Build `components/marketing/feature-grid.tsx` — 3-up grid. Each card: image, name, short tagline, spec chips (IP65, LiDAR, 4G/LTE), price (BDT primary, USD parenthetical), "View all products" CTA below. Data from `_home-content.ts` (static seed data). | Grid renders 3-up desktop, responsive |
| 1.4.6 | **Solutions grid** | Extend `feature-grid` or create variant for 4-up: Smart Factory, Smart Agriculture, Smart City, Education. Each: blueprint line illustration, name, 1-line outcome, "Learn more". | 4-up renders, mobile 2-up then 1-up |
| 1.4.7 | **Metric band** | Build `components/marketing/metric-band.tsx` — 4 mono digits with cyan accents. Digits count up from 0 on viewport entry (clamped by `prefers-reduced-motion`). Values: `[BRACKETED]` until real numbers. | Count-up animation works, respects reduced motion |
| 1.4.8 | **Blog teaser** | Build `components/marketing/media-showcase.tsx` — latest 2 blog posts in 2-up grid with large thumbnails + reading-time chips. Data from static seed data. | 2 posts render, responsive |
| 1.4.9 | **Testimonial section** | Build `components/marketing/testimonial.tsx` — marquee quote, photo, role, company. Side link to full case study. Placeholder content: `[BRACKETED]`. | Renders with placeholder |
| 1.4.10 | **CTA band** | Build `components/marketing/cta-band.tsx` — two CTAs: "Request a quote" (primary), "Talk to sales" (secondary). Subtext with regional office hint. | Renders desktop + mobile |
| 1.4.11 | **Compose homepage** | Assemble all sections in `app/(marketing)/page.tsx`: Hero → Trust strip → Feature stack → Products grid → Solutions grid → Metrics → Blog teaser → Testimonial → CTA band. Add section-level entrance animations. | Full page renders, all sections visible |

---

## Category 1.5 — Products Pages

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.5.1 | ✅ **Product seed data** | Create `app/(marketing)/products/_data.ts` with 6–8 seed products: name, slug, tagline, category, specs, price (BDT/USD), image, salesType, highlights, inTheBox. Include the flagship robot product. | Data imports cleanly |
| 1.5.2 | ✅ **Product card component** | Build `components/marketing/product-card.tsx` — image, name, tagline, spec chips, price, stock badge, "View details" link. Hover lift + cyan ring. Responsive. | Card renders for all seed products |
| 1.5.3 | ✅ **Catalog page `/products`** | Build `app/(marketing)/products/page.tsx` — compact hero (eyebrow, title, subhead), 3-up product card grid (2-up tablet, 1-up mobile), "Can't find what you need?" CTA band. No filters yet (static seed data). | Page renders, all products visible |
| 1.5.4 | ✅ **Product detail page `/products/[slug]`** | Build `app/(marketing)/products/[slug]/page.tsx` — breadcrumb, hero gallery (image carousel + thumbnail strip), buy box (name, category chip, tagline, spec chips, price block, "Request a quote" CTA), tabbed detail (Overview, Specifications, Downloads placeholder), "In the box" grid, related products, CTA band. Dynamic metadata + JSON-LD `Product`. | Detail page renders for each seed product |
| 1.5.5 | ✅ **Category page `/products/category/[slug]`** | Build `app/(marketing)/products/category/[slug]/page.tsx` — filtered product grid by category. Dynamic metadata. | Each category page renders |
| 1.5.6 | ✅ **Category seed data** | Create seed data for categories: industrial-robotics, smart-city-iot, smart-building-iot, prosumer, education, custom. Each with name, slug, description. | Categories import cleanly |

---

## Category 1.6 — Solutions Pages

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.6.1 | ✅ **Solution seed data** | Create `features/solutions/_data.ts` solutions entries: smart-factory, smart-agriculture, smart-city, energy-utilities, education, custom. Each: name, slug, tagline, description, industries, related products. | Data imports cleanly |
| 1.6.2 | ✅ **Solutions index `/solutions`** | Build `app/(marketing)/solutions/page.tsx` — hero (eyebrow, title, subhead, ambient loop), 3×2 industry grid, timeline section (Discover → Design → Pilot → Deploy → Support), featured case study placeholder, CTA band. | Page renders, grid + timeline visible |
| 1.6.3 | ✅ **Solution detail `/solutions/[slug]`** | Build `app/(marketing)/solutions/[slug]/page.tsx` — hero (industry name, outcome headline), problem section with stats, approach (feature-stack 3-up), tech stack chips, case study narrative, related products, CTA band. Dynamic metadata + JSON-LD `Service`. | Detail page renders for each solution |
| 1.6.4 | ✅ **Timeline component** | Build `components/marketing/timeline.tsx` — horizontal on desktop, vertical on mobile. Cyan line draws on scroll. Step markers with labels. | Timeline animates correctly |

---

## Category 1.7 — Content Pages

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.7.1 | ✅ **About page `/about`** | Build `app/(marketing)/about/page.tsx` — hero (eyebrow "OUR STORY", manifesto headline, subhead), mission statement, metric band, story timeline, team grid (placeholder members), manufacturing section, certifications strip, press section, CTA band. Dynamic metadata + JSON-LD `Organization`. | Page renders, all sections visible |
| 1.7.2 | ✅ **Blog index `/blog`** | Build `app/(marketing)/blog/page.tsx` — featured post hero (full-bleed image, category, title, excerpt), category pill strip, 3-up post grid, innovation lab section (gradient border, "LAB" badge), newsletter CTA band. Seed 3 blog posts. | Index renders, 3 posts visible |
| 1.7.3 | ✅ **Blog post `/blog/[slug]`** | Build `app/(marketing)/blog/[slug]/page.tsx` — hero image, title block (category, title, subtitle, author, date, reading time), TOC (sticky desktop, collapsible mobile), rich body (markdown/MDX render with callouts, code blocks, images, pull quotes), author bio, newsletter CTA, related posts. Dynamic metadata + JSON-LD `BlogPosting`. | Post renders for each seed post |
| 1.7.4 | ✅ **Blog seed data** | Create 3 seed blog posts: "Building Autonomous Robots in Bangladesh", "IoT Sensor Networks for Smart Agriculture", "Why Regional Robotics Needs Local Engineering". Each with full body content (MDX), category, tags, author, reading time. | Posts render correctly |
| 1.7.5 | ✅ **Support hub `/support`** | Build `app/(marketing)/support/page.tsx` — hero search input, popular articles row, 6 category cards (Getting Started, Setup, Connectivity, Firmware, Troubleshooting, Warranty), manuals link, firmware link, "Still stuck?" CTA band with "Open a ticket" + "Email us". | Page renders, search + categories visible |
| 1.7.6 | ✅ **Support article `/support/article/[slug]`** | Build `app/(marketing)/support/article/[slug]/page.tsx` — breadcrumb, title + meta (date, products, reading time), TOC, rich body, "Was this helpful?" yes/no, related articles, open ticket CTA. Seed 3 support articles. Dynamic metadata + JSON-LD `TechArticle`. | Article renders for each seed article |
| 1.7.7 | ✅ **Support static pages** | Build `/support/manuals` (list of downloadable manuals) and `/support/firmware` (list of firmware versions). Static content for now. | Both pages render |
| 1.7.8 | ✅ **Contact page `/contact`** | Build `app/(marketing)/contact/page.tsx` — hero, 3-up contact channels (Sales, Support, Press with email/phone/SLA), contact form (name, company, email, topic dropdown, message, file upload), office locator (static map + addresses). | Page renders, form visible |
| 1.7.9 | ✅ **Quote page `/quote`** | Build `app/(marketing)/quote/page.tsx` — hero with SLA promise, 3-step multi-step form (Project info → Products of interest → Contact details), confirmation screen, side panel "What happens next" timeline. | Form renders, steps navigate |

---

## Category 1.8 — Legal Pages

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.8.1 | ✅ **Legal layout & routing** | Create `app/(marketing)/legal/layout.tsx` and route group. Build index page linking to all legal pages. | Layout renders |
| 1.8.2 | ✅ **Legal page content** | Build 5 legal pages: privacy policy, terms of service, cookie policy, warranty policy, shipping & returns. Content via MDX files in `content/legal/`. All clearly marked as R&D-stage placeholders where appropriate. | All 5 pages render with real content |
| 1.8.3 | ✅ **Footer legal links** | Ensure footer links to all 5 legal pages. Add breadcrumbs on legal pages. | Links resolve |

---

## Category 1.9 — 3D Hero Scene

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.9.1 | ✅ **R3F setup & lazy-load** | Install `@react-three/fiber`, `@react-three/drei`, `three`. Create `components/three/` directory. Build lazy-loaded wrapper with `dynamic(() => import(...), { ssr: false })` + `<Suspense>` with steel-skeleton fallback. | Component lazy-loads without SSR errors |
| 1.9.2 | ✅ **Hero 3D scene** | Build a scene: autonomous robot model (or geometric placeholder), cyan signal lights, subtle environment. Camera dolly tied to scroll for first 20% of page. Pause `useFrame` when off-screen (IntersectionObserver). DPR clamp `[1, 1.75]`. Polycount ≤ 250k. | Scene renders, scroll dolly works, pauses off-screen |
| 1.9.3 | ✅ **Mobile fallback** | On mobile (< 768px), swap R3F for Seedance video loop with poster image fallback. Ensure hero height drops to 88vh. | Mobile shows video/image, not 3D |

---

## Category 1.10 — SEO Infrastructure

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.10.1 | ✅ **Metadata helpers** | Create `lib/seo/metadata.ts` with `generatePageMetadata()` helper: title template, description, OG image, canonical URL, robots. Create per-page-type variants (product, blog, solution, support article). | Metadata renders in `<head>` |
| 1.10.2 | ✅ **JSON-LD components** | Build `components/seo/` components: `Organization`, `WebSite`, `BreadcrumbList`, `Product` (with offers, brand, gtin), `BlogPosting`, `TechArticle`, `FAQPage`, `Service`. Each emits correct schema.org markup. | Structured data validates via Google Rich Results Test |
| 1.10.3 | ✅ **Sitemap & robots** | Build `app/sitemap.ts` — enumerate all static + dynamic routes (products, blog, solutions, support). Build `app/robots.ts` — allow public marketing routes; disallow `/admin`, `/account`, `/auth`, `/api`, `/checkout`. | `/sitemap.xml` and `/robots.txt` render correctly |
| 1.10.4 | ✅ **OG image generation** | Build `app/api/og/route.ts` — Edge runtime, `next/og`. Generate per-page OG images using design tokens, typography, and page title. Fallback to static OG image. | OG images render at various sizes |

---

## Category 1.11 — Forms & API Routes

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.11.1 | **Form submission hook** | Build `features/forms/use-form-submit.ts` — reusable hook for form state, validation error display, submit handler, success/error toast. Uses `react-hook-form` + Zod resolver. | Hook works in a test form |
| 1.11.2 | **Contact form** | Build `features/forms/contact-form.tsx` — name, email, company (optional), subject dropdown, message, file upload. Posts to `/api/contact`. Zod validation. Success: toast + form reset. Error: inline errors. | Form submits, validates, shows feedback |
| 1.11.3 | **Quote form** | Build `features/forms/quote-form.tsx` + `quote-form-fields.tsx` — 3-step multi-step form. Zod validation per step. Posts to `/api/quote`. Confirmation screen with quote ID. | Form submits end-to-end |
| 1.11.4 | **Newsletter form** | Build `features/forms/newsletter-form.tsx` — email-only input. Posts to `/api/newsletter`. Zod validation. Success: confirmation message. | Form submits, validates |
| 1.11.5 | **API route: contact** | Build `app/api/contact/route.ts` — Zod validate input, rate-limit (10 req/min/IP), send email via Resend to `info@ariot.com`, send confirmation to user. Return typed result. | API accepts POST, returns success |
| 1.11.6 | **API route: quote** | Build `app/api/quote/route.ts` — Zod validate, rate-limit, send email to sales team + user confirmation, generate quote number. | API accepts POST, returns quote ID |
| 1.11.7 | **API route: newsletter** | Build `app/api/newsletter/route.ts` — Zod validate, rate-limit, store email (array/DB placeholder), send welcome email via Resend. | API accepts POST, returns success |
| 1.11.8 | ✅ **Email service setup** | Install Resend. Create `server/mail/client.ts` with Resend client initialization. Create email templates matching design system (contact notification, quote notification, newsletter welcome). | Emails send in dev |

---

## Category 1.12 — Analytics, Security & Performance

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.12.1 | ✅ **Security headers** | Configure `next.config.ts` headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, `Content-Security-Policy` hardened. | Headers present via `curl -I` |
| 1.12.2 | ✅ **Analytics setup** | Add Vercel Analytics (`@vercel/analytics`). Add Plausible Analytics (script tag, deferred). Set up event tracking: quote submissions, contact submissions, newsletter signups, product page views, CTA clicks. | Analytics scripts load, events fire |
| 1.12.3 | **Error boundary & 404** | Build `app/error.tsx` (route-level error boundary with retry). Build `app/not-found.tsx` (custom 404 with back-to-home CTA). | Error and 404 pages render |
| 1.12.4 | ✅ **Performance audit** | Run Lighthouse on `/`, `/products`, `/products/:slug`, `/blog/:slug`, `/support/article/:slug`. Verify ≥ 90 mobile. Check LCP ≤ 2.5s. Fix any issues (image optimization, font loading, bundle size). | Lighthouse scores ≥ 90 |
| 1.12.5 | ✅ **Accessibility audit** | Run axe-core on all public pages. Fix any WCAG 2.2 AA violations. Verify keyboard navigation, screen reader compatibility, focus indicators, color contrast. | axe-core zero violations |
| 1.12.6 | **Command palette placeholder** | Build `Ctrl/Cmd+K` command palette shell — modal with search input. No search logic yet (placeholder for Phase 2). Keyboard shortcut works. | Palette opens/closes on shortcut |

---

## Category 1.13 — AI Asset Generation

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 1.13.1 | ✅ **Generate hero assets** | Use Seedream to generate hero background image (robotics lab, autonomous robot, cyan lighting). Use Seedance to generate hero video loop (8s, AV1/H.264, ≤ 1.8MB). Store in `public/media/home/`. Save prompt + seed to `content/ai-prompts/hero.json`. | Assets render in hero |
| 1.13.2 | ✅ **Generate product & solution images** | Use Seedream for product images (6–8 products), solution illustrations (6 solutions), blog covers (3 posts), about page hero. Consistent style: clean, engineering-focused, cyan accents. Store in `public/media/products/`, `public/media/solutions/`, `public/media/blog/`. | Images render on all pages |
| 1.13.3 | ✅ **Optimize all images** | Run all AI-generated images through optimization: AVIF + WebP variants, responsive sizes (240/480/720/1080/1440), explicit dimensions set in components. Verify total page weight stays within budgets. | Images optimized, no layout shift |

---

## Execution Notes

### Dependency Graph (within Phase 1)

```
1.1.1 ──► 1.1.2 ──► 1.1.3 ──► 1.1.4
                                      │
                    ┌─────────────────┤
                    ▼                 ▼
              1.2.1–1.2.8        1.13.1–1.13.3 (parallel)
                    │
              ┌─────┤
              ▼     ▼
         1.3.1  1.3.2–1.3.5
              │
    ┌─────────┼─────────┬──────────┬──────────┐
    ▼         ▼         ▼          ▼          ▼
  1.4.1    1.5.1     1.6.1      1.7.1     1.8.1
  –1.4.11  –1.5.6    –1.6.4     –1.7.9    –1.8.3
    │         │         │          │          │
    └─────────┴─────────┴──────────┴──────────┘
                          │
                    ┌─────┼──────┐
                    ▼     ▼      ▼
               1.9.1   1.10.1  1.11.1
               –1.9.3  –1.10.4 –1.11.8
                    │     │      │
                    └─────┴──────┘
                          │
                    1.12.1–1.12.6
```

### Critical Path

```
1.1.1 → 1.1.2 → 1.1.3 → 1.1.4 → 1.2.1 → 1.2.3 → 1.3.1 → 1.3.2 → 1.4.1 → 1.4.11 → 1.12.4 → DONE
```

### Parallelism Opportunities

| Workstream A (UI) | Workstream B (Data/Content) | Workstream C (3D/Assets) |
|---|---|---|
| 1.2.1–1.2.8 (design system) | 1.13.1–1.13.3 (AI assets) | 1.9.1–1.9.3 (R3F scene) |
| 1.3.1–1.3.5 (layout) | 1.5.1, 1.6.1, 1.7.4 (seed data) | — |
| 1.4.1–1.4.11 (homepage) | 1.11.5–1.11.8 (API routes) | — |
| 1.5.2–1.5.6 (products) | 1.8.1–1.8.3 (legal pages) | — |
| 1.6.2–1.6.4 (solutions) | — | — |
| 1.7.1–1.7.9 (content pages) | — | — |

### Step Count by Category

| Category | Steps | Parallelism |
|----------|-------|-------------|
| 1.1 Project Scaffold | 4 | Sequential |
| 1.2 Design System | 8 | Sequential within, parallel with 1.13 |
| 1.3 Layout Shell | 5 | Sequential |
| 1.4 Homepage | 11 | Sequential (builds on 1.2 + 1.3) |
| 1.5 Products | 6 | Parallel with 1.4, 1.6, 1.7 |
| 1.6 Solutions | 4 | Parallel with 1.4, 1.5, 1.7 |
| 1.7 Content Pages | 9 | Parallel with 1.4, 1.5, 1.6 |
| 1.8 Legal Pages | 3 | Parallel with above |
| 1.9 3D Hero | 3 | Parallel with 1.10, 1.11 |
| 1.10 SEO | 4 | Parallel with 1.9, 1.11 |
| 1.11 Forms & API | 8 | Parallel with 1.9, 1.10 |
| 1.12 Security & Perf | 6 | Last (validates everything) |
| 1.13 AI Assets | 3 | Parallel from 1.1.4 onward |
| **TOTAL** | **74** | |

---

## Phase 1 — Final Checklist

Before crossing into Phase 2, verify:

- [ ] Lighthouse mobile ≥ 90 on `/`, `/products`, `/products/:slug`, `/blog/:slug`, `/support/article/:slug`
- [ ] LCP ≤ 2.5 s on regional 4G (WebPageTest from Dhaka or comparable)
- [ ] WCAG 2.2 AA — axe-core zero violations on all public pages
- [ ] All copy is real or `[BRACKETED]` — zero lorem ipsum
- [ ] Contact form → email delivery confirmed
- [ ] Quote form → email delivery confirmed
- [ ] Newsletter form → email delivery confirmed
- [ ] One signed-off premium reference page (flagship product detail or case study)
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm build` — succeeds
- [ ] OG images render on social shares
- [ ] Sitemap.xml serves all public routes
- [ ] robots.txt configured correctly
- [ ] JSON-LD validates via Google Rich Results Test
- [ ] 404 page renders with back-to-home CTA
- [ ] Error boundary catches runtime errors
- [ ] Security headers present (HSTS, CSP, nosniff, etc.)
- [ ] Analytics events firing (quote, contact, newsletter)
- [ ] Mobile responsive on all pages (no horizontal scroll, no overlapping)
- [ ] Keyboard navigation works on all interactive elements
- [ ] 3D hero lazy-loads, pauses off-screen, mobile fallback works
- [ ] All images have explicit dimensions + alt text
- [ ] No broken links across the site
- [ ] Release note created at `docs/RELEASES/<date>.md`

---

**Status**: Phase 1 APPROVED — 74 steps defined  
**Phase 1 effort**: 74 steps across 13 categories  
**Phase 1 critical path**: ~11 steps (scaffold → design system → layout → homepage → performance audit)  
**Phase 1 parallel capacity**: 3 workstreams (UI, Data/Content, 3D/Assets)

---

# PHASE 2 — Product CMS / Admin

Phase 2 implementation roadmap — **Product CMS & Admin Dashboard**. Replace seeded/static content with admin-managed CMS. ARIOT team publishes without engineering help.

**Phase 2 Goal**: content team manages products, blog, media, and categories via a secure admin dashboard. Public pages read from the database with ISR + on-demand revalidation.

**Prerequisites**: Phase 1 complete and verified (all checklist items pass).

**Exit Criteria** (from `FEATURE_ROADMAP.md`):
- ARIOT content team publishes a new product end-to-end without dev help
- Catalog and blog public pages reflect admin changes within 60 s
- Image variants serve via the configured CDN/storage path
- Audit log shows every admin mutation with `actor`, `action`, `entityType`, `entityId`, `before`, `after`
- Role-gated routes verified — a `content_admin` cannot reach orders or roles

---

## Category 2.1 — Database Setup

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.1.1 | ✅ **Install Prisma + PostgreSQL** | Install `prisma` and `@prisma/client`. Set up local PostgreSQL (Docker compose or local install). Configure `DATABASE_URL` in `.env`. Create `prisma/schema.prisma` with `provider = "postgresql"`. | `npx prisma db push` succeeds |
| 2.1.2 | ✅ **Core schema models** | Define all models from `DATABASE_SCHEMA_PLAN.md` §1–§2: `User`, `Session`, `Role`, `UserRole`, `Category`, `Product`, `ProductVariant`, `ProductImage`, `ProductVideo`, `ProductDownload`, `ProductRelation`. Include all FK relationships, enums, indices. Set `id` to `cuid2`, add `createdAt`/`updatedAt`/`deletedAt` on user-facing entities. Money as `BigInt` + currency enum. | `npx prisma generate` succeeds, zero errors |
| 2.1.3 | ✅ **CMS schema models** | Define models from §6–§7: `BlogPost`, `BlogCategory`, `Newsletter`, `MediaAsset`, `AiPrompt`. Include FTS index setup (`pg_trgm`, `tsvector`). | `npx prisma generate` succeeds |
| 2.1.4 | ✅ **Operations schema models** | Define `AuditLog` and `SystemSetting` from §8. `AuditLog` is append-only (no update/delete grants). `SystemSetting` is key-value with JSON value. | Schema compiles |
| 2.1.5 | ✅ **Run migrations + seed** | `npx prisma migrate dev --name init`. Create `prisma/seed.ts` with: default roles (`super_admin`, `content_admin`, `support_admin`, `sales_admin`), one admin user, sample categories, 6–8 products migrated from Phase 1 seed data, 3 blog posts, sample media assets. | Seed data appears in `prisma studio` |
| 2.1.6 | ✅ **Prisma client singleton** | Create `server/db.ts` — module-level `PrismaClient` with `globalThis` guard for hot reload. Prisma 7 requires a driver adapter at runtime, so the singleton is wired with `@prisma/adapter-pg` + `pg` (added as dependencies). `import 'server-only'` was intentionally omitted because the package is not installed in this project and the file lives in `server/` (the project's server-only module dir). `DATABASE_URL` stays optional at the base env layer; the connection opens lazily on first query and fails clearly if the URL is absent. | Import resolves, no duplicate clients, build + typecheck + lint pass |

---

## Category 2.2 — Admin Auth & RBAC

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.2.1 | ✅ **Choose auth provider (decision only)** | Compare Auth.js, Clerk, and custom auth against: App Router compatibility, Prisma/PostgreSQL fit, RBAC support, session storage, email/OAuth support, local-dev ergonomics, long-term cost, vendor lock-in, and South Asia availability. Record the final decision in `docs/07_DECISIONS.md` and update relevant docs. No package install, code, routes, middleware, or UI in this step. | Decision recorded; next implementation step is unambiguous |
| 2.2.2 | ✅ **Auth provider install + base config** | Replaced the initial Auth.js base (incompatible with ARIOT's custom field names) with **Better Auth** (decision D-035). Installed `better-auth`, created `server/auth.ts` + `app/api/auth/[...all]/route.ts`, mapped custom fields, added `emailVerified`/`Session.updatedAt` + redesigned `Account`/`Verification` models. Typecheck/lint/build/validate/generate PASS. Better Auth migration `20260710081202_auth_better_auth_foundation` GENERATED + APPLIED to LOCAL dev DB; runtime DB smoke test PASSED on local dev DB. I-018 resolved for this step; residual generated-column drift tracked as I-019. | Provider config imports, typecheck/lint/build/validate/generate pass; migration applied (local) + runtime DB verified (local) |
| 2.2.3 | ✅ **Session creation + auth UI shell** | Google OAuth provider via Better Auth `socialProviders.google` (clientId/secret from typed `server/env.ts`, `disableSignUp: true`, identity-only scopes `openid`/`email`/`profile`, no One Tap). Shared Better Auth React client at `lib/auth-client.ts`. Sign-in route `app/(auth)/sign-in/page.tsx` (server) + `sign-in-form.tsx` (client): "Admin sign in" heading, internal-access note, "Continue with Google" button, loading/error/provider-unavailable states, safe `?error=` mapping, return-to-site link. Removed `trustHost`; explicit `baseURL` + `trustedOrigins`. Minimal `getSession()` server helper (authn only, no RBAC). No schema/migration change. | Google is the only provider; public signup disabled; session established server-side; provider-unavailable state verified (HTTP 200) |
| 2.2.4 | ✅ **Server-side RBAC guardrails** | Created `server/auth/errors.ts` (typed `AuthenticationError` 401 / `AuthorizationError` 403, no NextResponse). Created `server/auth/permissions.ts`: `AuthorizationContext` interface; `getAuthorizationContext()` (null for anonymous/inactive/deleted); `requireAuthenticatedUser()`; `requireRole()` (ANY semantics); `requirePermission()` (ALL semantics) + `requireAnyPermission()` (ANY semantics). Enforces `User.status === ACTIVE` and `deletedAt === null`. Deduplicates roles and permissions via DB query (no N+1). Discovery: seed assigns `"*"` to SUPER_ADMIN — handled as a wildcard passing all permission checks. `getSession()` updated to accept optional `Headers`. No schema/migration change. Fully server-side; no middleware, no admin routes, no client auth checks. | Unauthorized server-side; unauthenticated 401; wrong-role 403; ACTIVE-user-only enforcement |
| 2.2.5 | ✅ **Secure admin bootstrap** | Offline CLI script `scripts/bootstrap-admin.ts` + `pnpm admin:bootstrap`. Idempotent: creates or reuses a User by normalized email, assigns existing SUPER_ADMIN role, writes a system AuditLog event; no password, no Account, no Session created. Dry-run by default; writes require `--apply`; non-local DB requires `--apply --production`. Validated with Zod: `BOOTSTRAP_ADMIN_EMAIL` (normalized), `BOOTSTRAP_ADMIN_CONFIRM` (must be `GRANT_SUPER_ADMIN`), `BOOTSTRAP_ADMIN_NAME` (optional). `emailVerified` set to `true` on creation (operator-confirmed). Better Auth `accountLinking` configured for implicit linking on matching verified Google email. OAuth tokens encrypted at rest (`encryptOAuthTokens: true`). No schema/migration change. Local verification: dry-run→no writes; apply→user+role+audit created; re-apply→no-op for user/role, new audit; cleanup→counts restored. | Admin can sign in with Google at /sign-in; SUPER_ADMIN role requires pre-existing seed; no public setup endpoint |

### Category 2.2 weak-agent guardrails

- Do not implement auth before Step 2.2.1 records the provider decision.
- Do not use custom password auth unless explicitly approved after the provider decision.
- Do not store plaintext passwords, password hashes, session tokens, OAuth secrets, or real credentials in docs, `.env.example`, seeds, or committed code.
- Do not expose admin data behind client-side-only auth checks.
- Do not create `(admin)` pages that can render protected data before Step 2.2.4 server-side guards exist.
- Do not add middleware unless the chosen provider and session strategy require it; prefer the smallest server-side guard that proves the security boundary.
- Each 2.2.x step must end with `typecheck`, `lint`, `build`, and a note about what was not tested.

---

## Category 2.3 — Admin Shell

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.3.1 | ✅ **Admin layout** | Build `app/(admin)/layout.tsx` — RBAC gate in server component (redirect to sign-in if unauthorized). Shell: top bar (logo, breadcrumb, search, notifications, profile), left rail nav (Overview, Catalog, Sales, Support, Content, Operations, Settings), main content area. Mobile: left rail becomes drawer. | Layout renders, unauthorized users redirected |
| 2.3.2 | ✅ **Admin navigation** | Build admin sidebar nav with grouped links: Overview (`/admin`), Catalog (Products, Categories), Sales (Orders, Quotes, Customers), Support (Tickets, Articles), Content (Blog, Media), Operations (Users, Roles, Audit Log), Settings. Active state detection. Collapse/expand groups. | All nav links resolve |
| 2.3.3 | ✅ **Admin theme & density** | Apply design tokens from `DESIGN_SYSTEM.md` in denser variant: 40px row height, 16px gutter (comfortable mode), 32px/12px (compact mode toggle). Status chips use semantic tokens. No emoji icons — Lucide only. | Theme renders, density toggle works |
| 2.3.4 | ✅ **Notifications panel** | Build notifications dropdown in top bar — new orders, SLA breaches, payment failures, system alerts. Stubbed for now (empty state: "No new notifications"). Real data in Phase 3. | Panel opens, empty state renders |

---

## Category 2.4 — Product & Category CRUD

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.4.1 | ✅ **Shared data table component** | Build `components/admin/data-table.tsx` — server-side pagination (cursor-based), sort, filter. Row click opens detail. Keyboard nav (arrows + enter). Density-aware (comfortable/compact). Empty state teaches. Loading: skeleton rows. | Table renders with mock data, pagination works |
| 2.4.2 | ✅ **Admin products list** | Build `app/(admin)/admin/products/page.tsx` — data table with: image thumb, name, SKU, category, status chip, stock, price (BDT primary, USD parenthetical), updatedAt, actions menu. Filters: status, category, sales type, low-stock, has-image. Bulk actions: publish, unpublish, archive. "New product" CTA. | List renders, filters work, bulk actions work |
| 2.4.3 | ✅ **Product editor — Details tab** | Build `app/(admin)/admin/products/[id]/page.tsx` with tabbed editor. Tab 1: name, slug (auto from name, editable, redirect on change post-publish), tagline, description (MDX editor with preview), category dropdown, sales type, status, brand, base price, currency, stock, stock policy, weight, dimensions, highlights (list editor), in-the-box (list editor). Auto-save drafts every 30s. | Form renders, fields validate, auto-save works |
| 2.4.4 | ✅ **Product editor — Media tab** | Tab 2: image gallery (sortable drag, primary toggle, alt text per image), video gallery (with poster), 3D model upload placeholder. All uploads via signed URL (`/api/uploads/sign`). Replace flow: keep stable ID, swap file. **STORAGE-1R (D-067) + media storage provider abstraction with local default (D-068) implemented 2026-08-18**: media tab + existing-media selector done; secure R2 upload flow done (initiate/presigned PUT/complete, token-bound, same-user gate, file-signature check, ETag-bound promote, immutable public key, transactional MediaAsset + AuditLog); **`MEDIA_STORAGE_PROVIDER=local` is the working default** — local multipart route `/api/admin/media/uploads/local`, server-resolved mode route, health route, public delivery `/media/[...segments]` (Range + immutable cache), provider-agnostic client; `persistCompletedAsset` refactored to provider-neutral `PersistPayload` + `cdnUrl`. Verified: **238/239 node:test pass** (1 opt-in R2 smoke skipped) across 18 files; `tsc`/`eslint` (0 warnings)/`next build` (59 routes) green; no schema/migration change. See `docs/06_PROGRESS_LOG.md` row `2.4.4-local`. | Upload works, gallery reorders — verified via local provider smoke test (always-on); R2 live smoke optional (I-027, R2-only) |
| 2.4.5 | ✅ **Product editor — Variants tab** | Tab 3: option groups (Color, Voltage, etc.), variant matrix, per-variant SKU, price, stock, barcode. Add/remove variants. | Variant matrix renders, per-variant data saves | ✅ Closed (2026-08-18): `/admin/products/[id]/variants` + `POST /api/admin/products/variants` (create/update/archive dispatch); free-form `optionValues` (trimmed, ≤20 keys, order-independent combination uniqueness), SKU normalized uppercase + global unique (incl. archived), `Product.updatedAt` concurrency (409 on stale), soft-delete archive (idempotent, SKU reserved), AuditLog per mutation, optimistic UI with conflict banner. **Final production-service verification** (2026-08-18): real executors tested against disposable PostgreSQL through the shared authorization boundary (wrapper+executor split, `variant-auth.ts`); I-028 fixed; default-variant invariant deferred (documented, no behavior invented). Verified: **376/376 node:test pass** (+73 across 22 files — 31 real-service PG + 67 variant schema incl. lifecycle-field matrix + 36 details incl. I-028) + 1 opt-in R2 smoke skip; `tsc`/`eslint` (0 warnings)/`next build` (62/62 static pages) green; no schema/migration change. See `docs/06_PROGRESS_LOG.md` row `2.4.5-variants`. |
| 2.4.6-0 | ✅ **UTC Timestamp Infrastructure Correction + Inventory architecture (decision-only)** | Centralize every ARIOT PostgreSQL session to UTC (PrismaPg + raw pg via `utcPoolConfig` `-c timezone=UTC`); dev DB default UTC; health/invariant check; timestamp round-trip tests; record D-070 + approved inventory decisions (D-071–D-077); correct ECOMMERCE_PLAN negative-BACKORDER language. NO inventory implementation, NO schema/migration change, NO stock mutation, NO historical timestamp rewrite. | App sessions UTC; `SHOW TimeZone=UTC` on new sessions; Prisma/pg/DB-default round trips agree; I-029 runtime-mitigated (historical local-data review pending); full suite 413/412 pass + 1 R2 skip. | ✅ Completed (2026-08-29): `server/db-timezone.ts` `utcPoolConfig`, `server/db.ts` PrismaPg UTC, `server/db-health.ts` + `app/api/admin/health/database/route.ts`, `scripts/set-database-timezone-utc.ts`, 7 test files re-pinned to UTC, `tests/database-timezone.test.ts` + `tests/db-timezone-config.test.ts` (36 tests). D-070 UTC policy + D-071–D-077 inventory architecture recorded; ECOMMERCE_PLAN §7 corrected. `prisma validate`/`generate` ✅ · `typecheck` 0 · `lint` 0 · `build` ✅. Next sub-step: **2.4.6A1** (Inventory mutation surface). |
| 2.4.6A1 | ✅ **Inventory Mutation Surface** | The ONLY stock-mutation path: `server/admin/inventory/adjust-inventory-executor.ts` (product/variant authority per D-072, `SELECT … FOR UPDATE` transaction, D-071 negative guard, `INVENTORY_ADJUSTED` audit row), `list-inventory-executor.ts` (authority-resolved rows), `adjustInventoryRequestSchema` (strict, `reason` required/bounded, `note` bounded), `inventory-auth.ts` (`inventory.read`/`inventory.adjust`), `app/api/admin/inventory/route.ts` (GET list / POST adjust), `/admin/inventory` page + client `inventory-table.tsx` (adjust dialog) + skeleton + nav leaf. Enforce D-073: variant editor Stock input read-only, variant create inits `stock:0`, variant update executor + `detectChanges` no longer write/compare `stock`. RBAC wired in `permission-catalog.ts`, `reconcile-role-permissions.ts`, `prisma/seed.ts` (D-074 matrix: SUPER_ADMIN `*`, CONTENT_ADMIN/SALES_ADMIN `inventory.read` only, SUPPORT_ADMIN neither). | Stock adjusts only via Inventory; variant stock immutable via variants; negative rejected; audit written on success; read-only roles see list; unauthorized cannot adjust; tests green | ✅ Completed (2026-08-29): see `docs/06_PROGRESS_LOG.md` row `2.4.6A1`. No schema migration (stock columns + string `AuditLog.action` already exist). `typecheck` 0 · `lint` 0 · `build` ✅ · full suite **437/436 pass** (1 opt-in R2 smoke skip) across **26 files**. |
| 2.4.6A3 | ✅ **StockMovement ledger** | Immutable stock-movement history (D-075). New `StockMovement` model (append-only; `productId`/`variantId` scalar strings; DB trigger `stock_movement_immutable` rejects UPDATE/DELETE). Every successful adjustment in `adjust-inventory-executor.ts` writes one `StockMovement` (quantityBefore/After/deltaQty/reason/note/createdBy) inside the same `SELECT … FOR UPDATE` transaction as the stock update + `AuditLog` (D-077). New `list-movements-executor.ts` + `list-movements.ts` + `GET /api/admin/inventory/movements` (cursor pagination, `inventory.read`). `/admin/inventory` UI gains a read-only History dialog (DataTable) per product/variant. Distinct from `AuditLog` (ledger vs security trail). | Movement created on every successful adjust; immutable; archived-product history preserved; history queryable by any `inventory.read` role | ✅ Completed (2026-08-29): see `docs/06_PROGRESS_LOG.md` row `2.4.6A3`. Migration `20260829000100_add_stock_movement` applied. `typecheck` 0 · `lint` 0 · `build` ✅ · full suite **450/449 pass** (1 opt-in R2 smoke skip) across **27 files**. |
| 2.4.6 | **Product editor — Inventory, SEO, Related, Downloads, History tabs** | Tab 4: current stock, reorder point, reorder quantity, stock movements log (read-only). Tab 5: meta title, description, OG image override, canonical override. Tab 6: related, cross-sell, accessory, alternative selectors. Tab 7: datasheet, manual, quickstart, CAD, firmware uploads. Tab 8: audit log scoped to this product. | All tabs render, data saves |
| 2.4.7 | **Categories management** | Build `app/(admin)/admin/categories/page.tsx` — tree view with drag-to-reorder. Edit drawer: name, slug, description, hero image, SEO, parent. Create/delete with confirmation. | Tree renders, drag reorder works |
| 2.4.8 | **Server actions for products** | Create `features/product/actions.ts` — `createProduct`, `updateProduct`, `deleteProduct`, `publishProduct`, `unpublishProduct`. Each: Zod validate, RBAC check, DB write, audit log entry, `revalidateTag('product:<slug>')`. Optimistic UI for low-risk updates (toggle published). | Actions execute, audit log records |
| 2.4.9 | **Server actions for categories** | Create `features/product/category-actions.ts` — `createCategory`, `updateCategory`, `deleteCategory`, `reorderCategories`. Same pattern: validate, RBAC, DB, audit, revalidate. | Actions execute correctly |

---

## Category 2.5 — Blog CRUD

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.5.1 | ✅ **Admin blog list** (L3) | `app/(admin)/admin/blog/page.tsx` — cursor-paginated DataTable: cover, title, category, status chip, author, publishedAt/updatedAt, action menu for edit. `blog.read` RBAC. SEO: `<meta name="robots" content="noindex">`.  **Built 2026-09-01**. | List renders ✅ 14/14 integration tests |
| 2.5.2 | ✅ **Blog editor** (L3) | `components/admin/blog/blog-editor.tsx` — fields: title, slug (auto from title), excerpt, body (Markdown, not MDX), category, cover image, status, publishedAt, SEO title/description. Strict Zod schema, unknown-fields rejected, slug deduplication, optimistic concurrency (`expectedUpdatedAt`), server-derived author. `/admin/blog/page.tsx` create mode, `/[id]/page.tsx` edit mode. `BlogPost` on update. **Built 2026-09-01**. | Editor renders ✅ |
| 2.5.3 | ⬜ **Blog categories** | Build `app/(admin)/admin/blog/categories/page.tsx` — tree edit, slug, description, SEO. Same pattern as product categories. `[future]`. | Categories render |
| 2.5.4 | ✅ **API + service + audit for blog** (L3) | `POST /api/admin/blog` (create); `POST /api/admin/blog/[id]` (update/publish/unpublish). `server/admin/blog/` — Zod schema, authorized wrapper, create + update executors, list (cursor-paginated), get for editor. Audit: `BLOG_POST_CREATED`, `BLOG_POST_UPDATED`, `BLOG_POST_PUBLISHED`, `BLOG_POST_UNPUBLISHED` — only on actual success, no body dump. `revalidatePath` on `/blog`, `/`, `/robotics`, `/research`, `/solutions`, detail slug. **Built 2026-09-01**. | Actions execute ✅ |

---

## Category 2.6 — Media Library

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.6.1 | **Media library page** | Build `app/(admin)/admin/media/page.tsx` — grid view + table view toggle. Filters: kind (image/video/document/firmware/3D), folder, tag, isPublic, uploadedBy, date range. Bulk actions: move folder, tag, archive, delete (super_admin only). | Library renders |
| 2.6.2 | **Upload & detail** | Drag-drop upload + button upload — signed URL via `/api/uploads/sign`. Detail drawer: preview, alt text, caption, source AI prompt link, usage map (where this asset is referenced). Replace flow: keep ID, swap file with version history. | Upload works, detail shows |
| 2.6.3 | **Storage adapter** | Build `server/storage/` — adapter interface. Phase 2: local filesystem adapter (`.local/media/`, gitignored). Signed URL generation. MIME + size validation server-side. Future: S3/R2 swap. | Signed URLs generate, files stored locally |
| 2.6.4 | **Upload sign endpoint** | Build `app/api/uploads/sign/route.ts` — POST with MIME + size, validate against allow-list, return pre-signed PUT URL. Rate-limited. | Endpoint accepts requests, returns signed URL |

---

## Category 2.7 — Public Pages → Database

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.7.1 | **Product pages from DB** | Refactor `/products`, `/products/[slug]`, `/products/category/[slug]` to read from Prisma instead of seed data. Use `unstable_cache` with `revalidateTag('product:<slug>')`. ISR with 60s revalidation. | Product pages render from DB data |
| 2.7.2 | ✅ **Blog pages from DB** (L3) | `/blog` and `/blog/[slug]` read from published `BlogPost` via `server/public/blog.ts`. Drafts/archived excluded; `notFound()` on missing slug; `BlogPosting` JSON-LD + real metadata; Markdown body (no MDX execution). **Built 2026-09-01**. | Blog pages render from DB ✅ |
| 2.7.3 | ⬜ **Solutions & Support from DB** | Solutions keeps static core (L3 adds only an IoT updates section from published posts); support articles remain static. | Pages render from DB or static |
| 2.7.4 | ✅ **On-demand revalidation** (L3) | Admin blog create/update call `revalidatePath` on `/blog`, `/`, `/robotics`, `/research`, `/solutions` and the affected detail slug. Public pages use `revalidate = false` (indefinite ISR) → new posts appear immediately, no full rebuild. **Built 2026-09-01**. | Admin changes propagate ✅ |

---

## Category 2.8 — Admin Operations

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.8.1 | **Admin users list** | Build `app/(admin)/admin/users/page.tsx` — table of admin users. Invite via email. Assign roles. Disable/reactivate. Password reset trigger. | List renders, invite flow works |
| 2.8.2 | **Roles management** | Build `app/(admin)/admin/roles/page.tsx` — role list with permission matrix editor (super_admin only). Visual grid of permissions × roles. | Permission matrix renders |
| 2.8.3 | **Audit log viewer** | Build `app/(admin)/admin/audit-log/page.tsx` — filterable table: actor, action, entityType, entityId, ipHash, createdAt. Detail drawer with before/after JSON diff (super_admin only). Export CSV. | Audit log entries appear on mutations |
| 2.8.4 | **Audit log integration** | Ensure every server action in 2.4–2.6 writes an `AuditLog` row. Verify: create product → audit shows `actor`, `action: product.create`, `entityType: Product`, `entityId`, `before: null`, `after: <snapshot>`. | Audit entries match mutations |

---

## Category 2.9 — Settings & Storage

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.9.1 | **Settings page** | Build `app/(admin)/admin/settings/page.tsx` — sectioned: Site (name, default SEO, default OG, contact emails), Feature flags (env-driven toggles). More sections in Phase 3 (currencies, taxes, shipping, payments). | Settings page renders |
| 2.9.2 | **Media library — folders & tags** | Implement folder tree in media library. Tag management. Drag-drop to move assets between folders. | Folders and tags work |
| 2.9.3 | **Overview KPI dashboard** | Build `app/(admin)/admin/page.tsx` — KPI cards: total products, published products, total blog posts, published posts, total media assets, recent admin actions. Content-focused KPIs only (sales KPIs in Phase 3). Activity feed from audit log (last 20 actions). | Overview renders with content KPIs |

---

## Phase 2 — Dependency Graph

```
2.1.1 ──► 2.1.2 ──► 2.1.3 ──► 2.1.4 ──► 2.1.5 ──► 2.1.6
                                                │
                              ┌─────────────────┤
                              ▼                 ▼
                        2.2.1–2.2.5        2.6.3–2.6.4
                        (Auth & RBAC)      (Storage adapter)
                              │
                    ┌─────────┤
                    ▼         ▼
              2.3.1–2.3.4  2.8.1–2.8.4
              (Admin shell) (Operations)
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
  2.4.1–2.4.9  2.5.1–2.5.4  2.6.1–2.6.2
  (Products)    (Blog)       (Media library)
        │           │           │
        └───────────┼───────────┘
                    ▼
            2.7.1–2.7.4
            (Public → DB)
                    │
                    ▼
            2.9.1–2.9.3
            (Settings & KPIs)
```

## Phase 2 — Critical Path

```
2.1.1 → 2.1.2 → 2.1.5 → 2.1.6 → 2.2.1 → 2.2.2 → 2.2.3 → 2.3.1 → 2.4.1 → 2.4.3 → 2.4.8 → 2.7.1 → 2.7.4 → DONE
```

## Phase 2 — Step Count by Category

| Category | Steps | Parallelism |
|----------|-------|-------------|
| 2.1 Database Setup | 6 | Sequential |
| 2.2 Auth & RBAC | 5 | Sequential (after 2.1) |
| 2.3 Admin Shell | 4 | Sequential (after 2.2) |
| 2.4 Product CRUD | 9 | Parallel with 2.5, 2.6 |
| 2.5 Blog CRUD | 4 | Parallel with 2.4, 2.6 |
| 2.6 Media Library | 4 | Parallel with 2.4, 2.5 |
| 2.7 Public → DB | 4 | Sequential (after 2.4, 2.5) |
| 2.8 Operations | 4 | Parallel with 2.4, 2.5 |
| 2.9 Settings | 3 | Last |
| **TOTAL** | **43** | |

---

## Phase 2 — Final Checklist

Before crossing into Phase 3, verify:

- [ ] `super_admin` can create, edit, publish, unpublish, archive products end-to-end
- [ ] `super_admin` can create, edit, publish blog posts with MDX editor + preview
- [ ] `content_admin` can manage products and blog but NOT orders, roles, or settings
- [ ] Media library: upload, organize, replace, view usage map
- [ ] Public product pages read from DB, update within 60s of admin publish
- [ ] Public blog pages read from DB, update within 60s of admin publish
- [ ] Audit log captures every mutation with actor, action, entity, before/after
- [ ] On-demand revalidation works on all entity mutations
- [ ] Session management: sign-in, sign-out, session expiry
- [ ] RBAC enforced server-side on all admin routes and actions
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm build` — succeeds
- [ ] No `any` types in new code
- [ ] All server actions validate input with Zod
- [ ] All mutations write to AuditLog
- [ ] Storage adapter works (local filesystem)
- [ ] Signed URL uploads work
- [ ] Overview KPI dashboard shows content metrics
- [ ] Release note created at `docs/RELEASES/<date>.md`

---

**Phase 2 Status**: Defined — 43 steps across 9 categories (2.1–2.9)  
**Phase 2 Extended (post-planning freeze)**: see Categories 2.10–2.16 and Corrective Steps C.1–C.2 below.  
**Phase 2 critical path**: ~13 steps (DB → Auth → Admin shell → Product CRUD → Public → DB)  
**Phase 2 parallel capacity**: 3 workstreams (Products, Blog, Media)

---

## Corrective Steps — Pre-Schema-Change Blockers

These must be completed **before** any new Prisma migration is run.

| # | Step | Details | Validates |
|---|------|---------|-----------|
| C.1 | **Resolve permission wildcard mismatch** ✅ | All namespace wildcards (`products.*`, `categories.*`, etc.) replaced with explicit permission strings in seed and live database. Central permission catalog at `server/auth/permission-catalog.ts`. Pure evaluators `hasPermission`/`hasAllPermissions`/`hasAnyPermission`. Reconciliation CLI `scripts/reconcile-role-permissions.ts` (dry-run default, --apply writes, --production for non-local). 36 focused tests. CONTENT_ADMIN now satisfies `products.read`. SUPER_ADMIN retains `"*"`. No schema/migration change. Decision D-063. | CONTENT_ADMIN can access product list ✅ |
| C.2 | **Resolve I-019 generated-column drift** ✅ | `searchVector Unsupported("tsvector")` on `Product` and `BlogPost` caused `ALTER ... DROP DEFAULT` errors in future `migrate dev` runs. **RESOLVED** (2026-07-10; final verification 2026-07-25): columns and GIN indexes dropped, schema updated, corrective migration applied. 4-way Prisma diff clean; disposable `migrate dev --create-only` probe proved future migrations work. Stable backup at `C:\Users\princ\backups\ariot\ariot_pre_c2_20260725_201317.dump`. | `prisma migrate dev` succeeds on a clean test DB ✅ |

---

## Category 2.10 — R&D Project Management

*Depends on: 2.4 (Product CRUD), C.1, C.2*

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.10.1 | **RdProject schema** | Add `RdProject`, `RdUpdate`, `RdMilestone` to Prisma schema. Fields: id, slug, title, description, status (CONCEPT/ACTIVE/PAUSED/COMPLETED), isPublic, SEO, createdAt, updatedAt, deletedAt, createdBy, updatedBy. `RdUpdate`: id, projectId, title, body (MDX), publishedAt, isPublic. | Schema generates |
| 2.10.2 | **R&D projects list** | Build `/admin/rd/projects` — DataTable of R&D projects: title, status chip, isPublic, updatedAt. Filters: status, isPublic. | List renders, filters work |
| 2.10.3 | **R&D project editor** | Build `/admin/rd/projects/[id]` — tabs: Details (title, slug, description, status, isPublic), Updates (sub-list), Milestones (public timeline), SEO, History. | Editor renders, saves |
| 2.10.4 | **R&D updates management** | Build `/admin/rd/updates` — create/edit project updates. MDX editor + preview. Publish to public `/research` page. | Updates published, public page reflects |
| 2.10.5 | **Server actions for R&D** | `createProject`, `updateProject`, `publishUpdate`, `archiveProject`. RBAC: `rd.write`. Audit log. `revalidateTag('rd:*')`. | Actions execute, audit records |

---

## Category 2.11 — Structured Homepage CMS

*Depends on: 2.4, 2.10, C.1, C.2*

The homepage must be fully editable without arbitrary HTML injection. All sections are structured fields — no WYSIWYG free-text for layout.

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.11.1 | **HomepageConfig schema** | Add `HomepageConfig` (singleton), `HomepageSection` (ordered list of typed sections), `HomepageRevision` (history). Fields per section: sectionType (enum), enabled, order, eyebrow, heading, description, imageId, ctaLabel, ctaHref, featuredEntityIds, bgStyle, publishedAt, draftData (JSON). | Schema generates |
| 2.11.2 | **Homepage sections editor** | Build `/admin/content/homepage` — drag-to-reorder sections list. Per-section drawer: structured fields matching the public section type. Preview link. Draft/publish toggle. | Editor renders, reorder works |
| 2.11.3 | **Homepage publish workflow** | Draft → Preview → Published → Scheduled. Revision history with rollback. Diff view (before/after JSON). Super-admin can rollback. | Publish/preview/rollback works |
| 2.11.4 | **Public homepage reads HomepageConfig** | Refactor `app/(marketing)/page.tsx` to read from `HomepageConfig` instead of `_home-content.ts`. ISR with `revalidateTag('homepage')`. | Public homepage reflects admin changes |

---

## Category 2.12 — Central Promotions Engine

*Depends on: 2.11 (homepage CMS), C.1, C.2*

One promotion system serves all public pages. Pages do not manage their own promotion content.

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.12.1 | **Promotions schema** | Add `Promotion`, `PromotionPlacement`, `Coupon`, `CouponRedemption` to Prisma schema. See `DATABASE_SCHEMA_PLAN.md §2.12`. | Schema generates |
| 2.12.2 | **Promotions admin list** | Build `/admin/promotions` — DataTable: name, type, status chip, placement, startAt, endAt, actions. Filters: status, placement, type. | List renders |
| 2.12.3 | **Promotion editor** | Build `/admin/promotions/[id]` — all fields: title, description, badge, image, CTA, discount type, value, coupon code, placements, schedule, terms, stackable toggle, status. Preview placement. | Editor saves, preview renders |
| 2.12.4 | **Coupon management** | Build `/admin/promotions/coupons` — coupon codes: code, type, discount, usageLimit, redemptions count, expiry, status. Bulk generate. | Coupons create, redeem counters update |
| 2.12.5 | **Promotion placement rules** | Build `/admin/promotions/placements` — per-placement priority rules, limits, conflicts. | Placement rules apply correctly |
| 2.12.6 | **Public promotion query service** | Build `server/promotions/query.ts` — `getActivePromotions(placement)`. Returns promotions valid for the current time, ordered by priority. Cached with `revalidateTag('promotions')`. | Active promotions returned correctly |
| 2.12.7 | **Public pages consume promotions** | Inject `getActivePromotions` into homepage, workspace, components, product detail pages via their section renderers. No per-page hardcoding. | Promotions render on public pages |

---

## Category 2.13 — Workspace Plans & Online Booking

*Depends on: 2.12 (promotions), C.1, C.2*

Booking implemented in three stages. Stage 1 launches a minimal viable flow; Stages 2–3 add payment and resource management.

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.13.1 | **Workspace schema — Plans & Resources** | Add `WorkspacePlan`, `WorkspaceResource`, `WorkspaceFacility` to Prisma. Plan fields: id, slug, name, description, durationType (HOURLY/DAILY/WEEKLY/MONTHLY), durationMinutes, priceMinor, currency, capacity, includedFacilities (JSON), supportLevel, terms, isActive, isPublic, seoTitle, seoDescription. | Schema generates |
| 2.13.2 | **Workspace schema — Booking** | Add `Booking`, `BookingResource`, `AvailabilityRule`, `BlackoutPeriod` to Prisma. Booking fields: id, reference, customerId, planId, date, startTime, endTime, participants, priceMinor, discountMinor, promotionId, couponId, finalPriceMinor, paymentStatus (enum), bookingStatus (enum), customerNote, internalNote, termsAccepted. | Schema generates |
| 2.13.3 | **Plans management** | Build `/admin/workspace/plans` — DataTable + plan editor. Create/edit plan, set pricing, capacity, facilities. | Plans CRUD works |
| 2.13.4 | **Facilities management** | Build `/admin/workspace/facilities` — equipment/resource list, availability status, maintenance flag. | Facilities list renders |
| 2.13.5 | **Availability rules** | Build `/admin/workspace/availability` — set business hours, working days, slot durations, holiday blackouts, maintenance windows. | Availability query returns correct slots |
| 2.13.6 | **Bookings admin list** | Build `/admin/workspace/bookings` — DataTable: reference, customer, plan, date/time, status, payment status, actions. Filters: status, payment, date range. | List renders with real booking data |
| 2.13.7 | **Booking calendar view** | Build `/admin/workspace/calendar` — week/month calendar view of confirmed bookings. Click slot → booking detail. | Calendar renders bookings |
| 2.13.8 | **Interest registrations** | Build `/admin/workspace/interests` — list of interest registrations from `/workspace` page. Convert to booking button. | List renders |
| 2.13.9 | **Stage 1: Public booking flow** | Build `/workspace/book` — availability search, plan selection, time slot selection, customer details form, booking request submission (status: PENDING). Admin manually confirms. Email notification to customer and admin. | Booking request created, emails sent |
| 2.13.10 | **Stage 2: Online payment** | Add payment integration to booking flow. Support bKash/Nagad for workspace bookings. Real-time confirmation. Reschedule/cancel flow. Refund where applicable. | End-to-end booking + payment works |

---

## Category 2.14 — Component Catalog & Inventory

*Depends on: 2.4 (Product CRUD), C.1, C.2*

Components use the same `Product` model but are distinguished by category. No duplicate catalog system needed.

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.14.1 | **Component categories seed** | Ensure component-specific categories (development-boards, sensors, motors, robotics-modules, IoT-modules, power, tools, mechanical, education-kits) exist in DB. Update seed. | Categories exist |
| 2.14.2 | **Components admin list** | Build `/admin/components` — same DataTable as products, pre-filtered to component categories. Distinct "New Component" CTA. Reuses `ProductsTable` with category filter preset. | Components list renders |
| 2.14.3 | **Component editor** | Same editor as `/admin/products/[id]` — reuse all tabs. Route alias or shared component. | Editor works for components |
| 2.14.4 | **Inventory management** | Build `/admin/inventory` — stock overview: low-stock alerts, recent stock movements, reorder thresholds. Stock adjustment form (audit logged). | Inventory dashboard renders, adjustments save |
| 2.14.5 | **Stock movements schema** | Add `StockMovement` to Prisma: id, productId, variantId?, deltaQty, reason (enum: SALE/RETURN/ADJUSTMENT/IMPORT/WRITE_OFF), actorId, note, createdAt. | Stock movements record on adjustments |

---

## Category 2.15 — SEO Management

*Depends on: 2.7 (Public → DB), C.1, C.2*

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.15.1 | **SEO overview** | Build `/admin/seo` — list of all public routes with their current SEO metadata: title, description, canonical, index/noindex, OG image. Highlight missing or duplicate SEO fields. | Overview renders, missing SEO flagged |
| 2.15.2 | **Per-page SEO editor** | Inline SEO editing for product, blog, category, solution, support article pages. Tab already planned in product editor. Consolidate into shared `SeoTab` component. | SEO fields save, public pages reflect them |
| 2.15.3 | **Redirects management** | Build `/admin/seo/redirects` — create/edit URL redirects: from, to, statusCode (301/302/307). Implemented as middleware or `next.config` redirect entries. | Redirects apply on navigation |
| 2.15.4 | **Global SEO settings** | Extend Settings page: default title pattern, default OG image, organization JSON-LD override, sitemap inclusion toggle per route type. | Global settings apply to public metadata |

---

## Category 2.16 — Content Expansion

*Depends on: 2.11 (Homepage CMS), 2.5 (Blog), C.1, C.2*

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 2.16.1 | **News content type** | Extend `BlogPost` with `contentType` enum (BLOG/NEWS/ANNOUNCEMENT/RD_UPDATE) or use a separate `NewsPost` model. Build `/admin/content/news` — same editor as blog, distinct list + category. | News posts publish to public /news or /blog |
| 2.16.2 | **Custom pages** | Add `Page` model: id, slug, title, sections (JSON structured sections, similar to homepage), status, SEO. Build `/admin/content/pages` — list + per-page structured editor. | Custom pages render at their slugs |
| 2.16.3 | **Navigation management** | Build `/admin/content/navigation` — manage header/footer nav items: label, href, order, parent, icon, visibility rules. DB-backed instead of hard-coded. | Navigation updates reflect on public site |
| 2.16.4 | **FAQ management** | Build `/admin/content/faqs` — FAQ list with category, question, answer (MDX), order, published flag. Consumed by support page, product pages, workspace page. | FAQs render on public pages |

---

## Phase 2 Extended — Dependency Graph (New)

```
C.1 (Permission fix) ──► C.2 (I-019 fix) ─────────────────────────────────────┐
                                                                                │
2.4 (Products) ──────────────────────────────────────────┐                     │
                                                         ▼                     ▼
2.5 (Blog) + 2.6 (Media) + 2.7 (Public→DB) ──► 2.10 (R&D) ──► 2.11 (HomeCMS) ──► 2.12 (Promotions) ──► 2.13 (Booking)
                                                         │
                                                         ├──► 2.14 (Components/Inventory)
                                                         └──► 2.15 (SEO) ──► 2.16 (Content)
```

---

# PHASE 3 — Ecommerce

Phase 3 implementation roadmap — **Ecommerce & Regional Payments**. Enable direct B2C purchases on selected SKUs, with bKash, Nagad, SSLCommerz, and Stripe scaffolded.

**Phase 3 Goal**: customers can browse, add to cart, checkout, and pay. Admin can fulfill orders. The full purchase lifecycle works end-to-end.

**Prerequisites**: Phase 2 complete and verified (all checklist items pass).

**Exit Criteria** (from `FEATURE_ROADMAP.md`):
- Successful end-to-end purchase via each enabled provider on staging
- Refund flow tested per provider
- Order emails delivered, formatted on the design system
- Lighthouse mobile ≥ 90 on `/products/:slug` and `/cart`
- Penetration-test pass focused on cart/checkout/auth
- Admin team can fulfill an order without spreadsheet help

---

## Category 3.1 — Ecommerce Schema & Cart Infrastructure

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 3.1.1 | **Ecommerce schema models** | Add to Prisma schema: `Cart`, `CartItem`, `Order`, `OrderItem`, `Payment`, `Shipment`, `Voucher` from `DATABASE_SCHEMA_PLAN.md` §3. Include `StockMovement` table. Add `Customer` extension of `User`. All money as `BigInt` + currency enum. Indices on all FKs and hot `where` columns. | `npx prisma generate` succeeds |
| 3.1.2 | **Cart server actions** | Create `features/cart/actions.ts` — `addToCart`, `updateQuantity`, `removeItem`, `applyVoucher`, `removeVoucher`, `setCurrency`, `clearCart`. Each: Zod validate, re-fetch product/variant for current price + stock, snapshot `unitPriceMinor` at add time, return updated cart with totals, `revalidateTag`. Guest cart keyed on signed `cartToken` cookie. | Actions execute, cart persists |
| 3.1.3 | **Cart components** | Build `components/shop/cart-line.tsx` (line item with quantity stepper, variant label, remove, save-for-later, line price BDT primary / USD secondary). Build `components/shop/cart-summary.tsx` (subtotal, shipping estimate, VAT, voucher input, total, primary CTA). Build `components/shop/price.tsx` (BDT primary, USD parenthetical, EMI hint). | Components render |
| 3.1.4 | **Cart page `/cart`** | Build `app/(shop)/cart/page.tsx` — two-column desktop (line items left, sticky summary right). Mobile: summary becomes sticky bottom bar. Empty state: "Your cart is empty. Browse featured products." "You might also like" 3-up grid below. `noindex`. | Page renders, empty + populated states |
| 3.1.5 | **Cart drawer** | Build `components/shop/cart-drawer.tsx` — slides in on add-to-cart with: item just added, mini-summary, "View cart" / "Checkout" buttons. Right-side slide, `--dur-3`. Closes on Escape / backdrop click. | Drawer opens, adds item, closes |
| 3.1.6 | **Voucher validation** | Implement voucher rules: active + within `validFrom`/`validUntil`, `minSubtotalMinor` met, `usageLimit` + `perCustomerLimit` not exceeded, currency matches for FIXED kind. Server returns structured error; UI shows human reason. | Voucher apply/remove works |

---

## Category 3.2 — Checkout Flow

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 3.2.1 | **Checkout page layout** | Build `app/(shop)/checkout/page.tsx` — single page, three logical sections streamed via `<Suspense>`. Header: logo, "Secure checkout" lock chip, support link. Compact footer. `noindex`. | Page renders, sections stream |
| 3.2.2 | **Section 1: Contact + Shipping** | Email (auto-filled if logged in), phone (E.164, BD default, required for COD), shipping address (BD default with district + postcode optional, relaxed for SA), billing same-as-shipping toggle, shipping method selection (derived from zone × weight × destination), save address checkbox (auth only). Zod validation per field. | Form renders, validation works |
| 3.2.3 | **Section 2: Payment tabs** | Tabs for enabled providers: bKash, Nagad, SSLCommerz, COD. Stripe scaffolded but disabled. Each tab renders provider's hosted iframe / redirect cue. No raw card data on our domain. Provider selection persists per-user preference. | Tabs render, provider selection works |
| 3.2.4 | **Section 3: Review** | Recomputed line items, address summary, shipping method, payment summary, voucher final state, total. Place-order CTA disabled until all sections valid. Trust strip: secure-checkout, return policy, support phone. | Review section renders |
| 3.2.5 | **Server-side checkout action** | Create `features/checkout/actions.ts` — `placeOrder`: validate cart, recompute prices server-side, lock stock (15-min reservation), create `Order` with status `CREATED`, initiate payment via provider adapter, transition to `AWAITING_PAYMENT`, create `Payment` row in `PENDING`. Returns redirect URL or iframe payload. Server-authoritative totals — mismatches rejected. | Checkout completes, order created |
| 3.2.6 | **Shipping zones & tax config** | Add admin settings sections: shipping zones (country/region mapping, methods, rates, free-ship thresholds), tax (VAT % per country, inclusive/exclusive). Store in `SystemSetting` or dedicated tables. Admin can configure via `/admin/settings`. | Settings save, checkout calculates correctly |
| 3.2.7 | **Currency support (BDT/USD)** | Implement BDT primary, USD secondary display everywhere. FX snapshot stored daily (admin-configurable). Orders placed in single canonical currency per cart. `lib/format/currency.ts` formatter. Currency switcher in cart + checkout. | Currency display correct, switcher works |

---

## Category 3.3 — Payment Adapters

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 3.3.1 | **Payment adapter interface** | Create `server/payments/types.ts` — `PaymentAdapter` interface: `createIntent`, `capture`, `refund`, `verifyWebhook`, `mapStatus`. Each adapter owns credentials (from `server/env.ts`), HTTP client with timeouts, status mapping, PII-scrubbed logging. | Interface compiles |
| 3.3.2 | **bKash adapter** | Build `server/payments/bkash/` — sandbox + production. Tokenized + checkout flows. Webhook via callback URL. Idempotency by `paymentID`. Map status to `PaymentStatus`. | Adapter handles create + verify |
| 3.3.3 | **Nagad adapter** | Build `server/payments/nagad/` — sandbox + production. Redirect-based flow. Signature verification. Idempotency by `orderId + paymentRefId`. | Adapter handles create + verify |
| 3.3.4 | **SSLCommerz adapter** | Build `server/payments/sslcommerz/` — covers cards + MFS. Session-based redirect. IPN webhook. Verify via API hash check. | Adapter handles create + verify |
| 3.3.5 | **COD adapter** | Synthetic adapter: no external call. Marks order `AWAITING_PAYMENT` with provider `MANUAL`. Ops mark paid on delivery. | COD order creates successfully |
| 3.3.6 | **Stripe scaffold** | Build `server/payments/stripe/` — Payment Intents API skeleton. Webhook signature verification. 3DS handled by Stripe. Disabled via feature flag. Scaffold only — not functional. | Scaffold compiles, disabled by default |
| 3.3.7 | **Webhook routes** | Build `app/api/payments/<provider>/webhook/route.ts` for each provider. Handler: read raw body, verify signature, check idempotency key (`WebhookEvent` table), map status → update `Payment` + `Order` in single transaction, emit domain event (`order.paid`, `order.failed`). Return 2xx within 5s. Heavy work in queue. | Webhooks receive, verify, process |

---

## Category 3.4 — Order State Machine & Stock

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 3.4.1 | **Order state machine** | Implement transitions: `CREATED → AWAITING_PAYMENT → PAID → PACKED → SHIPPED → DELIVERED → COMPLETED` plus `CANCELLED`, `REFUNDED`, `FAILED`. Each transition via documented server action only. State guards: can't ship before paid, can't refund before paid, etc. | All transitions work, invalid transitions rejected |
| 3.4.2 | **Stock management** | Reservation at `CREATED` (15-min hold). Decrement at `PAID`. Release at `CANCELLED`/`FAILED`. Restock at `REFUNDED`. All in DB transaction with row-level locks on `Product.stock` / `ProductVariant.stock`. `StockMovement` log for every change. | Stock decrements on payment, restores on cancel/refund |
| 3.4.3 | **Refund flow** | Full or partial refund. Reason required. Goes through provider adapter's `refund()`. Status reflected on `Payment` row. Email notification on success. Stock restored on full refund; partial = admin choice. | Refund processes, email sent, stock restored |
| 3.4.4 | **Order number generation** | Format: `ARI-YYYYMM-NNNNN` (e.g., `ARI-202504-00021`). Unique, sequential. | Numbers generate correctly |
| 3.4.5 | **Payment timeout handling** | If `AWAITING_PAYMENT` exceeds 30 min → auto-cancel, release stock reservation. Cron or queue-based check. | Timeout cancels stale orders |

---

## Category 3.5 — Customer Accounts

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 3.5.1 | **Customer auth (reuse Phase 2 provider)** | Extend auth to support customer sign-up/sign-in. Same provider as admin (Auth.js / Clerk / custom). Customer sign-up at `/auth/sign-up`. Session supports both admin and customer roles. | Customer can sign in |
| 3.5.2 | **Account layout & shell** | Build `app/(account)/layout.tsx` — auth-protected (redirect to sign-in if unauthenticated). Shell: left rail nav (Orders, Quotes, Downloads, Addresses, Tickets, Profile, Devices[future]) + main content. Mobile: left rail → top dropdown. | Layout renders, auth gate works |
| 3.5.3 | **Account pages** | Build `/account` (greeting, order summary, recent ticket, what's new). `/account/orders` (table with status chips, date, total, action). `/account/orders/[id]` (order timeline with timestamps, line items, downloads, reorder CTA). `/account/downloads` (purchased downloads, version chips, signed temporary URL). `/account/profile` (name, email, phone, language, password). All `noindex`. | All account pages render |
| 3.5.4 | **Guest → auth cart merge** | On sign-in, merge guest cart into user cart: sum identical lines, additive otherwise. Server-side, idempotent. Guest cart cookie cleared after merge. | Cart merges correctly on login |
| 3.5.5 | **Address management** | Build `/account/addresses` — list addresses, add/edit/delete, set default shipping/billing. BD-aware fields (division, district, postcode). | Address CRUD works |

---

## Category 3.6 — Admin Order Management

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 3.6.1 | **Admin orders list** | Build `app/(admin)/admin/orders/page.tsx` — table: order number, customer, status chip, placedAt, total (BDT primary, USD secondary), payment provider, fulfillment. Filters: status, provider, date range, country, fulfillment. Bulk actions: mark packed, mark shipped, export. | List renders, filters work |
| 3.6.2 | **Admin order detail** | Build `app/(admin)/admin/orders/[id]/page.tsx` — header (order number, status timeline, next-state CTA). Sections: customer info + link, line items + click to product, shipping + billing address, payment attempts (provider, status, amounts; raw payload JSON viewer for super_admin only), shipments (carrier, tracking, add shipment), discounts (voucher), internal notes. State transitions enforced. Audit log. | Detail renders, state transitions work |
| 3.6.3 | **Admin customers** | Build `app/(admin)/admin/customers/page.tsx` — table: name, email, country, segment, orders count, lifetime value, lastActivityAt. Detail: tabs for Overview, Orders, Quotes, Tickets, Notes. Inline edit of segment, account manager. "Open ticket on behalf" / "Create order draft" actions. | Customer list + detail render |
| 3.6.4 | **Quote-to-order conversion** | Build `/admin/quotes/:id` — "Convert to order" button pre-fills an order draft from the quote (custom pricing, custom shipping, `MANUAL` payment provider for invoice + bank transfer). | Conversion creates order draft |
| 3.6.5 | **Admin overview — sales KPIs** | Extend `/admin` overview with sales KPIs: today's revenue (BDT/USD toggle), orders today, new quotes, open tickets, low-stock alerts, active customers (7d). Pending queues: orders awaiting fulfillment, tickets without first response (SLA timer), unassigned quotes. Traffic + conversion mini-chart. System health. | Overview shows sales KPIs |

---

## Category 3.7 — Transactional Emails

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 3.7.1 | **Email templates** | Create `server/mail/templates/` — order-placed, payment-received, shipped, delivered, cancelled, refunded, payment-failed. Each: ARIOT logo, brand-token layout, plain-text alternative, unsubscribe link where applicable. BDT currency in emails. | Templates render correctly |
| 3.7.2 | **Email dispatch on order events** | Wire email sending to order state transitions: `order.placed` → customer, `payment.received` → customer, `order.shipped` → customer (with tracking), `order.delivered` → customer, `order.cancelled` → customer, `order.refunded` → customer, `order.payment_failed` → customer (with retry link). | Emails send on each event |
| 3.7.3 | **Low-stock admin alert** | When `stock ≤ reorderPoint`, send email to sales admin. Threshold configurable per product. | Alert email sends |

---

## Category 3.8 — Product Detail Enhancements

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 3.8.1 | **Variant selector on product detail** | Add variant selector to `/products/[slug]`: option groups dynamically generated from `ProductVariant.optionValues`. Price + stock update reactively on variant change. | Variant selection works |
| 3.8.2 | **Buy box CTA logic by salesType** | `B2C` → Add to cart only. `B2B` → Request quote only (jumps to `/quote?product=:slug`). `HYBRID` → Add to cart primary + Request quote secondary. Stock messaging: IN_STOCK + stock > 0 → "Ships from [CITY] in [N] days". IN_STOCK + stock = 0 → hidden cart + "Notify me" form. BACKORDER → expected date. MADE_TO_ORDER → lead time. | CTA logic per salesType works |
| 3.8.3 | **Product filters (catalog)** | Add filter facets to `/products`: category, use case, connectivity, price range, availability, sales type. Filters reflected in URL query params. Sort: featured, newest, price asc/desc, popular. Server-side filtering. | Filters work, URL updates |
| 3.8.4 | **Recently viewed products** | Cookie-based recently viewed tracking. Show on product detail page below related products. Max 6 items. | Recently viewed renders |

---

## Category 3.9 — Security & Performance Hardening

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 3.9.1 | **Checkout security** | Server-authoritative totals (recompute on every submission). CSRF protection on route handlers (double-submit token). Rate-limit checkout endpoint. No client-side price computation for final total. | Checkout rejects tampered totals |
| 3.9.2 | **Webhook security** | Signature verification per provider. Idempotency keys recorded in `WebhookEvent` table. Replay protection (timestamp window). Never log raw payment payloads. | Webhooks verify, replay rejected |
| 3.9.3 | **PCI compliance posture** | No raw card data on our domain. All card fields via provider hosted iframes. CSP headers prevent loading untrusted scripts. Document PCI SAQ-A eligibility. | CSP blocks inline card forms |
| 3.9.4 | **Performance audit (Phase 3 pages)** | Lighthouse mobile ≥ 90 on `/products/:slug`, `/cart`, rendered checkout review. LCP ≤ 2.5s. Initial JS ≤ 240KB on shop routes. Fix any regressions from Phase 1. | Lighthouse scores ≥ 90 |
| 3.9.5 | **Penetration test prep** | Document test scope: auth flows, cart manipulation, checkout bypass, webhook replay, admin RBAC, payment tampering. Recommend external pen test before go-live. | Test plan documented |
| 3.9.6 | **Voucher seed data** | Create 3 test vouchers for staging: 10% off (percentage, min subtotal 5000 BDT), 500 BDT fixed (FIXED, BDT), free shipping (if supported). Set usage limits. | Vouchers work in checkout |

---

## Phase 3 — Dependency Graph

```
3.1.1 ──► 3.1.2 ──► 3.1.3 ──► 3.1.4 ──► 3.1.5 ──► 3.1.6
                                          │
                              ┌─────────────┤
                              ▼             ▼
                        3.2.1–3.2.7    3.3.1–3.3.7
                        (Checkout)      (Payment adapters)
                              │             │
                              └──────┬──────┘
                                     ▼
                              3.4.1–3.4.5
                              (State machine + stock)
                                     │
                    ┌────────────────┤
                    ▼                ▼
              3.5.1–3.5.5      3.6.1–3.6.5
              (Customer acct)   (Admin orders)
                    │                │
                    └───────┬────────┘
                            ▼
                    3.7.1–3.7.3
                    (Transactional emails)
                            │
                    ┌───────┤
                    ▼       ▼
              3.8.1–3.8.4  3.9.1–3.9.6
              (Product     (Security & perf)
               enhance)
```

## Phase 3 — Critical Path

```
3.1.1 → 3.1.2 → 3.2.1 → 3.2.5 → 3.3.1 → 3.3.2 → 3.4.1 → 3.4.2 → 3.6.1 → 3.6.2 → 3.7.1 → 3.9.4 → DONE
```

## Phase 3 — Step Count by Category

| Category | Steps | Parallelism |
|----------|-------|-------------|
| 3.1 Schema & Cart | 6 | Sequential |
| 3.2 Checkout | 7 | Parallel with 3.3 |
| 3.3 Payment Adapters | 7 | Parallel with 3.2 |
| 3.4 State Machine & Stock | 5 | Sequential (after 3.2 + 3.3) |
| 3.5 Customer Accounts | 5 | Parallel with 3.6 |
| 3.6 Admin Orders | 5 | Parallel with 3.5 |
| 3.7 Transactional Emails | 3 | After 3.4 |
| 3.8 Product Enhancements | 4 | Parallel with 3.9 |
| 3.9 Security & Performance | 6 | Last |
| **TOTAL** | **48** | |

---

## Phase 3 — Final Checklist

Before crossing into Phase 4, verify:

- [ ] Successful end-to-end purchase via bKash on staging
- [ ] Successful end-to-end purchase via Nagad on staging
- [ ] Successful end-to-end purchase via SSLCommerz on staging
- [ ] COD order flow works end-to-end
- [ ] Refund flow tested per provider (full + partial)
- [ ] Stock decrement on payment, restore on cancel/refund
- [ ] Stock concurrency test (simulated concurrent buys)
- [ ] Webhook signature + idempotency tested with replay
- [ ] All transactional emails delivered, brand-consistent
- [ ] Low-stock alert email fires correctly
- [ ] Admin can fulfill order: packed → shipped → delivered
- [ ] Quote-to-order conversion works
- [ ] Customer account pages render (orders, addresses, profile)
- [ ] Guest → auth cart merge works
- [ ] Currency BDT/USD switcher works everywhere
- [ ] Voucher apply/remove works
- [ ] Checkout rejects tampered totals (server-authoritative)
- [ ] Lighthouse mobile ≥ 90 on `/products/:slug`, `/cart`
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm build` — succeeds
- [ ] Pen-test scope documented, recommended before go-live
- [ ] Release note created at `docs/RELEASES/<date>.md`

---

**Phase 3 Status**: Defined — 48 steps across 9 categories  
**Phase 3 critical path**: ~12 steps (Schema → Cart → Checkout → Payments → State machine → Admin orders → Emails → Performance)  
**Phase 3 parallel capacity**: 2 workstreams (Checkout + Payments in parallel, then Customer accounts + Admin orders)

---

# PHASE 4 — Support / Ticket System

Phase 4 implementation roadmap — **Support Ticketing & Customer Self-Service**. Customers submit, track, and resolve issues. Admin triages, assigns, and resolves with SLA tracking.

**Phase 4 Goal**: a full support ticketing system where customers can submit issues, track status, and self-serve via a knowledge base. Admin team triages, assigns, and resolves tickets with SLA enforcement.

**Prerequisites**: Phase 3 complete and verified (all checklist items pass).

**Exit Criteria** (from `FEATURE_ROADMAP.md`):
- Customer can submit ticket with product + category + priority + attachment
- Ticket lifecycle: OPEN → TRIAGED → IN_PROGRESS → WAITING_CUSTOMER → RESOLVED → CLOSED
- SLA breach alerts fire at 75% and 100% of response/resolution deadlines
- Admin can reassign, change priority, merge duplicate tickets
- Knowledge base articles linked from ticket form reduce duplicate submissions
- Customer sees ticket timeline in account area
- All attachments upload via signed URL (no raw multipart on our domain)

---

## Category 4.1 — Ticket Schema & Infrastructure

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 4.1.1 | **Ticket schema models** | Add to Prisma schema: `SupportTicket`, `TicketMessage`, `TicketAttachment`, `TicketStatusHistory`, `SLAPolicy`, `SLABreach` from `DATABASE_SCHEMA_PLAN.md` §5. Add `TicketCategory` enum (BUG, FEATURE_REQUEST, SETUP, CONNECTIVITY, FIRMWARE, BILLING, GENERAL) and `categoryId` FK on `SupportTicket`. Include enums: `TicketStatus` (OPEN, TRIAGED, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED), `TicketPriority` (LOW, MEDIUM, HIGH, URGENT). Indices on `status`, `priority`, `assigneeId`, `customerId`, `createdAt`. | `npx prisma generate` succeeds |
| 4.1.2 | **SLA policies seed** | Seed `SLAPolicy` rows: URGENT → 1h response / 4h resolution, HIGH → 4h / 24h, MEDIUM → 8h / 48h, LOW → 24h / 72h. Business hours: 9am–6pm BD time (configurable via `SystemSetting`). | SLA rows in DB |
| 4.1.3 | **Ticket server actions** | Create `features/support/ticket-actions.ts` — `createTicket`, `updateTicket`, `assignTicket`, `mergeTickets`, `changePriority`, `addMessage`, `resolveTicket`, `closeTicket`, `reopenTicket`. Each: Zod validate, RBAC/ownership check, DB write, `TicketStatusHistory` append, `revalidateTag`. | Actions execute, history records |
| 4.1.4 | **Attachment handling** | Build `features/support/attachment-actions.ts` — upload via signed URL (`/api/uploads/sign`), validate MIME (image, pdf, zip, log, txt), max 10MB per file, max 5 files per message. Store `TicketAttachment` rows with `messageId` FK. | Attachments upload and link to messages |

---

## Category 4.2 — Customer Ticket Submission

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 4.2.1 | **Ticket form** | Build `features/support/ticket-form.tsx` — fields: subject, category dropdown (mapped to `TicketCategory`), priority (LOW/MEDIUM/HIGH/URGENT with color chips), product dropdown (from user's orders or catalog search), description (rich text or markdown), attachments (drag-drop + button, max 5). Pre-fill: product from URL `?product=:slug`. Zod validation. | Form renders, validates |
| 4.2.2 | **Ticket submission API** | Build `app/api/tickets/route.ts` — POST endpoint. Zod validate, rate-limit (5 req/min/user), create `Ticket` + first `TicketMessage` + attachments in transaction. Set SLA `responseDeadline` from policy. Send confirmation email. Return ticket number. | API accepts POST, returns ticket number |
| 4.2.3 | **Ticket confirmation page** | Build `app/(account)/account/tickets/new/success.tsx` — ticket number, subject, priority, expected response time (from SLA), link to view ticket, link to knowledge base. | Confirmation renders |
| 4.2.4 | **Knowledge base suggestions** | On ticket form, after category selection: fetch top 3 related knowledge base articles (full-text search on title + excerpt). Show as clickable suggestions above the submit button: "These articles might help — did this solve your issue?" | Suggestions appear after category selection |

---

## Category 4.3 — Customer Ticket Management

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 4.3.1 | **Ticket list page** | Build `app/(account)/account/tickets/page.tsx` — table: ticket number, subject, status chip (color-coded), priority chip, product, createdAt, lastActivityAt. Filters: status, priority. Sort: newest, last activity. Empty state: "No tickets yet. Need help? Submit a ticket." | List renders |
| 4.3.2 | **Ticket detail page** | Build `app/(account)/account/tickets/[id]/page.tsx` — header (ticket number, subject, status + priority chips, product link, assigned-to avatar if assigned). Timeline: chronological messages with author, timestamp, attachments. Customer can add message + attachments. Reopen button if RESOLVED/CLOSED. SLA countdown visible. | Detail renders, messages post |
| 4.3.3 | **Ticket status chips** | Build `components/support/ticket-status-chip.tsx` — visual status indicator: OPEN (blue), TRIAGED (yellow), IN_PROGRESS (orange), WAITING_CUSTOMER (purple), RESOLVED (green), CLOSED (gray). Consistent with admin ticket chips. | Chips render correctly |

---

## Category 4.4 — Admin Ticket Management

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 4.4.1 | **Admin tickets list** | Build `app/(admin)/admin/tickets/page.tsx` — data table: ticket number, subject, customer name + avatar, status chip, priority chip, assignee, SLA status (on-track, at-risk, breached — color-coded), product, createdAt, lastActivityAt. Filters: status, priority, assignee, category, SLA status, date range. Bulk actions: assign, change priority, change status. Sort by SLA urgency. | List renders, SLA indicators work |
| 4.4.2 | **Admin ticket detail** | Build `app/(admin)/admin/tickets/[id]/page.tsx` — header: ticket number, status (editable dropdown), priority (editable dropdown), SLA countdown (green/yellow/red). Sidebar: customer info (name, email, order history link), product link, category. Main: message timeline (customer messages in white, admin in cyan-tinted), admin can reply, change status, assign. Actions bar: assign (team member dropdown), merge (search for duplicate), escalate (bump priority), add internal note (not visible to customer). | Detail renders, actions work |
| 4.4.3 | **Ticket assignment** | Build assignment logic: round-robin within team, manual assign, auto-assign by category (e.g., firmware tickets → firmware team). Default: unassigned queue. | Assignment works |
| 4.4.4 | **Ticket merge** | Build merge flow: search for duplicate tickets by customer + subject similarity. Merge selected tickets: parent ticket gets all messages from child, child status → MERGED, child shows "Merged into #XXXX" redirect. | Merge works, child redirects |
| 4.4.5 | **Internal notes** | Admin can add internal notes (not visible to customer). Notes shown in timeline with distinct styling (dashed border, internal badge). Can be added to any message. | Notes render with distinct styling |

---

## Category 4.5 — SLA Monitoring & Alerts

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 4.5.1 | **SLA timer engine** | Create `server/support/sla-engine.ts` — on ticket creation: compute `responseDeadline` and `resolutionDeadline` from SLA policy (business hours only). On status change to IN_PROGRESS: lock response SLA. On RESOLVED: lock resolution SLA. Handle weekends/holidays (BD public holidays configurable via `SystemSetting`). | Deadlines compute correctly |
| 4.5.2 | **SLA breach check cron** | Create `app/api/cron/check-sla/route.ts` — runs every 5 minutes. Query tickets where deadline approaching (75%) or breached (100%). At 75%: create `SLABreach` with severity `WARNING`, send alert to assignee + team lead. At 100%: severity `BREACHED`, send escalation email to support manager. Rate-limit: one alert per ticket per threshold. | Cron fires, alerts send |
| 4.5.3 | **SLA dashboard widget** | Add to admin overview (`/admin`): SLA metrics — current open tickets by SLA status (on-track, at-risk, breached), avg response time (last 7d), avg resolution time (last 7d), SLA breach rate (%). Bar chart: breaches per day (last 30d). | Widget renders with mock data |
| 4.5.4 | **SLA policy admin** | Build `/admin/settings/sla` — edit SLA policies per priority: response deadline, resolution deadline, business hours, excluded dates. Edit form with live preview of computed deadlines. | Settings save, deadlines update |

---

## Category 4.6 — Knowledge Base

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 4.6.1 | **Knowledge base schema** | Add `SupportArticle` model (per `DATABASE_SCHEMA_PLAN.md` §5): title, slug, excerpt, body (MDX), categoryId (FK to `SupportCategory`), tags (array), products (JSON array of related product IDs), author, status (DRAFT/PUBLISHED/ARCHIVED), publishedAt, viewCount, helpfulCount, notHelpfulCount, createdAt, updatedAt. FTS index on title + excerpt + body. | Schema compiles |
| 4.6.2 | **KB article CRUD (admin)** | Build `/admin/support/articles` — list, editor (title, slug, excerpt, MDX body, category FK to `SupportCategory`, tags, products, status). Publish/unpublish. Preview before publish. | CRUD works |
| 4.6.3 | **Public KB pages** | Build `/support/kb/[slug]` — article page: title, category, body (MDX render), "Was this helpful?" yes/no, related articles (same category), "Still need help?" CTA → ticket form. Dynamic metadata + JSON-LD `TechArticle`. | Articles render, helpful feedback works |
| 4.6.4 | **KB search** | Build search endpoint `/api/support/kb/search?q=` — full-text search on title + excerpt + body. Return top 10 results with snippet highlighting. Integrate into ticket form and support hub. | Search returns relevant results |

---

## Category 4.7 — Ticket Notifications

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 4.7.1 | **Email templates** | Create `server/mail/templates/` — ticket-created (to customer + admin), ticket-replied (to customer on admin reply, to admin on customer reply), ticket-resolved (to customer with satisfaction survey link), ticket-reopened (to admin), sla-warning (to assignee), sla-breached (to manager). | Templates render |
| 4.7.2 | **Email dispatch wiring** | Wire email sending to ticket events: `ticket.created` → customer + admin, `ticket.replied` → other party, `ticket.resolved` → customer, `ticket.reopened` → assignee, `sla.warning` → assignee + team lead, `sla.breached` → manager. Debounce: max 1 email per ticket per 5 minutes per recipient. | Emails send on each event |
| 4.7.3 | **Notification preferences** | Build `/account/notifications` — customer can toggle: email on reply, email on resolution, email on reopen. Admin notification preferences managed via `/admin/settings/notifications`. | Preferences save |

---

## Category 4.8 — Admin Support Dashboard

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 4.8.1 | **Support overview** | Build `/admin/support` overview (separate from tickets list): KPIs — open tickets, avg first response (last 7d), avg resolution (last 7d), SLA breach rate, tickets by category (pie chart), tickets by priority (bar chart), team workload (assignee × open tickets). Time range selector: today, 7d, 30d, custom. | Dashboard renders with mock data |
| 4.8.2 | **Canned responses** | Build `/admin/support/canned-responses` — create/edit/delete templates: name, subject, body (MDX). Insert into reply editor via shortcut. | Canned responses list + insert work |
| 4.8.3 | **CSAT survey** | On ticket RESOLVED: email customer a satisfaction survey (1–5 stars + optional comment). Results stored in `Ticket.csatScore` and `Ticket.csatComment`. CSAT average visible on support dashboard. | Survey email sends, results store |

---

## Category 4.9 — Security & Performance

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 4.9.1 | **Ticket access control** | Customers can only view their own tickets. Admins can view all tickets (RBAC: `support_admin` or higher). Attachment downloads: signed URLs with 1-hour expiry. No direct file serving. | Unauthorized access blocked |
| 4.9.2 | **Rate limiting** | Ticket creation: 5 req/min/user. Message posting: 10 req/min/user. Attachment upload: 3 req/min/user. KB search: 20 req/min/IP. | Rate limits enforced |
| 4.9.3 | **Performance audit** | Lighthouse mobile ≥ 90 on `/account/tickets`, `/account/tickets/[id]`. KB search response < 200ms. Ticket detail loads in < 1s. | Performance passes |
| 4.9.4 | **Accessibility** | axe-core zero violations on all ticket/KB pages. Keyboard navigation on ticket timeline, message composer, attachment upload. Screen reader compatible status chips. | Accessibility passes |

---

## Phase 4 — Dependency Graph

```
4.1.1 ──► 4.1.2 ──► 4.1.3 ──► 4.1.4
                              │
              ┌───────────────┤
              ▼               ▼
        4.2.1–4.2.4      4.3.1–4.3.3
        (Customer ticket) (Customer mgmt)
              │
              ▼
        4.4.1–4.4.5
        (Admin ticket mgmt)
              │
    ┌─────────┼──────────┐
    ▼         ▼          ▼
4.5.1–4.5.4  4.6.1–4.6.4  4.7.1–4.7.3
(SLA engine)  (KB)          (Notifications)
    │         │          │
    └─────────┼──────────┘
              ▼
        4.8.1–4.8.3
        (Support dashboard)
              │
              ▼
        4.9.1–4.9.4
        (Security & perf)
```

## Phase 4 — Critical Path

```
4.1.1 → 4.1.3 → 4.2.1 → 4.2.2 → 4.4.1 → 4.4.2 → 4.5.1 → 4.5.2 → 4.7.1 → 4.9.3 → DONE
```

## Phase 4 — Step Count by Category

| Category | Steps | Parallelism |
|----------|-------|-------------|
| 4.1 Schema & Infrastructure | 4 | Sequential |
| 4.2 Customer Submission | 4 | Sequential (after 4.1) |
| 4.3 Customer Ticket Management | 3 | Parallel with 4.4 |
| 4.4 Admin Ticket Management | 5 | Parallel with 4.3 |
| 4.5 SLA Monitoring | 4 | Parallel with 4.6, 4.7 |
| 4.6 Knowledge Base | 4 | Parallel with 4.5, 4.7 |
| 4.7 Notifications | 3 | Parallel with 4.5, 4.6 |
| 4.8 Support Dashboard | 3 | After 4.5, 4.6, 4.7 |
| 4.9 Security & Performance | 4 | Last |
| **TOTAL** | **34** | |

---

## Phase 4 — Final Checklist

Before crossing into Phase 5, verify:

- [ ] Customer can submit ticket with product + category + priority + attachment
- [ ] Ticket lifecycle: OPEN → TRIAGED → IN_PROGRESS → WAITING_CUSTOMER → RESOLVED → CLOSED
- [ ] SLA deadlines computed correctly (business hours, BD timezone)
- [ ] SLA 75% warning email fires to assignee + team lead
- [ ] SLA 100% breach email fires to manager
- [ ] Admin can reassign, change priority, merge duplicate tickets
- [ ] Admin can add internal notes (not visible to customer)
- [ ] Knowledge base articles linked from ticket form
- [ ] KB search returns relevant results
- [ ] Customer sees ticket timeline in account area
- [ ] All attachments upload via signed URL
- [ ] Ticket access control: customers own tickets only, admin sees all
- [ ] Canned responses insert into reply editor
- [ ] CSAT survey sends on ticket resolution
- [ ] Notification preferences work for customers
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm build` — succeeds
- [ ] Lighthouse mobile ≥ 90 on ticket pages
- [ ] axe-core zero violations on ticket/KB pages
- [ ] Release note created at `docs/RELEASES/<date>.md`

---

**Phase 4 Status**: Defined — 34 steps across 9 categories  
**Phase 4 critical path**: ~10 steps (Schema → Ticket form → Admin mgmt → SLA engine → Notifications → Performance)  
**Phase 4 parallel capacity**: 3 workstreams (Customer ticket mgmt, Admin ticket mgmt, then SLA + KB + Notifications)

---

# PHASE 5 — Customer Dashboard + IoT

Phase 5 implementation roadmap — **Customer Dashboard, Device Management & IoT Integration**. Customers manage their ARIOT devices, monitor sensor data, and control robots from a unified dashboard.

**Phase 5 Goal**: customers with ARIOT devices can register, monitor, and control their devices from a web dashboard. Admin can push firmware updates and manage device fleets.

**Prerequisites**: Phase 4 complete and verified (all checklist items pass).

**Exit Criteria** (from `FEATURE_ROADMAP.md`):
- Customer can register a device via serial number + claim token
- Device dashboard shows real-time sensor data (or last-seen data if offline)
- Customer can send commands to device (start/stop/configure)
- Admin can push OTA firmware updates with rollout controls
- Device health monitoring: online/offline, battery, signal strength
- Device logs viewable by customer and admin
- Audit trail: every device command logged with user, timestamp, parameters

---

## Category 5.1 — Device Schema & Infrastructure

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 5.1.1 | **Device schema models** | Add to Prisma schema: `Device`, `DeviceClaim`, `DeviceCommand`, `DeviceEvent`, `DeviceSensorReading`, `FirmwareVersion`, `FirmwareDeployment`, `DeviceLog` from `DATABASE_SCHEMA_PLAN.md` §10. Enums: `DeviceStatus` (ONLINE, OFFLINE, SLEEPING, UPDATING, ERROR), `CommandStatus` (PENDING, SENT, ACKNOWLEDGED, COMPLETED, FAILED, TIMEOUT), `FirmwareChannel` (STABLE, BETA, ALPHA). Indices on `deviceId`, `customerId`, `status`, `lastSeenAt`. | `npx prisma generate` succeeds |
| 5.1.2 | **Device server actions** | Create `features/device/device-actions.ts` — `registerDevice`, `claimDevice`, `removeDevice`, `sendCommand`, `getDeviceStatus`, `getSensorReadings`, `getDeviceLogs`, `getDeviceEvents`. Each: Zod validate, ownership/RBAC check, DB read/write, audit log. | Actions execute |
| 5.1.3 | **Device API routes** | Build `app/api/devices/route.ts` — list customer's devices. Build `app/api/devices/[id]/route.ts` — device detail. Build `app/api/devices/[id]/commands/route.ts` — send command. Build `app/api/devices/[id]/sensors/route.ts` — get readings. All: auth required, ownership check, rate-limited. | API endpoints accept requests |
| 5.1.4 | **IoT event ingestion** | Create `app/api/iot/events/route.ts` — POST endpoint for device telemetry. Auth via device API key (stored in `Device.apiKey`). Validate payload (sensor readings, status updates, command acknowledgements). Store in `DeviceEvent` and `DeviceSensorReading` tables. Update `Device.lastSeenAt` and `Device.status`. Rate-limited per device. | Devices can post telemetry |

---

## Category 5.2 — Device Registration & Claiming

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 5.2.1 | **Device claim flow** | Build `/account/devices/claim` — enter serial number + claim token (printed on device / included in packaging). Validate against `DeviceClaim` table. Link device to customer account. Send confirmation email. | Device claims successfully |
| 5.2.2 | **Device list page** | Build `app/(account)/account/devices/page.tsx` — grid of device cards: device name, model, status chip (ONLINE green / OFFLINE gray / SLEEPING blue / UPDATING orange / ERROR red), last seen, battery level, signal strength. Empty state: "No devices yet. Claim your first device." | List renders |
| 5.2.3 | **Device detail page** | Build `app/(account)/account/devices/[id]/page.tsx` — header (device name, model, serial, status, last seen, firmware version). Tabs: Dashboard (sensor data overview), Sensors (detailed readings), Commands (history + send new), Logs (device logs), Settings (rename, remove, notification preferences). | Detail renders |
| 5.2.4 | **Device rename & remove** | Allow customer to rename device (cosmetic). Allow remove (unlinks from account, does NOT factory reset). Confirmation dialog. | Rename and remove work |

---

## Category 5.3 — Device Dashboard (Customer)

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 5.3.1 | **Dashboard overview tab** | Build dashboard tab: real-time sensor summary (temperature, humidity, battery, signal — adapt per device type). Status indicators with color coding. "Last updated" timestamp. Auto-refresh every 30s (or manual refresh button). | Dashboard renders |
| 5.3.2 | **Sensor data tab** | Build sensor tab: line charts for each sensor type (last 1h, 6h, 24h, 7d, 30d). Chart library: recharts or similar. Raw data table below charts. Export CSV. Data from `DeviceSensorReading` table. | Charts render, time ranges work |
| 5.3.3 | **Command interface** | Build command tab: pre-defined commands per device type (e.g., robot: START, STOP, PAUSE, HOME, SET_SPEED; sensor: RESTART, CALIBRATE, SET_INTERVAL). Custom command form (advanced: raw JSON payload). Command history table: command, status, sent at, acknowledged at, result. | Commands send and history records |
| 5.3.4 | **Device logs tab** | Build logs tab: filterable by log level (INFO, WARN, ERROR), timestamp range. Table: timestamp, level, source, message. Pagination. Auto-scroll to latest. | Logs render, filters work |

---

## Category 5.4 — Admin Device Management

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 5.4.1 | **Admin device list** | Build `app/(admin)/admin/devices/page.tsx` — data table: device name, model, serial, customer, status, firmware version, last seen, signal, battery. Filters: status, model, firmware version, customer, date range. Bulk actions: assign firmware, reboot, factory reset (with confirmation). | List renders |
| 5.4.2 | **Admin device detail** | Build `app/(admin)/admin/devices/[id]/page.tsx` — header (device info, status, customer link). Tabs: Overview (sensor summary, health), Commands (full history, send any command), Logs (all levels, no filter limits), Firmware (current version, update history), Audit (all device events). Actions: rename, reassign customer, factory reset, remove. | Detail renders |
| 5.4.3 | **Device fleet overview** | Build admin devices overview: KPIs — total devices, online %, average battery, average signal. Fleet map (static placeholder). Devices by model (bar chart). Devices by status (pie chart). Recent events feed. | Fleet overview renders |
| 5.4.4 | **Device telemetry store** | Ensure `DeviceSensorReading` table stores: timestamp, deviceId, sensorType, value (JSON for complex readings), unit. Retention policy: raw data 30d, aggregated data 1y. Cron job to aggregate and archive. | Readings store correctly, retention works |

---

## Category 5.5 — Firmware Management

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 5.5.1 | **Firmware schema** | Add `FirmwareVersion` model: version, model, channel (ALPHA/BETA/STABLE), changelog (MDX), fileUrl, fileSize, checksum (SHA-256), minHardwareRevision, releaseNotes, status (DRAFT/AVAILABLE/DEPRECATED), createdAt. Add `FirmwareDeployment` model: firmwareVersionId, targetDeviceIds, rolloutPercentage, startedAt, completedAt, status (PENDING/IN_PROGRESS/COMPLETED/ROLLED_BACK). | Schema compiles |
| 5.5.2 | **Firmware upload** | Build `/admin/firmware` — upload firmware binary (signed URL), fill metadata (version, model, channel, changelog, min hardware revision). Validate checksum. Status: DRAFT → AVAILABLE. | Upload works |
| 5.5.3 | **OTA update flow** | Build firmware deployment: select firmware version, target devices (by model, by specific IDs, or by rollout percentage). Confirm deployment. Create `FirmwareDeployment` record. Send firmware URL to devices via command queue. | Deployment creates and sends |
| 5.5.4 | **Firmware update monitoring** | Build `/admin/firmware/[deploymentId]` — progress: devices updated / total, success rate, failures (with device links). Rollback button. Auto-rollback if failure rate > 10%. | Monitoring renders, rollback works |
| 5.5.5 | **Device firmware check** | Device polls `/api/devices/[id]/firmware/check` on boot. If newer version available (per channel + hardware compatibility), return firmware URL + checksum. Device initiates download. Device reports update status via `/api/iot/events`. | Firmware check works |

---

## Category 5.6 — Real-time Data (WebSocket / SSE)

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 5.6.1 | **SSE endpoint for device events** | Build `app/api/devices/[id]/stream/route.ts` — Server-Sent Events endpoint. Auth required. Pushes: new sensor readings, status changes, command acknowledgements, log entries. Heartbeat every 30s. Client reconnect with `Last-Event-ID`. | SSE connection works |
| 5.6.2 | **Real-time dashboard hook** | Create `features/device/use-device-stream.ts` — custom hook that connects to SSE endpoint, updates local state on new events. Handles reconnection, backoff. Respects `prefers-reduced-motion` for chart animations. | Hook connects, updates state |
| 5.6.3 | **Real-time indicators** | Add visual indicators: pulsing dot for LIVE data, gray dot for stale (> 30s old). Smooth chart updates (append data point, remove oldest). | Indicators update in real-time |

---

## Category 5.7 — Admin IoT Dashboard

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 5.7.1 | **IoT overview page** | Build `/admin/iot` — fleet health summary: online/offline/sleeping/error counts, average signal strength, battery distribution, firmware version distribution. Alerts panel: devices offline > 24h, battery < 10%, error status. | Overview renders |
| 5.7.2 | **Device health monitoring** | Build alert rules: offline > X hours (configurable), battery < X% (configurable), error status, firmware outdated. Alerts → email to admin + optional webhook. Alert history table. | Alerts fire, history records |
| 5.7.3 | **Fleet management tools** | Bulk operations: reboot all devices of model X, apply firmware to all devices of model X, factory reset selected devices. Progress tracking for bulk operations. | Bulk operations work |

---

## Category 5.8 — Device Notifications

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 5.8.1 | **Device event emails** | Wire emails for: device offline > 2h (to customer), firmware update available (to customer), device error (to customer + admin), claim confirmation (to customer). Templates: brand-consistent, device info included. | Emails send |
| 5.8.2 | **Notification preferences** | Build `/account/notifications/devices` — per-device toggle: offline alerts, firmware alerts, error alerts, weekly health summary. Global toggle: all device notifications. | Preferences save |
| 5.8.3 | **Weekly health summary** | Cron job: compile per-device health summary (uptime %, battery trend, signal trend, events). Email to customer weekly (opt-in). | Summary emails send |

---

## Category 5.9 — B2B Account Features

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 5.9.1 | **B2B account schema** | Add to Prisma schema: `Account` (company name, taxId, segment, defaultPriceTierId), `AccountMember` (userId, accountId, role: OWNER/MEMBER/VIEWER, joinedAt), `AccountSeat` (seat limit, billing). Extend `User` with optional `accountId` FK. Indices on `accountId`, `userId`. | `npx prisma generate` succeeds |
| 5.9.2 | **Account management UI** | Build `app/(account)/account/team/page.tsx` — member list with role chips, invite via email, remove member, change role. OWNER can manage all members. MEMBER has limited permissions. VIEWER is read-only. Confirmation dialogs for destructive actions. | Invite, remove, role change work |
| 5.9.3 | **Account-level price tiers** | Add `PriceTier` model: name, slug, currency, tier-specific prices per product/variant. Admin assigns price tier to account via `/admin/customers/:id`. Customer sees tier-specific pricing in catalog and checkout. B2B checkout uses account tier prices. | Tier pricing displays correctly |
| 5.9.4 | **Multi-user RBAC** | Implement seat-based access: OWNER full access to account features, MEMBER can view orders/tickets and submit quotes, VIEWER can only view. Enforce on server actions and API routes. Seat limit enforced at invite time. | Role-based access works |
| 5.9.5 | **Developer portal placeholder** | Build `app/(marketing)/developers/page.tsx` — API docs placeholder, SDK index placeholder, webhook configuration guide. Static content for now. Mark as `[evaluating based on demand]`. | Page renders with placeholder content |

---

## Category 5.10 — Security & Performance

| # | Step | Details | Validates |
|---|------|---------|-----------|
| 5.10.1 | **Device auth security** | Device API keys: 256-bit random, stored hashed. Rotation support (generate new key, old key expires after 24h). Customer devices: ownership verified on every request. Admin: RBAC enforced. | Auth works, unauthorized blocked |
| 5.10.2 | **Command security** | Command whitelist per device model (prevent arbitrary code execution). Rate-limit: 10 commands/min/device. Audit every command with full parameters. Destructive commands (factory reset) require confirmation + re-auth. | Commands validated, rate-limited |
| 5.10.3 | **Data privacy** | Sensor data: customer can export (GDPR-like), can delete (retention policy: 30d raw, 1y aggregated). Device logs: 30d retention. No PII in telemetry. | Export and delete work |
| 5.10.4 | **Performance audit** | Lighthouse mobile ≥ 90 on device pages. SSE connection stable under load. Sensor data queries < 500ms. Firmware file serving via CDN. | Performance passes |
| 5.10.5 | **Accessibility** | axe-core zero violations on all device/iot pages. Keyboard navigation on dashboard, command interface, logs. Screen reader compatible status indicators. | Accessibility passes |
| 5.10.6 | **End-to-end device test** | Simulate device: register → claim → send telemetry → customer views dashboard → admin sees device → firmware update → customer sees update available → device updates. Full cycle. | End-to-end flow works |

---

## Phase 5 — Dependency Graph

```
5.1.1 ──► 5.1.2 ──► 5.1.3 ──► 5.1.4
                              │
              ┌───────────────┤
              ▼               ▼
        5.2.1–5.2.4      5.3.1–5.3.4
        (Registration)    (Customer dashboard)
              │               │
              └───────┬───────┘
                      ▼
              5.4.1–5.4.4
              (Admin device mgmt)
                      │
          ┌───────────┼───────────┼───────────┐
          ▼           ▼           ▼           ▼
    5.5.1–5.5.5  5.6.1–5.6.3  5.7.1–5.7.3  5.9.1–5.9.5
    (Firmware)    (Real-time)   (IoT dashboard) (B2B accounts)
          │           │           │           │
          └───────────┼───────────┼───────────┘
                      ▼
              5.8.1–5.8.3
              (Notifications)
                      │
                      ▼
              5.10.1–5.10.6
              (Security & perf)
```

## Phase 5 — Critical Path

```
5.1.1 → 5.1.2 → 5.1.4 → 5.2.1 → 5.3.1 → 5.4.1 → 5.5.2 → 5.5.3 → 5.6.1 → 5.10.4 → DONE
```

## Phase 5 — Step Count by Category

| Category | Steps | Parallelism |
|----------|-------|-------------|
| 5.1 Schema & Infrastructure | 4 | Sequential |
| 5.2 Device Registration | 4 | Sequential (after 5.1) |
| 5.3 Customer Dashboard | 4 | Parallel with 5.4 |
| 5.4 Admin Device Management | 4 | Parallel with 5.3 |
| 5.5 Firmware Management | 5 | Parallel with 5.6, 5.7, 5.9 |
| 5.6 Real-time Data | 3 | Parallel with 5.5, 5.7, 5.9 |
| 5.7 Admin IoT Dashboard | 3 | Parallel with 5.5, 5.6, 5.9 |
| 5.8 Device Notifications | 3 | After 5.5, 5.6, 5.7, 5.9 |
| 5.9 B2B Account Features | 5 | Parallel with 5.5, 5.6, 5.7 |
| 5.10 Security & Performance | 6 | Last |
| **TOTAL** | **41** | |

---

## Phase 5 — Final Checklist

Before final release, verify:

- [ ] Customer can claim device via serial + claim token
- [ ] Device list shows all customer devices with status
- [ ] Device dashboard shows real-time sensor data (or last-seen)
- [ ] Sensor charts render for all time ranges
- [ ] Customer can send commands, see history
- [ ] Customer can view device logs with filters
- [ ] Admin can view all devices, filter, bulk actions
- [ ] Admin can send any command to any device
- [ ] Firmware upload, deployment, and monitoring work
- [ ] OTA update flow works end-to-end (simulated device)
- [ ] SSE real-time stream works, reconnects
- [ ] Device health monitoring alerts fire
- [ ] Bulk operations work (reboot, firmware apply)
- [ ] Device notifications: offline, firmware, error emails
- [ ] Notification preferences save and respect toggles
- [ ] Device auth: API key validation, rotation
- [ ] Command security: whitelist, rate-limit, audit
- [ ] Data privacy: export, delete, retention
- [ ] End-to-end device cycle test passes
- [ ] B2B account: multi-user with owner/member/viewer roles works
- [ ] B2B account: seat limit enforced at invite time
- [ ] B2B account: account-level price tiers display correctly
- [ ] Developer portal placeholder page renders
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm build` — succeeds
- [ ] Lighthouse mobile ≥ 90 on device pages
- [ ] axe-core zero violations on device/iot pages
- [ ] Release note created at `docs/RELEASES/<date>.md`

---

**Phase 5 Status**: Defined — 41 steps across 10 categories  
**Phase 5 critical path**: ~10 steps (Schema → Registration → Dashboard → Admin → Firmware → Real-time → Performance)  
**Phase 5 parallel capacity**: 4 workstreams (Customer dashboard, Admin device mgmt, then Firmware + Real-time + IoT dashboard + B2B accounts)

---

# MASTER PLAN SUMMARY

| Phase | Name | Categories | Steps | Critical Path | Parallel Capacity |
|-------|------|-----------|-------|---------------|-------------------|
| 1 | Premium Public Website | 13 | 74 | ~11 steps | 3 workstreams |
| 2 | Product CMS / Admin | 9 | 43 | ~13 steps | 3 workstreams |
| 3 | Ecommerce | 9 | 48 | ~12 steps | 2 workstreams |
| 4 | Support / Ticket System | 9 | 34 | ~10 steps | 3 workstreams |
| 5 | Customer Dashboard + IoT | 10 | 41 | ~10 steps | 4 workstreams |
| **TOTAL** | | **50** | **240** | | |

## Cross-Phase Dependencies

```
Phase 1 (Public Website)
    │
    ▼
Phase 2 (CMS / Admin)
    │
    ▼
Phase 3 (Ecommerce) ──── Phase 4 (Support) ──── Phase 5 (IoT)
```

**Notes:**
- Phase 4 and Phase 5 can begin in parallel after Phase 3 completes
- Phase 4 (Support) can partially begin after Phase 2 (ticket form + KB don't need ecommerce)
- Phase 5 (IoT) requires Phase 2 (device management needs admin auth + RBAC)
- All phases assume Phase 1 is complete and verified before starting

## Estimated Total Effort

| Metric | Value |
|--------|-------|
| Total steps | 240 |
| Total categories | 50 |
| Avg steps per category | 4.8 |
| Estimated critical path length per phase | ~10-13 steps |
| Max parallel workstreams | 4 |

---

**MASTER PLAN Status**: COMPLETE — All 5 phases defined  
**Total**: 240 steps across 50 categories  
**Critical path**: Phase 1 → Phase 2 → Phase 3 → Phase 4/5 (parallel)

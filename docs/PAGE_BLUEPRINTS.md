# PAGE_BLUEPRINTS.md

Section-by-section blueprints for every public, account, and admin page. This is the implementation script for builders. Pair it with `docs/SITE_MAP.md` (routes), `docs/DESIGN_SYSTEM.md` (visual language), and `docs/CONTENT_STRATEGY.md` (voice).

For each page:

- **Intent** — the one thing the page must achieve.
- **Sections** — order matters; numbered.
- **Primary CTA** — the conversion action.
- **Motion / 3D hooks** — what moves and why.
- **Mobile notes** — what changes below 768 px.
- **SEO intent** — primary search query the page targets.

---

## 1. Home — `/`

**Intent**: in 5 seconds the visitor believes ARIOT is a serious robotics + IoT company they should explore.

**Sections** (top to bottom):

1. **Hero** — `hero` type. Full-bleed cinematic background (Seedance loop or R3F scene of an autonomous robotic arm with cyan signal lights). Eyebrow `[ROBOTICS · IOT · ENGINEERED IN BD]`. Display-1 headline `[HERO_HEADLINE]`. Body-lg subhead `[HERO_SUBHEAD]`. Two CTAs: primary "Explore products", secondary "Request a quote". A small scroll-cue at the bottom.
2. **Trust strip** — `logo-strip`. Partner / customer / certification logos (when available, else placeholder lockups). 60% opacity, hover 100%.
3. **What ARIOT does** — `feature-stack` (alternating). Three rows: *Autonomous Robotics*, *Connected IoT Systems*, *Custom Solutions*. Each row: title, 2-line body, CTA, and a square media tile (Seedream image or short Seedance loop).
4. **Featured products** — `feature-grid` 3-up. Top three products. Cyan price tag (BDT primary, USD parenthetical), mini spec chips (e.g., `IP65`, `LiDAR`, `4G/LTE`). CTA: "View all products".
5. **Solutions by industry** — `feature-grid` 4-up. Cards for *Smart Factory*, *Smart Agriculture*, *Smart City*, *Education*. Each card has a blueprint-style line illustration.
6. **Why ARIOT** — `metric-band`. Four mono digits with cyan accents: years in operation, deployments, regional offices/distributors, support response SLA. All `[BRACKETED]` until real numbers exist.
7. **Innovation lab teaser** — `media-showcase`. **L3**: latest 3 published `BlogPost` rows via `safeGetLatestPublishedPosts(3)` (title, category, excerpt, published date, cover image, link). Static `BLOG_TEASERS` fallback only when zero DB posts; section collapses honestly when both empty.
8. **Testimonial / case study** — `testimonial`. One marquee quote, photo, role, company. Side: link to full case study.
9. **Quote / contact band** — `cta-band`. Two CTAs: "Request a quote" (primary), "Talk to sales" (secondary). Subtext: regional office locator hint.
10. **Footer** — global footer (see §13).

**Primary CTA**: "Request a quote" (sticky on scroll past 60% on desktop, sticky bottom on mobile).

**Motion / 3D hooks**:

- Hero R3F scene: slow camera dolly tied to scroll first 20% of page, then handed off to native scroll.
- Section reveals on enter (16 px translate + opacity, `--dur-4 / --ease-out-expo`).
- Featured product cards: hover lift + cyan ring.
- Metric digits count up from 0 once in viewport (clamp by `prefers-reduced-motion`).

**Mobile notes**:

- Hero swaps R3F for a Seedance loop with poster fallback; height drops to 88vh.
- `feature-stack` rows stack vertically; media tile sits above text.
- Sticky bottom CTA: "Request a quote".

**SEO intent**: brand queries (`ARIOT`, `ARIOT robotics`) + category-defining queries (`robotics company Bangladesh`, `IoT company Bangladesh`). Structured data: `Organization`, `WebSite`, `BreadcrumbList`.

---

## 2. Products (catalog) — `/products`

**Intent**: let any visitor — technical or not — find the right product in under 30 seconds.

**Sections**:

1. **Page header** — `hero` (compact). Eyebrow `[PRODUCTS]`. Title "All products". Subhead body-lg with positioning sentence. Optional small Seedance ambient loop on the right.
2. **Filter + grid layout** — two-column on desktop:
   - **Left rail (sticky)**: filter facets — Category (industrial robotics, smart-city IoT, smart-building IoT, prosumer, education, custom), Use case (factory, agriculture, energy, security, education), Connectivity (Wi-Fi, 4G/LTE, LoRaWAN, Zigbee, Ethernet), Price range, Availability, Sort.
   - **Right grid**: product cards (3-up desktop, 2-up tablet, 1-up mobile). Each card: image, name, short tagline, key spec chips, price (BDT primary, USD secondary), "Add to cart" or "Request quote" depending on SKU type, secondary "View details".
3. **Pagination or infinite scroll** — pagination preferred for SEO; load-more button as enhancement.
4. **Compare bar** (sticky, appears when ≥ 2 selected) — "Compare 2 products" → comparison page or modal.
5. **Cant find what you need?** — `cta-band`. "Request a custom solution" → quote page.
6. **Footer**.

**Primary CTA**: per-card — Add to cart or Request quote.

**Motion / 3D hooks**: card hover lift, filter chip ripple on apply, smooth scroll-restore on back navigation.

**Mobile notes**: filters collapse into a bottom drawer triggered by a sticky filter button. Sort is a separate trigger. Compare bar pinned at top.

**SEO intent**: `[robotics products bangladesh]`, `[iot devices south asia]`. Structured data: `BreadcrumbList`, `ItemList` of products.

---

## 3. Product detail — `/products/:slug`

**Intent**: convince the visitor this product is the right choice, with all evidence on one page.

**Sections**:

1. **Breadcrumb** — Products > Category > Product.
2. **Hero gallery + buy box** — two-column. Left: media gallery (image carousel with thumbnails + a Seedance product loop tab + 3D viewer tab for hero SKUs). Right: name, eyebrow category chip, short tagline (~14 words), spec highlight chips, price block (BDT primary, USD secondary, optional EMI hint), variant selector (color/version/length), stock status, primary CTA (Add to cart for B2C SKUs, Request quote for B2B SKUs, both for hybrid), secondary "Download datasheet", trust mini-row (warranty, ships from BD, support included).
3. **Tabbed detail** — `tabbed-detail`. Tabs: *Overview*, *Specifications*, *Downloads*, *Compatibility*, *FAQ*, *Reviews* `[future]`.
   - **Overview**: long-form copy with media interleave. 3–6 paragraphs, hero feature stack with images.
   - **Specifications**: monospaced table; values mono-aligned; collapsible groups (Mechanical, Electrical, Connectivity, Environmental, Software).
   - **Downloads**: datasheet (PDF), quick-start guide, full manual, firmware files (versioned), CAD files when available.
   - **Compatibility**: list of related ARIOT products, third-party systems supported, protocols.
   - **FAQ**: accordion of common pre-sale questions.
4. **In the box** — `feature-grid` 4-up of icons + labels.
5. **Use cases** — `feature-stack`. 2–3 deployments with imagery.
6. **Comparison** — `comparison-table` against 2–3 sibling SKUs. Mono digits, cyan checkmarks.
7. **Related products** — `feature-grid` 3-up.
8. **CTA band** — "Need this for an enterprise rollout?" → quote.
9. **Footer**.

**Primary CTA**: Add to cart (B2C) / Request quote (B2B). Sticky on scroll on mobile and below the fold on desktop.

**Motion / 3D hooks**: gallery cross-fade between media types; 3D viewer with orbit + zoom (lazy loaded); spec table row highlight on hover.

**Mobile notes**: gallery becomes swipeable with dot indicators; buy box collapses into a sticky bottom sheet that expands on tap; tabs become an accordion.

**SEO intent**: `[product name]`, `[category use case]`. Structured data: `Product` with `offers`, `aggregateRating`, `brand`, `gtin`, `BreadcrumbList`.

---

## 4. Solutions — `/solutions`

**Intent**: industry decision-makers see ARIOT speaks their language.

**Sections**:

1. **Hero** — eyebrow `[SOLUTIONS]`, title "Engineered for your industry", subhead, ambient Seedance loop.
2. **Industry grid** — `feature-grid` 4-up: Smart Factory, Smart Agriculture, Smart City, Energy & Utilities, Education, Custom (6 cards in a 3×2). Each card: line illustration, name, 1-line outcome, "Learn more".
3. **How an ARIOT engagement works** — `timeline`. 5 steps: Discover → Design → Pilot → Deploy → Support.
4. **Featured case study** — `media-showcase` with metrics overlay.
5. **Latest IoT updates** — **L3**: latest published `BlogPost` rows categorized `iot-in-bangladesh` via `safeGetPublishedPostsByCategory('iot-in-bangladesh', 3)`. Omitted when empty. Static solutions core otherwise unchanged.
6. **CTA band** — "Discuss your project" → quote.
7. **Footer**.

**Primary CTA**: "Discuss your project" / "Request a quote".

**Motion / 3D hooks**: timeline draws cyan line on scroll; case-study video plays on viewport entry (muted, looped).

**Mobile notes**: grid stacks 1-up; timeline becomes vertical with smaller markers.

**SEO intent**: `[smart factory bangladesh]`, `[iot solutions south asia]`. Structured data: `Service` per solution.

---

## 4b. Solution detail — `/solutions/:slug`

**Intent**: the buyer in a specific industry sees ARIOT understands their problem and has a credible solution.

**Sections**:

1. **Hero** — eyebrow industry name, title outcome-led ("Cut warehouse pick-time by [X%]"), subhead, video.
2. **The problem** — body copy + supporting stats (`metric-band`).
3. **Our approach** — `feature-stack` 3-up.
4. **Tech stack used** — chips of products and protocols.
5. **Case study** — narrative with imagery + outcome metrics.
6. **Related products** — grid.
7. **CTA band** — quote.
8. **Footer**.

**Primary CTA**: Request a quote.

**Motion / 3D hooks**: stats count up; case-study scrubbable video.

**Mobile notes**: standard stacking; tech-stack chips wrap.

**SEO intent**: `[industry] [outcome]` long-tail.

---

## 4b. Robotics / R&D — `/robotics`

**Intent**: demonstrate ARIOT is genuinely engineering autonomous robotics — honest prototype/R&D positioning that builds technical credibility.

**Sections** (launch scope, L3):

1. **Hero** — robotics brand statement with honest "prototype / R&D-stage" language.
2. **Core static content** — capability narrative, development areas (CleanBot, navigation, LiDAR/SLAM, field validation).
3. **Updates** — **L3**: latest published `BlogPost` rows categorized `robotics-rd` via `safeGetPublishedPostsByCategory('robotics-rd', 3)`. Omitted entirely when no matching posts (professional empty state — no stub cards).

**Primary CTA**: Request a quote / contact.

**SEO intent**: robotics + R&D queries (`[robotics company bangladesh]`, `[autonomous floor cleaning robot]`).

---

## 4c. Research — `/research`

**Intent**: position ARIOT as an R&D-driven organization with credible engineering output.

**Sections** (launch scope, L3):

1. **Hero** — research narrative.
2. **Core static content** — research areas, focus areas, honest R&D-stage disclosure.
3. **Recent engineering notes** — **L3**: latest published `BlogPost` rows categorized `engineering-notes` via `safeGetPublishedPostsByCategory('engineering-notes', 3)`. Omitted when empty.

**Primary CTA**: Request a quote / contact.

**SEO intent**: research + engineering queries.

---

## 5. Support — `/support`

**Intent**: existing customers solve their problem in under a minute, or open a ticket cleanly.

**Sections**:

1. **Hero search** — large search input, subtle background grid; placeholder `Search manuals, articles, firmware…`. Below: most-popular articles row.
2. **Top categories** — `feature-grid` 6-up: Getting started, Setup & install, Connectivity, Firmware, Troubleshooting, Warranty & returns.
3. **Manuals & datasheets** — link out to `/support/manuals`.
4. **Firmware downloads** — link out to `/support/firmware`.
5. **Still stuck?** — `cta-band` with two CTAs: "Open a ticket" (primary), "Email us" (secondary).
6. **Service status** `[future]` — uptime widget for IoT cloud.
7. **Footer**.

**Primary CTA**: Open a ticket.

**Motion / 3D hooks**: search input pulse on focus; category card hover lift.

**Mobile notes**: search input is the entire viewport top; categories stack 2-up.

**SEO intent**: `[product] manual`, `[product] firmware`, `[problem] [product]`. Structured data: `WebSite` with `SearchAction`.

---

## 5b. Support article — `/support/article/:slug`

**Intent**: solve the visitor's specific problem with clear steps.

**Sections**:

1. **Breadcrumb**.
2. **Title + meta** — last-updated date, applicable products chips, reading time.
3. **TOC** — sticky on desktop.
4. **Body** — long-form markdown render with rich blocks: callouts, code, image, video, step list, expandable sections.
5. **Was this helpful?** — yes/no with optional follow-up text.
6. **Related articles**.
7. **Open a ticket** — micro-CTA.
8. **Footer**.

**Primary CTA**: "Was this helpful?" (telemetry).

**Motion / 3D hooks**: TOC active item slides; image zoom on click.

**Mobile notes**: TOC becomes top-of-article collapsible.

**SEO intent**: long-tail problem queries. Structured data: `TechArticle` or `FAQPage` where applicable.

---

## 6. Blog / Innovation Lab — `/blog`

**Intent**: prospects and the engineering community see ARIOT as a thought leader, not just a vendor.

**Implementation note (L3)**: `/blog` and `/blog/:slug` now read from **published `BlogPost` rows** in the database (`server/public/blog.ts`). Drafts, archived, and category-unpublished posts are excluded. Metadata and `BlogPosting` JSON-LD derive from the real post. Caching: indefinite ISR (`revalidate = false`) with on-demand `revalidatePath` on admin mutations.

**Sections**:

**Sections**:

1. **Hero** — featured post with full-bleed image, eyebrow category, title, subtitle, author + date, "Read".
2. **Category strip** — pill-shaped tabs.
3. **Latest posts grid** — `feature-grid` 3-up. Each card: cover image (Seedream-generated), category chip, title, 2-line excerpt, author + reading time.
4. **Build logs / innovation lab section** — special-styled showcase of long-form posts (gradient border, "LAB" badge).
5. **Newsletter CTA** — `cta-band` with email input.
6. **Footer**.

**Primary CTA**: Newsletter subscribe + Read.

**Motion / 3D hooks**: card hover lift; featured hero subtle parallax.

**Mobile notes**: grid stacks; category tabs scroll horizontally.

**SEO intent**: topical authority queries (see `docs/CONTENT_STRATEGY.md`). Structured data: `Blog` + per-post `BlogPosting`.

---

## 6b. Blog post — `/blog/:slug`

**Intent**: deliver the read; convert long-form readers into newsletter subs / leads.

**Sections**:

1. **Hero image** — full-bleed cover.
2. **Title block** — eyebrow category, title display-2, subtitle body-lg, author chip with avatar, date, reading time.
3. **TOC** — sticky on desktop, top-collapsible on mobile.
4. **Body** — rich markdown render (callouts, code blocks with copy, embeds, images with captions, pull quotes, tables).
5. **Author bio** — small card.
6. **Newsletter CTA** — inline.
7. **Related posts** — `feature-grid` 3-up.
8. **Comments** `[future, evaluate need]`.
9. **Footer**.

**Primary CTA**: Subscribe.

**Motion / 3D hooks**: progress bar at the top; image-fade on scroll.

**Mobile notes**: TOC collapsible; share bar bottom-pinned.

**SEO intent**: target keyword in title + h2s. Structured data: `BlogPosting` with author, datePublished, image, headline.

---

## 7. About — `/about`

**Intent**: the visitor walks away believing ARIOT is real, capable, and the team is credible.

**Sections**:

1. **Hero** — eyebrow `[OUR STORY]`, title manifesto-style headline, subhead, large founder/lab photo (Seedream-style hero allowed).
2. **Mission** — single big paragraph centered, ≤ 240 chars.
3. **By the numbers** — `metric-band`.
4. **Story timeline** — `timeline` of milestones (founding, first product, first deployment, expansion).
5. **Team** — grid of team members (link to `/about/team`).
6. **Manufacturing & quality** — `media-showcase` (link to `/about/manufacturing`).
7. **Certifications & partners** — `logo-strip`.
8. **Press / news** — strip of recent mentions.
9. **CTA band** — "Work with us" → careers `[future]` / contact.
10. **Footer**.

**Primary CTA**: Contact / Careers (when live).

**Motion / 3D hooks**: timeline cyan line draws on scroll; team photos with subtle parallax.

**Mobile notes**: timeline vertical; team grid 2-up.

**SEO intent**: `[ARIOT about]`, `[robotics company bangladesh team]`. Structured data: `Organization`, `Person` per leader.

---

## 8. Contact — `/contact`

**Intent**: visitor reaches the right team without friction.

**Sections**:

1. **Hero** — eyebrow `[CONTACT]`, title "Talk to us", subhead.
2. **Contact channels grid** — 3-up: Sales, Support, Press. Each card: icon, what to use it for, email, phone, response SLA.
3. **Contact form** — name, company (optional), email, topic dropdown (Sales / Support / Partnership / Press / Other), message, file upload (optional). On submit → `/api/contact`.
4. **Office locator** — map with offices and a list with addresses, hours, photos.
5. **Footer**.

**Primary CTA**: Submit form.

**Motion / 3D hooks**: subtle map fade-in on entry.

**Mobile notes**: map collapses to a static image with "Open in Maps" link.

**SEO intent**: `[ARIOT contact]`, `[ariot bangladesh office]`. Structured data: `Organization` with `address`, `contactPoint`.

---

## 9. Quote request — `/quote`

**Intent**: capture a high-quality B2B lead in one form, no friction.

**Sections**:

1. **Hero** — eyebrow `[QUOTE]`, title "Request a quote", subhead "We'll respond within [SLA]".
2. **Multi-step form** (3 steps with progress indicator):
   - **Step 1 — Project**: industry, use case, timeline, expected scale (units / sites).
   - **Step 2 — Products**: select interested products / categories (multi-select); free-text "what you're trying to achieve".
   - **Step 3 — Contact**: name, company, role, email, phone, country (BD default), preferred contact channel, file upload (RFP / specs).
3. **Confirmation screen** — quote ID, expected response time, link to "Browse products while you wait".
4. **Side panel** — "What happens next" (timeline of: confirmation email → assigned engineer → call → proposal).
5. **Footer**.

**Primary CTA**: Continue → Submit.

**Motion / 3D hooks**: step transitions slide horizontally; success uses a subtle cyan checkmark draw.

**Mobile notes**: side panel collapses below the form.

**SEO intent**: low — this page is conversion-focused, not search. `noindex` if needed.

---

## 10. Cart — `/cart`

**Intent**: cart review with zero confusion, clear path to checkout.

**Sections**:

1. **Header** — page title "Your cart", subline `N items · BDT total`.
2. **Two-column layout (desktop)**:
   - **Left**: line items with quantity steppers, variant labels, remove, save-for-later, line price (BDT primary, USD secondary).
   - **Right (sticky)**: order summary — subtotal, shipping (calculated when address known), VAT, voucher input, total, primary CTA "Proceed to checkout".
3. **You might also like** — `feature-grid` 3-up.
4. **Footer** (compact).

**Primary CTA**: Proceed to checkout.

**Motion / 3D hooks**: line-item update animates quantity; total flickers cyan briefly.

**Mobile notes**: order summary becomes a sticky bottom bar with expandable detail.

**SEO intent**: `noindex`.

---

## 11. Checkout — `/checkout`

**Intent**: complete a purchase in one screen, no surprises.

**Sections** (single page, three logical groups):

1. **Header** — minimal: logo, "Secure checkout" lock chip, support link.
2. **Group 1 — Contact + shipping**: email, phone, country (BD default with regional rules), address with autocomplete, shipping method choice with ETA + cost.
3. **Group 2 — Payment**: tabs for `bKash`, `Nagad`, `SSLCommerz`, `Stripe` `[future]`. Each tab renders the provider's input or "you'll be redirected" notice. PCI-sensitive fields render via the provider's hosted iframe — never a custom card form on our domain.
4. **Group 3 — Review**: line items summary, address summary, payment summary, voucher final state, total. Place order CTA.
5. **Trust strip** — security badges, return policy chip, support phone.
6. **Compact footer**.

**Primary CTA**: Place order.

**Motion / 3D hooks**: minimal — this is a focus zone. Group expand/collapse uses `--dur-2`.

**Mobile notes**: all three groups stack; place-order CTA is a sticky bottom button.

**SEO intent**: `noindex`. Structured data: none.

**Edge cases**: payment redirect / 3DS handoff / cancellation recovery — see `docs/ECOMMERCE_PLAN.md`.

---

## 12. Account dashboard — `/account/*`

**Intent**: returning customer manages orders, downloads, tickets, and devices.

**Layout**: shell with left rail nav (Orders, Quotes, Downloads, Addresses, Tickets, Profile, Devices `[future]`) and main content area.

**Per page**:

- `/account` — greeting, order summary card, recent ticket card, "what's new" mini feed.
- `/account/orders` — table with status chips, order date, total, action menu.
- `/account/orders/:id` — order timeline (ordered, paid, packed, shipped, delivered) with timestamps; line items; downloads; reorder CTA; support link.
- `/account/downloads` — purchased downloads list with version chips; download link signs a temporary URL.
- `/account/quotes` — table of quote requests with status (received, in review, responded, won, lost).
- `/account/tickets` — list of tickets with last-update.
- `/account/tickets/:id` — thread view with message composer.
- `/account/profile` — name, email, phone, language preference, password, 2FA `[future]`.
- `/account/devices` `[future]` — registered IoT devices list, device pairing flow.

**Primary CTA**: contextual per page (Track order, Reorder, Open ticket).

**Motion / 3D hooks**: minimal; subtle row hover, status chip pulse on update.

**Mobile notes**: left rail becomes a top dropdown.

**SEO intent**: `noindex` for all account routes.

---

## 13. Global elements (header, footer, modals)

### Header

- Sticky, 72 px desktop / 60 px mobile, `--bg-base` with subtle bottom border `--steel-800`.
- Left: logo. Center: nav (Products, Solutions, Support, Blog, About). Right: search, cart, account, currency switch (BDT/USD), language switch `[future]`.
- On scroll: background gains 80% opacity + 16 px backdrop blur.
- Mobile: hamburger opens a full-height drawer with nav + bottom CTA.

### Footer

- 4-column on desktop:
  - Column 1: brand, tagline, social.
  - Column 2: Products links + Solutions links.
  - Column 3: Support links + Company links.
  - Column 4: Newsletter form + Office address + payment-provider logos (bKash, Nagad, SSLCommerz, Visa, Mastercard, eventual Stripe).
- Bottom row: copyright, legal links (privacy, terms, cookies, warranty, shipping & returns), language switch `[future]`.
- Mobile: columns stack; nav becomes accordion.

### Modals & drawers

- Cart drawer (right): opens on add-to-cart with a brief confirm + "View cart" / "Checkout".
- Search command palette (`Ctrl/Cmd+K`): instant search across products, solutions, blog, support.
- Quick view (`feature-grid` cards): optional product modal with hero + buy box.

---

## 14. Admin dashboard pages — `/admin/*`

See `docs/ADMIN_DASHBOARD_PLAN.md` for the full page-by-page spec. Headlines for the blueprint cross-reference:

- `/admin` — KPI overview: today's orders, revenue (BDT/USD toggle), open tickets, pending quotes, low-stock alerts, traffic mini-chart.
- `/admin/products` — table with search/filter, bulk actions, "+ New product".
- `/admin/products/:id` — tabbed editor: Details, Media, Variants, Inventory, SEO, Related, History.
- `/admin/orders` — table; row click opens detail with state-machine controls.
- `/admin/quotes` — table; detail view supports assignment, internal notes, response composer, "convert to order".
- `/admin/tickets` — list + thread; macros, internal notes, status SLA timer.
- `/admin/blog` — posts list; rich editor; preview; schedule.
- `/admin/media` — library with folders, tags, upload, replace, usage map.
- `/admin/customers` — list; detail shows orders, tickets, quotes, lifetime value.
- `/admin/users` / `/admin/roles` / `/admin/audit-log` — internal admin management.
- `/admin/settings` — currency, taxes, shipping zones, payment providers, email templates, site metadata.
- `/admin/analytics` — sales by channel, traffic by source, support SLA, conversion funnels.

---

## 15. Cross-page conventions

- **Skeletons** for every async region — never blank gaps.
- **Empty states** that teach (e.g., empty cart shows "Browse featured products").
- **Error states** that recover (network error toast with retry; form error with inline guidance).
- **Toasts** for non-blocking confirmations (added to cart, copied link).
- **Confirmation dialogs** for destructive actions (delete order, cancel ticket).
- **Pagination** preferred over infinite scroll for indexable content.
- **Breadcrumbs** on every page deeper than one level (except auth and checkout).
- **OG images** generated per page via `app/api/og` using design tokens.

# ECOMMERCE_PLAN.md

The complete catalog → cart → checkout → fulfillment plan for ARIOT, with regional payment placeholders (bKash, Nagad, SSLCommerz) and Stripe-ready scaffolding for later. Pair with `docs/DATABASE_SCHEMA_PLAN.md` (data), `docs/PAGE_BLUEPRINTS.md` (UI), and `docs/ADMIN_DASHBOARD_PLAN.md` (operations).

Ecommerce ships in **Phase 3**. Earlier phases use the same data model but expose only catalog reads and quote requests.

---

## 1. Principles

1. **Server is the source of truth.** The client never computes the final total. Every checkout submission is recomputed server-side; mismatches are rejected.
2. **Regional first, global ready.** BDT primary, USD secondary. Payment adapters are pluggable; bKash, Nagad, SSLCommerz on day one; Stripe scaffolded for later.
3. **Race-safe state.** Stock decrement, payment capture, and order state transitions happen in a transaction or via idempotent outbox events.
4. **No dark patterns.** No hidden fees, no forced sign-up before checkout, no fake countdowns, no pre-ticked add-ons.
5. **Failure is a feature.** Cancelled / failed flows recover gracefully — saved cart, link to retry, support handoff.

---

## 2. Catalog

### 2.1 Listing (`/products`)

- Server-rendered grid; data sourced from `Product` (status `PUBLISHED`).
- Filters: category, use case, connectivity, price range, availability, sales type. Filters reflect in URL query params.
- Sort: featured, newest, price asc / desc, popular (server-defined).
- Card content: image, name, tagline, key spec chips, price (BDT primary, USD secondary), in-stock badge, Add-to-cart or Request-quote per `salesType`.
- Pagination: server-side cursor; "Load more" enhancement on top.

### 2.2 Detail (`/products/:slug`)

- Variant selector — option groups dynamically generated from `ProductVariant.optionValues`.
- Price / stock update reactively when variant changes.
- Buy box CTA logic by `salesType`:
  - `B2C` — only Add to cart.
  - `B2B` — only Request quote (jumps to `/quote?product=:slug`).
  - `HYBRID` — Add to cart primary; Request quote secondary (visible for high-volume / custom-fit needs).
- Stock messaging:
  - `IN_STOCK` + `stock > 0`: "In stock — ships from [CITY] in [N] business days."
  - `IN_STOCK` + `stock = 0`: hidden Add to cart, secondary "Notify me" form.
  - `BACKORDER`: "On backorder — expected to ship by [DATE]."
  - `MADE_TO_ORDER`: "Made to order — typical lead time [N] weeks."
- Trust strip in the buy box: warranty, returns, support, shipping origin.
- Recently viewed (cookie-based) and Related products (from `ProductRelation`).

### 2.3 Search

- Phase 3 launches with Postgres FTS + `pg_trgm`.
- Search is exposed via the global header command palette (`Ctrl/Cmd+K`).

---

## 3. Cart

### 3.1 Persistence

- **Guest cart**: backed by a `Cart` row keyed on a signed cookie `cartToken` (HTTP-only, Secure, SameSite=Lax). 30-day expiry.
- **Authenticated cart**: keyed on `userId`. On sign-in, the guest cart is **merged** into the user cart (sum of identical lines, additive otherwise). The merge is server-side and idempotent.

### 3.2 Server actions

- `addToCart(productId, variantId?, quantity)`
- `updateQuantity(itemId, quantity)`
- `removeItem(itemId)`
- `applyVoucher(code)`
- `removeVoucher()`
- `setCurrency(currency)` — switches BDT ↔ USD; recomputes display.
- `clearCart()`

Each action:

1. Validates input via Zod.
2. Re-fetches product/variant for current price + stock.
3. Snapshots `unitPriceMinor` at time of add (price changes after add do not retroactively change cart unless explicitly re-priced at checkout review).
4. Returns the updated cart with totals.
5. Revalidates relevant tags.

### 3.3 UX

- **Cart drawer** — slides in on add-to-cart with: item just added, mini-summary, "View cart" / "Checkout".
- **Cart page** (`/cart`) — full review with line edits, voucher input, currency switch, sticky summary, "Proceed to checkout".
- **Empty state** — "Your cart is empty. Browse featured products."

### 3.4 Vouchers

- Voucher applies at cart level only (Phase 3). Per-product / category-restricted vouchers in a later phase.
- Validation rules:
  - Active and within `validFrom`/`validUntil`.
  - `minSubtotalMinor` met.
  - `usageLimit` (global) and `perCustomerLimit` not exceeded.
  - Currency matches when `kind = FIXED`.
- Server returns a structured error if invalid; UI shows the human reason.

---

## 4. Checkout

Checkout is a **single page** at `/checkout` with three logical sections, server-streamed for fast TTFB.

### 4.1 Section 1 — Contact + Shipping

- Email (auto-filled if logged in).
- Phone (E.164; BD default; required for COD and provider verification).
- Shipping address (BD default with district + postcode optional; relaxed validation for SA countries).
- Billing same-as-shipping toggle.
- Shipping method selection — derived from `Shipping zone × order weight × destination` (admin-configured).
- Save address checkbox (auth users only).

### 4.2 Section 2 — Payment

- Tabs (only enabled providers):
  - **bKash**
  - **Nagad**
  - **SSLCommerz** (covers cards + mobile financial services + nagad/bkash via aggregator if direct integrations are temporarily unavailable)
  - **Cash on Delivery** (for select zones, configurable)
  - **Stripe** `[future]` — scaffolded but disabled until international rollout
- Each tab renders the provider's hosted iframe / redirect cue. **No raw card data** ever touches our domain.
- Provider selection persists per-user preference.

### 4.3 Section 3 — Review

- Recomputed line items, address, shipping method, voucher state, totals.
- Place-order CTA — disabled until all sections valid.
- Trust strip beneath: secure-checkout chip, return policy chip, support phone.

### 4.4 Server-side checkout flow

1. **Create draft order** — server action validates the cart, recomputes prices server-side, locks stock optimistically (reserves units for 15 minutes), creates an `Order` with status `CREATED`.
2. **Initiate payment** — calls the selected provider adapter's `createIntent(order)`. Returns either:
   - A redirect URL → browser navigates.
   - A hosted form payload → client renders the iframe.
3. **Order moves to `AWAITING_PAYMENT`** with a `Payment` row in `PENDING`.
4. **Customer pays** via provider.
5. **Webhook arrives** → handler verifies signature + idempotency key, marks `Payment` as `CAPTURED`, transitions `Order` to `PAID`, decrements stock, emits `order.paid` event.
6. **Failure** → `Payment` `FAILED`; reservation released; user redirected to `/checkout/cancelled/:orderId` with retry option.

### 4.5 Server-authoritative totals

- The client may display a total, but on `placeOrder` the server recomputes:
  - Line items × current/snapshot prices.
  - Shipping based on configured zones.
  - Tax (VAT) per country setting.
  - Voucher discount applied per rules.
  - Totals match — or the order is rejected with a "prices changed" prompt.

---

## 5. Payment integration plan

### 5.1 Adapter contract

Every payment adapter under `server/payments/<provider>/` exposes:

```ts
type PaymentAdapter = {
  createIntent(input: CreateIntentInput): Promise<CreateIntentResult>;
  capture(intentId: string): Promise<CaptureResult>;       // for providers with auth+capture split
  refund(intentId: string, amountMinor?: bigint): Promise<RefundResult>;
  verifyWebhook(req: Request): Promise<VerifiedWebhook>;
  mapStatus(providerStatus: string): PaymentStatus;
};
```

Each adapter owns:

- Credentials (read from `server/env.ts`, never inline).
- HTTP client with timeouts and retry policy.
- Mapping from provider status codes to our `PaymentStatus` enum.
- Logging (PII-scrubbed) and metrics.

### 5.2 Provider-specific notes

- **bKash** — sandbox + production; supports tokenized + checkout flows; webhook via configured callback URL; idempotency by `paymentID`.
- **Nagad** — sandbox + production; redirect-based flow; signature verification; idempotency by `orderId + paymentRefId`.
- **SSLCommerz** — broad coverage (cards, MFS); session-based redirect; IPN webhook; verifies via API hash check.
- **COD** — synthetic adapter: no external call; marks order `AWAITING_PAYMENT` with provider `MANUAL`; ops mark paid on delivery.
- **Stripe** `[future]` — Payment Intents API; webhook signature; 3DS handled by Stripe; account onboarding via Connect if marketplace later.

### 5.3 Webhook discipline

- Each provider has a dedicated route under `app/api/payments/<provider>/webhook/route.ts`.
- Handler order:
  1. Read raw body (per-provider HMAC requires raw bytes).
  2. Verify signature.
  3. Check `idempotencyKey` against a `WebhookEvent` table; bail if seen.
  4. Map status → update `Payment` and `Order` in a single transaction.
  5. Emit domain event (`order.paid`, `order.failed`) onto the queue.
  6. Return 2xx within 5 s. Heavy work happens in the queue worker.
- Replay safety: if a webhook arrives after the order is already in the right state, return success without further side-effects.

---

## 6. Order state machine

```
CREATED ─► AWAITING_PAYMENT ─► PAID ─► PACKED ─► SHIPPED ─► DELIVERED ─► COMPLETED
              │                  │       │         │           │
              ▼                  ▼       ▼         ▼           ▼
           CANCELLED         CANCELLED  ...     ...         (refund)
              │                  │
              ▼                  ▼
            FAILED            REFUNDED
```

### 6.1 Allowed transitions

| From | To | Trigger |
|---|---|---|
| `CREATED` | `AWAITING_PAYMENT` | Customer clicks place-order |
| `CREATED` | `CANCELLED` | Cart abandoned / explicit cancel |
| `AWAITING_PAYMENT` | `PAID` | Payment webhook |
| `AWAITING_PAYMENT` | `CANCELLED` | Customer cancels / timeout |
| `AWAITING_PAYMENT` | `FAILED` | Provider failure |
| `PAID` | `PACKED` | Admin marks packed |
| `PAID` | `REFUNDED` | Refund |
| `PACKED` | `SHIPPED` | Admin marks shipped + tracking |
| `SHIPPED` | `DELIVERED` | Carrier webhook or admin |
| `DELIVERED` | `COMPLETED` | Auto after N days post-delivery |
| `DELIVERED` | `REFUNDED` | Return + refund |

### 6.2 Stock

- **Reservation** at `CREATED` (15 min hold).
- **Decrement** at `PAID`.
- **Release reservation** at `CANCELLED` or `FAILED`.
- **Restock** at `REFUNDED`.

All operations in a DB transaction with row-level locks on `Product.stock` / `ProductVariant.stock`.

### 6.3 Refunds

- Full or partial.
- Reason required.
- Goes through provider adapter's `refund()`; status reflected on the `Payment` row.
- Email notification on success.
- Stock restored on full refund of an item; partial refunds do not restock automatically (admin choice).

---

## 7. Stock management

- Authoritative columns: `Product.stock` (when no variants) or per-`ProductVariant.stock`.
- Movements logged in a `StockMovement` table (FK product/variant, delta, reason, orderId / refundId / adjustmentId, actorId).
- Reorder point + reorder quantity per product/variant; low-stock alert in `/admin` Overview when `stock <= reorderPoint`.
- Physical stock is **never** negative. `stockPolicy = BACKORDER` means the product may be **sold while on-hand quantity is zero** — it does **NOT** permit a negative physical `stock` value (corrected 2026-08-29, decision D-076 / D-071). `MADE_TO_ORDER` may be ordered with zero on-hand. Stock authority: a product with active variants uses each `ProductVariant.stock`; a product without variants uses `Product.stock` (D-072).

---

## 8. Customer emails

All emails rendered server-side using design tokens (React Email or equivalent), delivered via Resend.

| Event | Audience | Trigger |
|---|---|---|
| `order.created` (informational) | Customer | Optional; usually skipped to avoid noise |
| `order.placed` | Customer | At `CREATED` if payment is asynchronous (e.g., COD) |
| `payment.received` | Customer | At `PAID` |
| `order.shipped` | Customer | At `SHIPPED` (with tracking) |
| `order.delivered` | Customer | At `DELIVERED` |
| `order.cancelled` | Customer | At `CANCELLED` |
| `order.refunded` | Customer | On refund |
| `order.payment_failed` | Customer | On `FAILED` (with retry link) |
| `quote.received` | Customer | On quote submission |
| `quote.responded` | Customer | When sales sends a response |
| `ticket.created` | Customer | On ticket open |
| `ticket.replied` | Customer | On agent reply |
| `ticket.resolved` | Customer | On resolution + CSAT survey |
| `low_stock` | Admin (sales) | When stock ≤ reorder point |
| `payment_failure_spike` | Admin (super) | Threshold alert |

Each email includes:

- ARIOT logo, brand-token-driven layout.
- Plain-text alternative.
- Unsubscribe link where the email type allows it (transactional emails do not unsubscribe).
- Localized currency in BDT; USD as parenthetical when configured.

---

## 9. Returns & warranty

- Customer-facing policy on `/legal/shipping-returns` and `/legal/warranty`.
- 14-day return window for unopened consumer items.
- Return RMA flow:
  - Customer opens a ticket of type "Return".
  - Agent issues an RMA number, generates a return label (where carrier supports it).
  - On receipt, agent processes refund (full or partial) — order moves to `REFUNDED`.
- Warranty claim:
  - Ticket of type "Warranty".
  - Outcomes: replace / repair / refund — each updates the customer's order or generates a replacement order.

---

## 10. B2B specifics

- `salesType = B2B` SKUs do not surface Add-to-cart.
- Quote-to-order conversion in admin pre-fills an order with custom pricing, custom shipping, and a manual payment provider (`MANUAL` — invoice + bank transfer).
- B2B customers may have an account-level price tier `[Phase 5]`.

---

## 11. Internationalization-ready (regional first)

- Default country: `BD`. Currency: `BDT`.
- Supported countries (Phase 3): `BD`, `IN`, `LK`, `NP`, `BT`, `MV` (configurable; ship address validation relaxed outside `BD`).
- USD secondary display everywhere; canonical price stored once.
- FX snapshot daily; admin can override.

---

## 12. Phase 3 exit checklist

- [ ] Successful checkout via each enabled provider on staging.
- [ ] Refund flow tested per provider.
- [ ] Stock decrement / restore verified under simulated concurrent buys.
- [ ] Webhook signature + idempotency tested with replay.
- [ ] All transactional emails delivered, brand-consistent.
- [ ] Admin can fulfill an order without spreadsheet help.
- [ ] Lighthouse mobile ≥ 90 on `/products/:slug`, `/cart`, and the rendered checkout review.
- [ ] Penetration test (recommended) focused on auth + cart + checkout + webhooks.
- [ ] Audit log captures every order state change.
- [ ] Backup and restore drill complete on the production DB plan.

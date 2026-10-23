# DATABASE_SCHEMA_PLAN.md

The shape of the ARIOT data model. **This is a sketch, not Prisma code yet.** It informs the eventual `prisma/schema.prisma` and any migration plan. Keep it stable across phases — the entities below are designed so each subsequent phase only *adds* fields and tables, never refactors core types.

Conventions:

- Postgres + Prisma. IDs are `cuid2` strings.
- Timestamps: `createdAt`, `updatedAt` on every model; `deletedAt` (soft delete) on user-facing entities.
- Money: `priceMinor` (BigInt, smallest unit) + `currency` (`BDT` | `USD`). Never floats.
- Audit: `createdBy?`, `updatedBy?` referencing `User.id` where applicable.
- Indices on every FK and on every column used in hot `where` filters.
- Enums are uppercase singular.

---

## 1. Identity & Access

### `User`
The unified identity for both customers and admins (admins are users with one or more roles).

| Field | Type | Notes |
|---|---|---|
| id | string (cuid2) | PK |
| email | citext | unique, not null |
| emailVerifiedAt | datetime? | |
| phone | string? | E.164 |
| phoneVerifiedAt | datetime? | |
| name | string? | |
| avatarUrl | string? | |
| passwordHash | string? | argon2id; nullable for OAuth-only |
| locale | string | default `'en'`; reserved for `'bn'` later |
| preferredCurrency | enum | `BDT` \| `USD`, default `BDT` |
| status | enum | `ACTIVE` \| `SUSPENDED` \| `DELETED` |
| lastLoginAt | datetime? | |
| createdAt, updatedAt, deletedAt | | standard |

Indices: `email` (unique), `phone`.

### `Session`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| userId | string | FK `User` |
| tokenHash | string | unique, hashed session token |
| ip | string? | hashed for privacy |
| userAgent | string? | truncated |
| expiresAt | datetime | |
| createdAt | | |

### `Role`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| key | enum | `SUPER_ADMIN` \| `CONTENT_ADMIN` \| `SUPPORT_ADMIN` \| `SALES_ADMIN` |
| name | string | display |
| permissions | json | array of permission keys |

### `UserRole`
Join: `userId` × `roleId`.

### `Customer`
A view/extension of `User` for ecommerce-specific fields. Created lazily on first cart/order.

| Field | Type | Notes |
|---|---|---|
| id | string | PK = `User.id` |
| companyName | string? | for B2B contacts |
| taxId | string? | BIN/VAT for invoices |
| segment | enum | `B2C` \| `B2B` \| `EDU` |
| accountManagerId | string? | FK `User` (sales role) |
| lifetimeValueMinor | bigint | denormalized; rebuilt nightly |
| createdAt, updatedAt | | |

### `Address`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| userId | string | FK `User` |
| label | string? | "Home", "Office" |
| recipientName | string | |
| line1, line2 | string | |
| city, district | string | |
| division | string? | BD division / SA equivalent |
| postcode | string? | |
| country | string | ISO-3166-1 alpha-2; default `BD` |
| phone | string | |
| isDefaultShipping, isDefaultBilling | boolean | |
| createdAt, updatedAt | | |
### Phase 2 auth additions (Step 2.2.2, Better Auth)

- `User` gained `emailVerified Boolean @default(false)` (Better Auth flag) and retains `emailVerifiedAt DateTime?` (business field). `avatarUrl String?` maps to Better Auth `image`.
- `Session` gained `updatedAt`, Better Auth's logical `token` maps to `tokenHash`, `ipAddress` maps to `ip`.
- Added `Account` model (Better Auth shape: `accountId`, `providerId`, `accessToken`, `refreshToken`, `idToken`, `*ExpiresAt`, `scope`, `password`). `User.accounts Account[]`.
- Added `Verification` model (Better Auth shape: `identifier`, `value`, `expiresAt`). Renamed from the earlier Auth.js `VerificationToken`.
- **Migration status**: these changes are captured in `prisma/migrations/20260710081202_auth_better_auth_foundation` (GENERATED + APPLIED to LOCAL dev DB; runtime verified locally). Two spurious `searchVector` `DROP DEFAULT` statements were omitted from that migration (generated-column drift, tracked as I-019). Field mappings verified: `user.image→avatarUrl`, `session.token→tokenHash`, `session.ipAddress→ip`; all Better Auth logical fields map to the Prisma columns listed above.

---

## 2. Catalog

### `Category`
Tree structure (parent/child).

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| slug | string | unique |
| name | string | |
| description | string? | |
| parentId | string? | FK `Category` |
| order | int | within siblings |
| heroImageId | string? | FK `MediaAsset` |
| seoTitle, seoDescription | string? | |
| isPublished | boolean | |
| createdAt, updatedAt, deletedAt | | |

Indices: `slug` unique, `parentId`.

### `Product`
The flagship entity. Variants live in `ProductVariant`.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| slug | string | unique |
| name | string | |
| tagline | string? | ≤ 140 chars |
| description | mdx | long-form |
| categoryId | string | FK `Category` |
| sku | string | unique base SKU |
| brand | string | default `'ARIOT'` |
| salesType | enum | `B2C` \| `B2B` \| `HYBRID` |
| priceMinor | bigint? | base price; nullable for B2B-only quote items |
| currency | enum | `BDT` \| `USD` |
| stock | int | base stock if no variants |
| stockPolicy | enum | `IN_STOCK` \| `BACKORDER` \| `MADE_TO_ORDER` |
| weightGrams | int? | |
| dimensions | json? | `{ l, w, h, unit }` |
| status | enum | `DRAFT` \| `PUBLISHED` \| `ARCHIVED` |
| publishedAt | datetime? | |
| seoTitle, seoDescription | string? | |
| heroImageId | string? | FK `MediaAsset` |
| heroVideoId | string? | FK `MediaAsset` |
| specs | json | grouped spec table |
| highlights | json | array of bullet strings |
| inTheBox | json | array of strings |
| createdAt, updatedAt, deletedAt | | |
| createdBy, updatedBy | string? | FK `User` |

Indices: `slug` unique, `sku` unique, `categoryId`, `status`, `publishedAt`. FTS index on `name`, `tagline`, `description` via `pg_trgm` + tsvector.

### `ProductVariant`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| productId | string | FK `Product` |
| sku | string | unique, **global** (all variants incl. archived + active products); normalized **uppercase** (trim + collapse whitespace, D-069) |
| name | string | "Black, 12V" |
| optionValues | json | `{ color: 'black', voltage: '12V' }` — **free-form** key/value map (no option-group table); trimmed server-side (≤20 keys, key ≤40, value ≤100); combination uniqueness per product is **order-independent** via `optionCombinationKey` (sorted-key fingerprint, active only) |
| priceMinor | bigint? | overrides product price if set; non-negative digits only |
| currency | enum | inherits product if null (BDT/USD) |
| stock | int | **Physical on-hand; never negative (D-071).** Plain field only; inventory movements tracked in `StockMovement` (Step 2.4.6A3, D-075). `BACKORDER`/`MADE_TO_ORDER` are sellability policies, not negative-inventory permissions (D-076). With active variants, `ProductVariant.stock` is authoritative; `Product.stock` is display-only (D-072). All `DateTime` columns remain `timestamp(3) without time zone`; sessions forced UTC via `utcPoolConfig` (D-070, Step 2.4.6-0) — they are NOT converted to `timestamptz` in this step. |
| barcode | string? | EAN/UPC |
| isDefault | boolean | at most one active default per product; setting true clears the others |
| createdAt, updatedAt, deletedAt | | archive = soft-delete (`deletedAt`); archived SKU stays reserved |

Implemented in Step 2.4.5 (✅ 2026-08-18): `/admin/products/[id]/variants` + `POST /api/admin/products/variants`; concurrency via `Product.updatedAt` token; per-mutation AuditLog (entityType `Product`). No Prisma change (model already present). See decision D-069.

### `ProductImage`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| productId | string | FK `Product` |
| variantId | string? | FK `ProductVariant` (variant-specific) |
| mediaId | string | FK `MediaAsset` |
| order | int | |
| altText | string | |
| isPrimary | boolean | |
| createdAt, updatedAt | | |

### `ProductVideo`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| productId | string | FK `Product` |
| variantId | string? | FK `ProductVariant` |
| mediaId | string | FK `MediaAsset` (video file) |
| posterMediaId | string? | FK `MediaAsset` (poster image) |
| order | int | |
| caption | string? | |
| autoplayLoop | boolean | default `true` |
| createdAt, updatedAt | | |

### `ProductDownload`
Datasheets, manuals, CAD files, firmware.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| productId | string | FK `Product` |
| kind | enum | `DATASHEET` \| `MANUAL` \| `QUICKSTART` \| `CAD` \| `FIRMWARE` \| `OTHER` |
| version | string? | for firmware |
| fileMediaId | string | FK `MediaAsset` |
| sizeBytes | bigint | |
| isPublic | boolean | true = public, false = customer-only |
| createdAt, updatedAt | | |

### `ProductRelation`
Self-join: related / cross-sell / accessory.

| Field | Type | Notes |
|---|---|---|
| productId | string | FK |
| relatedProductId | string | FK |
| kind | enum | `RELATED` \| `CROSS_SELL` \| `ACCESSORY` \| `ALTERNATIVE` |
| order | int | |
PK: composite (`productId`, `relatedProductId`, `kind`).

---

## 3. Cart, Checkout, Orders

### `Cart`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| token | string? | unique, signed; for guest carts |
| userId | string? | FK `User`; null for guests |
| currency | enum | `BDT` \| `USD` |
| voucherCode | string? | applied promo |
| voucherDiscountMinor | bigint? | resolved discount |
| expiresAt | datetime? | guest carts expire after 30 days |
| createdAt, updatedAt | | |

### `CartItem`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| cartId | string | FK `Cart` |
| productId | string | FK `Product` |
| variantId | string? | FK `ProductVariant` |
| quantity | int | ≥ 1 |
| unitPriceMinor | bigint | snapshot at add-to-cart |
| currency | enum | inherited |
| createdAt, updatedAt | | |

### `Order`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| number | string | unique, human-friendly (`ARI-202504-00021`) |
| userId | string? | nullable for guest checkout |
| email | string | snapshot |
| status | enum | `CREATED` \| `AWAITING_PAYMENT` \| `PAID` \| `PACKED` \| `SHIPPED` \| `DELIVERED` \| `COMPLETED` \| `CANCELLED` \| `REFUNDED` \| `FAILED` |
| currency | enum | `BDT` \| `USD` |
| subtotalMinor | bigint | |
| shippingMinor | bigint | |
| taxMinor | bigint | |
| discountMinor | bigint | |
| totalMinor | bigint | server-authoritative |
| shippingAddress | json | snapshot |
| billingAddress | json | snapshot |
| shippingMethod | string | label |
| voucherCode | string? | |
| notes | string? | customer notes |
| placedAt | datetime? | |
| paidAt | datetime? | |
| shippedAt, deliveredAt, cancelledAt, refundedAt | datetime? | |
| createdAt, updatedAt | | |

Indices: `number` unique, `userId`, `status`, `placedAt`.

### `OrderItem`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| orderId | string | FK `Order` |
| productId | string | FK `Product` |
| variantId | string? | |
| nameSnapshot | string | snapshot at purchase |
| skuSnapshot | string | snapshot |
| unitPriceMinor | bigint | snapshot |
| quantity | int | |
| lineTotalMinor | bigint | |

### `Payment`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| orderId | string | FK `Order` |
| provider | enum | `BKASH` \| `NAGAD` \| `SSLCOMMERZ` \| `STRIPE` \| `MANUAL` |
| providerIntentId | string | unique per provider |
| amountMinor | bigint | |
| currency | enum | |
| status | enum | `PENDING` \| `AUTHORIZED` \| `CAPTURED` \| `FAILED` \| `REFUNDED` \| `PARTIALLY_REFUNDED` |
| rawPayload | json | server-only; PII-scrubbed before persist |
| capturedAt, refundedAt | datetime? | |
| createdAt, updatedAt | | |

### `Shipment`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| orderId | string | FK `Order` |
| carrier | string | |
| trackingNumber | string? | |
| status | enum | `LABEL_CREATED` \| `IN_TRANSIT` \| `DELIVERED` \| `RETURNED` |
| shippedAt, deliveredAt | datetime? | |

### `Voucher`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| code | string | unique, citext |
| kind | enum | `PERCENTAGE` \| `FIXED` |
| amount | bigint | percent (×100) or minor |
| currency | enum? | for FIXED |
| minSubtotalMinor | bigint? | |
| usageLimit | int? | total |
| perCustomerLimit | int? | |
| validFrom, validUntil | datetime? | |
| isActive | boolean | |

---

## 4. Quotes (B2B)

### `QuoteRequest`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| number | string | unique (`Q-202504-00012`) |
| userId | string? | nullable for anonymous |
| email | string | |
| name | string | |
| company | string? | |
| role | string? | |
| phone | string? | |
| country | string | ISO-3166-1 |
| industry | string? | |
| useCase | string? | |
| timeline | string? | |
| scaleHint | string? | "10-50 units", "1 site" |
| message | string | |
| attachments | json | array of media ids |
| status | enum | `RECEIVED` \| `IN_REVIEW` \| `RESPONDED` \| `WON` \| `LOST` \| `CLOSED` |
| assignedToId | string? | FK `User` |
| convertedOrderId | string? | FK `Order` |
| internalNotes | string? | |
| createdAt, updatedAt | | |

### `QuoteRequestProduct`
Multi-select interest.

| Field | Type | Notes |
|---|---|---|
| quoteId | string | FK |
| productId | string? | nullable if category-only |
| categoryId | string? | |
| quantityHint | int? | |
PK: composite.

---

## 5. Support

### `SupportCategory`
Tree.

| Field | Type | Notes |
|---|---|---|
| id, slug, name, parentId, order, isPublished, seo* | | |
| heroImageId | string? | FK `MediaAsset` |

### `SupportArticle`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| slug | string | unique |
| title | string | |
| excerpt | string? | |
| body | mdx | rich content |
| categoryId | string | FK |
| tags | json | array of strings |
| products | json | denormalized array of related product ids |
| author | string? | |
| status | enum | `DRAFT` \| `PUBLISHED` \| `ARCHIVED` |
| publishedAt | datetime? | |
| viewCount | int | default 0 |
| helpfulCount | int | denormalized counter |
| notHelpfulCount | int | denormalized counter |
| seoTitle, seoDescription | string? | |
| createdAt, updatedAt | | |
| createdBy, updatedBy | string? | |

Indices: `slug` unique, `categoryId`, `status`. FTS on `title` + `excerpt` + `body`.

### `SupportFeedback`
Anonymous helpful-vote events for analytics.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| articleId | string | FK |
| vote | enum | `YES` \| `NO` |
| comment | string? | |
| sessionHash | string | for spam control |
| createdAt | | |

### `SupportTicket`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| number | string | unique (`T-202504-00045`) |
| userId | string? | nullable for guest tickets (rare) |
| email | string | snapshot |
| subject | string | |
| categoryId | string? | FK `SupportCategory` — ticket classification |
| relatedProductId | string? | FK |
| relatedOrderId | string? | FK |
| priority | enum | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` |
| status | enum | `OPEN` \| `TRIAGED` \| `IN_PROGRESS` \| `WAITING_CUSTOMER` \| `RESOLVED` \| `CLOSED` |
| assignedToId | string? | FK `User` (support_admin) |
| slaResponseDeadlineAt | datetime? | computed from SLA policy |
| slaResolutionDeadlineAt | datetime? | computed from SLA policy |
| firstResponseAt | datetime? | |
| resolvedAt, closedAt | datetime? | |
| csatScore | int? | 1-5 stars |
| csatComment | string? | |
| createdAt, updatedAt | | |

Indices: `status`, `priority`, `categoryId`, `assignedToId`, `userId`, `createdAt`.

### `TicketMessage`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| ticketId | string | FK |
| authorId | string? | FK `User` (null = system) |
| authorRole | enum | `CUSTOMER` \| `AGENT` \| `SYSTEM` |
| body | mdx | |
| internal | boolean | true = agent-only |
| createdAt | | |

### `TicketAttachment`
Separate table for file attachments on messages.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| messageId | string | FK `TicketMessage` |
| mediaId | string | FK `MediaAsset` |
| fileName | string | original filename |
| fileSize | bigint | bytes |
| mimeType | string | validated against allow-list |
| createdAt | | |

Indices: `messageId`.

### `TicketStatusHistory`
Append-only log of all status changes, assignments, priority changes.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| ticketId | string | FK |
| kind | enum | `STATUS_CHANGED` \| `ASSIGNED` \| `PRIORITY_CHANGED` \| `SLA_WARNING` \| `SLA_BREACHED` \| `ESCALATED` \| `MERGED` |
| beforeValue | json? | previous state |
| afterValue | json? | new state |
| metadata | json | |
| actorId | string? | FK `User` |
| createdAt | | |

Indices: `ticketId`, `createdAt`.

### `SLAPolicy`
Defines response and resolution deadlines per priority level.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| priority | enum | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` |
| responseDeadlineMinutes | int | business hours |
| resolutionDeadlineMinutes | int | business hours |
| isActive | boolean | |
| createdAt, updatedAt | | |

### `SLABreach`
Tracks when tickets breach SLA thresholds.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| ticketId | string | FK |
| severity | enum | `WARNING` (75%) \| `BREACHED` (100%) |
| breachType | enum | `RESPONSE` \| `RESOLUTION` |
| deadlineAt | datetime | the deadline that was breached |
| breachedAt | datetime | when breach occurred |
| notifiedAt | datetime? | when alert was sent |
| createdAt | | |

Indices: `ticketId`, `severity`, `breachedAt`.

---

## 6. Blog / Innovation Lab

### `BlogCategory`
| Field | Type | Notes |
|---|---|---|
| id, slug, name, description, order, isPublished, seo* | | |

### `BlogPost`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| slug | string | unique |
| title | string | |
| excerpt | string? | |
| body | mdx | |
| categoryId | string | FK |
| tags | json | array of strings |
| coverImageId | string? | FK `MediaAsset` |
| authorId | string | FK `User` |
| readingTimeMinutes | int | computed at publish |
| status | enum | `DRAFT` \| `SCHEDULED` \| `PUBLISHED` \| `ARCHIVED` |
| publishedAt | datetime? | |
| isLab | boolean | true = innovation-lab style |
| seoTitle, seoDescription | string? | |
| ogImageId | string? | FK |
| createdAt, updatedAt, deletedAt | | |

Indices: `slug` unique, `categoryId`, `status`, `publishedAt`. FTS on title + body.

### `Newsletter`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| email | citext | unique |
| status | enum | `PENDING` \| `CONFIRMED` \| `UNSUBSCRIBED` |
| confirmedAt, unsubscribedAt | datetime? | |
| source | string? | "footer", "blog-cta", etc. |
| createdAt, updatedAt | | |

---

## 7. Media

### `MediaAsset`
The single registry for every uploaded file. Public assets carry a `cdnUrl`; private assets serve via signed URL. **No schema change was needed for the D-068 local storage provider (2026-08-18)**: `storageKey` stores the provider-neutral key (`tmp/uploads/...` / `public/products/...`), and `cdnUrl` is set when the active provider produces a CDN/absolute URL (R2 custom domain) or left null for the local provider's site-relative `/media/...` delivery. The active provider is resolved at runtime via `server/storage/get-media-storage-provider.ts` (D-068); local runbook `docs/LOCAL_MEDIA_STORAGE.md`, R2 runbook `docs/CLOUDFLARE_R2.md`.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| kind | enum | `IMAGE` \| `VIDEO` \| `DOCUMENT` \| `FIRMWARE` \| `MODEL_3D` \| `OTHER` |
| mime | string | |
| sizeBytes | bigint | |
| width, height | int? | for image/video |
| durationSeconds | int? | for video |
| storageKey | string | bucket key |
| cdnUrl | string? | when public |
| variants | json | `[{ width, height, url, format }]` |
| altText | string? | for images, default for `<img alt>` |
| caption | string? | |
| sourcePromptId | string? | FK `AiPrompt` (for Seedream/Seedance assets) |
| folder | string? | logical folder |
| tags | json | |
| isPublic | boolean | |
| uploadedBy | string? | FK `User` |
| createdAt, updatedAt, deletedAt | | |

Indices: `kind`, `folder`, `uploadedBy`.

### `AiPrompt`
Reproducibility for Seedream / Seedance assets.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| tool | enum | `SEEDREAM` \| `SEEDANCE` \| `OTHER` |
| prompt | string | |
| negativePrompt | string? | |
| seed | string? | |
| params | json | model, sampler, steps, etc. |
| outputMediaId | string? | FK `MediaAsset` |
| createdBy | string? | |
| createdAt | | |

---

## 8. Operations

### `AuditLog`
Append-only.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| actorId | string? | FK `User` |
| actorRole | enum? | snapshot |
| action | string | e.g., `product.update`, `order.refund` |
| entityType | string | |
| entityId | string | |
| before | json? | |
| after | json? | |
| ipHash | string? | |
| userAgent | string? | |
| createdAt | | |

Indices: `entityType + entityId`, `actorId`, `createdAt`.

### `SystemSetting`
Single-row store for site-level configuration that is admin-editable (currencies enabled, taxes by zone, payment provider toggles, email templates customizations, default SEO).

| Field | Type | Notes |
|---|---|---|
| key | string | PK |
| value | json | |
| updatedAt, updatedBy | | |

---

## 9. IoT (Phase 5)

### `Device`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| serialNumber | string | unique |
| name | string | customer-assigned display name |
| productId | string | FK `Product` |
| customerId | string | FK `User` |
| firmwareVersion | string | current installed version |
| status | enum | `ONLINE` \| `OFFLINE` \| `SLEEPING` \| `UPDATING` \| `ERROR` |
| lastSeenAt | datetime? | from device telemetry |
| batteryLevel | int? | percentage |
| signalStrength | int? | dBm or percentage |
| apiKey | string | hashed, for device auth |
| createdAt, updatedAt | | audit fields |

Indices: `serialNumber` unique, `customerId`, `status`, `lastSeenAt`.

### `DeviceClaim`
Used during device registration/claiming flow.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| deviceId | string | FK `Device` |
| serialNumber | string | for lookup |
| claimToken | string | one-time use, time-boxed |
| claimedByUserId | string? | FK `User` — set after claim |
| claimedAt | datetime? | |
| expiresAt | datetime | |
| createdAt | | |

### `DeviceCommand`
Commands sent from customer/admin to device.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| deviceId | string | FK `Device` |
| command | string | e.g., `START`, `STOP`, `REBOOT` |
| params | json? | command-specific parameters |
| status | enum | `PENDING` \| `SENT` \| `ACKNOWLEDGED` \| `COMPLETED` \| `FAILED` \| `TIMEOUT` |
| sentByUserId | string? | FK `User` |
| sentAt | datetime? | |
| acknowledgedAt | datetime? | |
| completedAt | datetime? | |
| result | json? | device response |
| createdAt, updatedAt | | |

Indices: `deviceId`, `status`, `createdAt`.

### `DeviceEvent`
All events from devices: telemetry, status changes, command acknowledgements.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| deviceId | string | FK `Device` |
| kind | enum | `TELEMETRY` \| `STATUS_CHANGE` \| `COMMAND_ACK` \| `FIRMWARE_CHECK` \| `ERROR` |
| payload | json | event-specific data |
| recordedAt | datetime | device timestamp |
| ingestedAt | datetime | server timestamp |
| createdAt | | |

Indices: `deviceId`, `kind`, `recordedAt`. Partitioned monthly for large volumes.

### `DeviceSensorReading`
Time-series sensor data.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| deviceId | string | FK `Device` |
| sensorType | string | e.g., `temperature`, `humidity`, `battery`, `signal` |
| value | json | numeric or complex reading |
| unit | string | e.g., `°C`, `%`, `dBm` |
| recordedAt | datetime | device timestamp |
| ingestedAt | datetime | server timestamp |
| createdAt | | |

Indices: `deviceId`, `sensorType`, `recordedAt`. Partitioned monthly.

Retention: raw data 30 days, aggregated data 1 year.

### `FirmwareVersion`
| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| version | string | semver |
| productId | string | FK `Product` |
| model | string | device model identifier |
| channel | enum | `ALPHA` \| `BETA` \| `STABLE` |
| changelog | mdx | release notes |
| fileUrl | string | signed URL to firmware binary |
| fileSize | bigint | bytes |
| checksum | string | SHA-256 |
| minHardwareRevision | string? | minimum HW required |
| status | enum | `DRAFT` \| `AVAILABLE` \| `DEPRECATED` |
| publishedAt | datetime? | |
| createdAt, updatedAt | | |

Indices: `productId`, `model`, `channel`, `status`.

### `FirmwareDeployment`
Tracks OTA update deployments.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| firmwareVersionId | string | FK `FirmwareVersion` |
| targetDeviceIds | json | array of device IDs or `"all"` |
| rolloutPercentage | int | 0-100 |
| status | enum | `PENDING` \| `IN_PROGRESS` \| `COMPLETED` \| `ROLLED_BACK` |
| startedAt | datetime? | |
| completedAt | datetime? | |
| successCount | int | default 0 |
| failureCount | int | default 0 |
| createdByUserId | string? | FK `User` |
| createdAt, updatedAt | | |

### `DeviceLog`
Device log entries viewable by customer and admin.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| deviceId | string | FK `Device` |
| level | enum | `INFO` \| `WARN` \| `ERROR` |
| source | string | e.g., `firmware`, `network`, `sensor` |
| message | string | |
| metadata | json? | additional context |
| recordedAt | datetime | device timestamp |
| createdAt | | |

Indices: `deviceId`, `level`, `recordedAt`.

Retention: 30 days.

---

## 10. B2B Accounts (Phase 5)

### `Account`
Multi-user B2B account.
Multi-user B2B account.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| name | string | company name |
| taxId | string? | BIN/VAT for invoices |
| segment | enum | `B2B` \| `EDU` |
| defaultPriceTierId | string? | FK `PriceTier` |
| seatLimit | int | max members |
| createdAt, updatedAt | | |

### `AccountMember`
Join table for users belonging to an account.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| accountId | string | FK `Account` |
| userId | string | FK `User` |
| role | enum | `OWNER` \| `MEMBER` \| `VIEWER` |
| joinedAt | datetime | |
| createdAt, updatedAt | | |

PK: composite (`accountId`, `userId`).

Indices: `accountId`, `userId`.

### `PriceTier`
Account-level pricing.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| name | string | display name |
| slug | string | unique |
| description | string? | |
| isActive | boolean | |
| createdAt, updatedAt | | |

### `PriceTierPrice`
Per-product/variant tier-specific pricing.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| priceTierId | string | FK `PriceTier` |
| productId | string | FK `Product` |
| variantId | string? | FK `ProductVariant` |
| priceMinor | bigint | tier-specific price |
| currency | enum | `BDT` \| `USD` |
| createdAt, updatedAt | | |

PK: composite (`priceTierId`, `productId`, `variantId`).

---

## 11. Conventions checklist

- All FK relationships have `onDelete` policy explicitly set (`Restrict` for finance-related, `Cascade` for child rows under parent — e.g., `OrderItem` under `Order` only when the order is hard-deleted, never via soft delete).
- Soft delete entities default-scope to `deletedAt: null` everywhere.
- Money displayed via the formatter in `lib/format/currency.ts` (BDT primary, USD secondary). DB stores canonical only.
- `slug` columns are immutable after publish; renaming generates a 301 redirect entry (table TBD with the SEO subsystem).
- All `json` columns have a TS type alongside the schema (`type ProductSpecs = ...`) and are validated with Zod on write.

---

## 12. Planned Models — Phase 2 Extended

> **NOTE (updated 2026-07-10)**: I-019 is now **RESOLVED** by corrective C.2. `searchVector` columns were dropped from Product and BlogPost. `prisma migrate dev` is unblocked. New planned models below may now be implemented. I-025 (permission wildcard) should still be resolved (C.1) before CONTENT_ADMIN role is used in production.

### `RdProject` (planned — Step 2.10.1)

| Field | Type | Notes |
|---|---|---|
| id | string | PK cuid |
| slug | string | unique |
| title | string | |
| description | string? | MDX |
| status | enum | `CONCEPT \| ACTIVE \| PAUSED \| COMPLETED \| ARCHIVED` |
| isPublic | bool | controls visibility on /research |
| seoTitle, seoDescription | string? | |
| createdAt, updatedAt, deletedAt | | standard |
| createdBy, updatedBy | string? | FK User |

Relations: `updates: RdUpdate[]`, `milestones: RdMilestone[]`

### `RdUpdate` (planned — Step 2.10.1)

| Field | Type | Notes |
|---|---|---|
| id, projectId, title, body (MDX), publishedAt, isPublic, createdAt, updatedAt | | |

### `HomepageConfig` (planned — Step 2.11.1)

Singleton (only one active config at a time).

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| version | int | incremented on publish |
| sections | json | ordered array of `HomepageSection` typed objects |
| publishedAt | datetime? | null = draft |
| publishedBy | string? | FK User |
| createdAt, updatedAt | | |

`HomepageSection` (JSON type):
```ts
type HomepageSection = {
  id: string;         // stable section key
  sectionType: HomepageSectionType; // enum
  enabled: boolean;
  order: number;
  eyebrow?: string;
  heading?: string;
  description?: string;
  imageId?: string;   // FK MediaAsset
  ctaLabel?: string;
  ctaHref?: string;
  featuredEntityIds?: string[];
  bgStyle?: 'base' | 'raised' | 'accent';
};
```

`HomepageSectionType` enum (planning):
`ANNOUNCEMENT | HERO | HOT_PROMOTIONS | BUSINESS_AREAS | RND_FEATURE | WORKSPACE | COMPONENTS | PRODUCTS | IOT_SOLUTIONS | ENGINEERING | BLOG | FINAL_CTA`

### `HomepageRevision` (planned — Step 2.11.1)

Append-only history for rollback.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| sections | json | snapshot of HomepageConfig.sections at publish |
| publishedAt | datetime | |
| publishedBy | string? | FK User |

### `Promotion` (planned — Step 2.12.1)

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| name | string | internal label |
| title | string | public headline |
| description | string? | |
| badge | string? | e.g., "Save 20%" |
| imageId | string? | FK MediaAsset |
| ctaLabel | string? | |
| ctaHref | string? | |
| promotionType | enum | `ANNOUNCEMENT \| DISCOUNT \| OFFER \| CAMPAIGN \| EVENT` |
| discountType | enum | `NONE \| PERCENTAGE \| FIXED_AMOUNT \| FREE_DURATION \| CUSTOM_OFFER` |
| discountValue | decimal? | |
| couponCode | string? | |
| startAt | datetime? | null = always-on while ACTIVE |
| endAt | datetime? | null = no expiry |
| priority | int | higher = shown first within placement |
| status | enum | `DRAFT \| SCHEDULED \| ACTIVE \| PAUSED \| EXPIRED \| ARCHIVED` |
| isStackable | bool | can combine with other promotions |
| terms | string? | |
| createdAt, updatedAt, deletedAt | | |
| createdBy, updatedBy | string? | FK User |

Relations: `placements: PromotionPlacement[]`, `coupons: Coupon[]`

### `PromotionPlacement` (planned — Step 2.12.1)

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| promotionId | string | FK Promotion |
| placement | enum | see placement enum below |
| targetEntityId | string? | optional product/plan ID for entity-specific placements |
| limit | int? | max simultaneous promotions in this placement |
| createdAt | | |

`PromotionPlacementSlot` enum (planning):
`GLOBAL_ANNOUNCEMENT | HOMEPAGE_HERO | HOMEPAGE_HOT_PROMOTIONS | HOMEPAGE_INLINE | WORKSPACE_HERO | WORKSPACE_BOOKING | COMPONENTS_HERO | COMPONENT_LIST | PRODUCT_DETAIL | RND_PAGE | BLOG_PAGE | CONTACT_PAGE | QUOTE_PAGE | CHECKOUT`

### `Coupon` (planned — Step 2.12.1)

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| promotionId | string | FK Promotion |
| code | string | unique, case-insensitive |
| usageLimit | int? | null = unlimited |
| redemptionCount | int | default 0 |
| expiresAt | datetime? | |
| isActive | bool | |
| createdAt, updatedAt | | |

### `WorkspacePlan` (planned — Step 2.13.1)

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| slug | string | unique |
| name | string | |
| description | string? | MDX |
| durationType | enum | `HOURLY \| DAILY \| WEEKLY \| MONTHLY` |
| durationMinutes | int | e.g., 60, 480, 2880, 10080 |
| priceMinor | BigInt | price in currency's smallest unit |
| currency | enum | `BDT \| USD` |
| capacity | int | max participants |
| includedFacilities | json | string array of facility keys |
| supportLevel | string? | e.g., "Basic engineering support" |
| terms | string? | MDX |
| isActive | bool | |
| isPublic | bool | |
| seoTitle, seoDescription | string? | |
| createdAt, updatedAt, deletedAt | | |

### `Booking` (planned — Step 2.13.2)

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| reference | string | unique, human-readable e.g. "WS-2026-001234" |
| customerId | string | FK User |
| planId | string | FK WorkspacePlan |
| date | date | booking date |
| startTime | time | |
| endTime | time | |
| participants | int | |
| priceMinor | BigInt | base price at booking time |
| discountMinor | BigInt | default 0 |
| promotionId | string? | FK Promotion |
| couponId | string? | FK Coupon |
| finalPriceMinor | BigInt | price - discount |
| paymentStatus | enum | `NOT_REQUIRED \| PENDING \| PAID \| PARTIALLY_PAID \| REFUNDED \| FAILED` |
| bookingStatus | enum | `PENDING \| CONFIRMED \| CHECKED_IN \| COMPLETED \| CANCELLED \| NO_SHOW` |
| customerNote | string? | |
| internalNote | string? | super_admin/workspace_manager only |
| termsAccepted | bool | |
| createdAt, updatedAt | | |
| createdBy | string? | FK User (if staff-created) |

Note: `paymentStatus` and `bookingStatus` are **separate enums** intentionally. A booking can be `CONFIRMED` with `payment: PENDING` (pay-later) or `CONFIRMED` with `payment: PAID` (online payment). This separation prevents conflation of operational state with financial state.

### `AvailabilityRule` (planned — Step 2.13.2)

Defines recurring availability windows.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| dayOfWeek | int[] | 0=Sunday, 6=Saturday |
| openTime | time | |
| closeTime | time | |
| slotDurationMinutes | int | e.g., 60 |
| capacity | int | |
| isActive | bool | |
| effectiveFrom, effectiveUntil | date? | |
| createdAt, updatedAt | | |

### `BlackoutPeriod` (planned — Step 2.13.2)

Blocks out specific dates/periods.

| Field | Type | Notes |
|---|---|---|
| id | string | PK |
| startDate, endDate | date | |
| reason | string? | internal label |
| isPublic | bool | show on public calendar as "Unavailable" |
| createdAt, updatedAt | | |

### `StockMovement` (implemented — Step 2.4.6A3, D-075; moved earlier from the older 2.14.5 timing)

The authoritative, **append-only** inventory ledger. Every successful stock mutation in `adjust-inventory-executor.ts` writes exactly one `StockMovement` inside the same `FOR UPDATE` transaction as the `Product`/`ProductVariant` stock update and the `AuditLog` row (D-077). Distinct from `AuditLog`: `StockMovement` answers "what happened to the quantity" (ledger), `AuditLog` answers "who did what, when" (security/activity trail).

| Field | Type | Notes |
|---|---|---|
| id | string | PK (`cuid()`) |
| productId | string | Scalar FK reference to `Product` (no cascade; archiving a product keeps history) |
| variantId | string? | Scalar FK reference to `ProductVariant` |
| deltaQty | int | positive=add, negative=remove |
| quantityBefore | int | stock prior to the adjustment |
| quantityAfter | int | stock after the adjustment |
| reason | string | bounded; human/source label (manual adjustment requires `reason` + optional `note`) |
| note | string? | bounded free-text |
| referenceType | string? | reserved for future links (sale/return/import) |
| referenceId | string? | reserved for future links |
| createdAt | DateTime | `timestamp(3)` (UTC via `utcPoolConfig`, D-070) |
| createdBy | string | `ctx.userId` from the executing admin; server-derived, never client-supplied |

Indices: `productId`, `variantId`, `createdAt`, `createdBy`.

**Immutability (by design, D-075):** a PostgreSQL trigger (`stock_movement_immutable` → `deny_stock_movement_write`) raised in `prisma/migrations/20260829000100_add_stock_movement/migration.sql` rejects any `UPDATE` or `DELETE` on `StockMovement`. There is intentionally no delete/edit path.

### Planning notes

1. **Component vs Product**: No separate `Component` model. Components are `Product` records in component-specific categories. `productType` field or category-based filtering distinguishes them. No schema change needed for this distinction — it is a UX concern.

2. **Search vectors**: `searchVector` columns on `Product` and `BlogPost` have been **removed** (corrective C.2, 2026-07-10; final verification 2026-07-25). I-019 is RESOLVED. The existing `gin_trgm_ops` GIN indexes on `name`/`tagline`/`description`/`title`/`body` serve ILIKE search. New searchable entities (RdProject, WorkspacePlan, etc.) should use `name(ops: raw("gin_trgm_ops"))` indices instead of generated `tsvector` — proven safe and Prisma-compatible. Future `prisma migrate dev` directly confirmed to work (disposable probe test passed 2026-07-25).

3. **Money**: All monetary values follow the existing `priceMinor: BigInt` + `currency: Currency` pattern. Never floats. Never strings in the DB.

4. **Soft delete**: All user-facing entities get `deletedAt: DateTime?`. Admin lists always filter `deletedAt: null`. Audit logs are **never soft-deleted** (append-only).

5. **JSON columns**: All JSON columns must have a corresponding TypeScript type and Zod validator at the server action boundary.

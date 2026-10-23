import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

interface ProductSeed {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  sku: string;
  salesType: 'B2C' | 'B2B' | 'HYBRID';
  tagline: string;
  description: string;
  statusNote: string;
  chips: string[];
  highlights: string[];
  specs: JsonValue;
  downloads: string[];
  mediaId: string;
  mediaPath: string;
}

interface BlogSeed {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  categoryId: string;
  tags: string[];
  readingTimeMinutes: number;
  mediaId: string;
  mediaPath: string;
  bodyPath: string;
}

const root = process.cwd();

const roles = [
  { id: 'role_super_admin', key: 'SUPER_ADMIN', name: 'Super admin', permissions: ['*'] },
  {
    id: 'role_content_admin',
    key: 'CONTENT_ADMIN',
    name: 'Content admin',
    permissions: [
      'blog.read',
      'blog.write',
      'categories.read',
      'categories.write',
      'media.read',
      'media.write',
      'products.read',
      'products.write',
      'inventory.read',
      'support_article.read',
      'support_article.write',
    ],
  },
  {
    id: 'role_support_admin',
    key: 'SUPPORT_ADMIN',
    name: 'Support admin',
    permissions: [
      'customer.read',
      'media.read',
      'media.write',
      'order.read',
      'products.read',
      'support_article.read',
      'support_article.write',
      'ticket.read',
      'ticket.reply',
    ],
  },
  {
    id: 'role_sales_admin',
    key: 'SALES_ADMIN',
    name: 'Sales admin',
    permissions: [
      'analytics.sales.read',
      'customer.read',
      'customer.write',
      'order.read',
      'order.refund',
      'order.transition',
      'products.read',
      'inventory.read',
      'quote.read',
      'quote.respond',
      'ticket.read',
    ],
  },
] as const;

const categories = [
  [
    'cat_robotics',
    'robotics',
    'Industrial robotics',
    '[Compact autonomous robots designed for structured commercial environments.]',
  ],
  [
    'cat_smart_city',
    'smart-city',
    'Smart-city IoT',
    '[Sensor networks and gateway nodes for outdoor infrastructure.]',
  ],
  [
    'cat_smart_building',
    'smart-building',
    'Smart-building IoT',
    '[Safety, energy, and control devices for connected buildings.]',
  ],
  [
    'cat_prosumer',
    'prosumer',
    'Prosumer',
    '[Capable consumer devices for technically-aware households.]',
  ],
  [
    'cat_education',
    'education',
    'Education',
    '[Robotics kits and lab hardware for institutions and workshops.]',
  ],
  [
    'cat_custom',
    'custom',
    'Custom',
    '[Purpose-built hardware for specific deployment requirements.]',
  ],
] as const;

const products: ProductSeed[] = [
  {
    id: 'prod_floor_robot',
    slug: 'autonomous-floor-cleaning-robot',
    name: '[Autonomous floor-cleaning robot]',
    categoryId: 'cat_robotics',
    sku: '[SKU-PENDING-AFC]',
    salesType: 'HYBRID',
    tagline: '[Clean mapped spaces with unattended autonomy.]',
    description:
      '[A compact autonomous platform for scheduled floor cleaning in homes, offices, and education labs.]',
    statusNote: '[CONCEPT - IN R&D]',
    chips: ['[LiDAR]', '[SLAM]', '[Docking]'],
    highlights: [
      '[Maps real rooms and avoids common floor obstacles.]',
      '[Schedules repeat cleaning runs from the companion app.]',
    ],
    specs: [{ title: 'Mechanical', rows: [{ label: 'Dimensions', value: '[L x W x H pending]' }] }],
    downloads: ['[Datasheet (PDF, size pending)]', '[Quick-start guide (PDF, size pending)]'],
    mediaId: 'media_product_floor_robot',
    mediaPath:
      'media/products/autonomous-floor-cleaning-robot/products-autonomous-floor-cleaning-robot-hero-01-4x5.svg',
  },
  {
    id: 'prod_home_safety',
    slug: 'iot-home-safety-device',
    name: '[IoT home safety device]',
    categoryId: 'cat_smart_building',
    sku: '[SKU-PENDING-HSD]',
    salesType: 'HYBRID',
    tagline: '[Detect safety events and alert people fast.]',
    description:
      '[A connected safety node for smoke, gas, motion, and local siren alerts with app notification support.]',
    statusNote: '[PILOT]',
    chips: ['[Smoke]', '[Gas]', '[Motion]'],
    highlights: [
      '[Combines multiple safety sensors in one wall-mounted unit.]',
      '[Keeps a local audible alarm path for offline events.]',
    ],
    specs: [{ title: 'Sensors', rows: [{ label: 'Smoke', value: '[SENSOR pending]' }] }],
    downloads: ['[Datasheet (PDF, size pending)]', '[Installation guide (PDF, size pending)]'],
    mediaId: 'media_product_home_safety',
    mediaPath:
      'media/products/iot-home-safety-device/products-iot-home-safety-device-hero-01-4x5.svg',
  },
  {
    id: 'prod_appliance_control',
    slug: 'smart-appliance-control',
    name: '[Smart appliance control]',
    categoryId: 'cat_prosumer',
    sku: '[SKU-PENDING-SAC]',
    salesType: 'B2C',
    tagline: '[Switch and schedule appliances with energy visibility.]',
    description:
      '[A connected controller for appliance switching, scheduling, and energy metering in small spaces.]',
    statusNote: '[EARLY PROTOTYPE]',
    chips: ['[Relay]', '[Energy meter]', '[App]'],
    highlights: [
      '[Controls compatible appliances from a single app interface.]',
      '[Reports energy readings for simple usage visibility.]',
    ],
    specs: [{ title: 'Electrical', rows: [{ label: 'Load rating', value: '[AMPERAGE pending]' }] }],
    downloads: ['[Datasheet (PDF, size pending)]', '[Wiring guide (PDF, size pending)]'],
    mediaId: 'media_product_appliance_control',
    mediaPath:
      'media/products/smart-appliance-control/products-smart-appliance-control-hero-01-4x5.svg',
  },
  {
    id: 'prod_education_kit',
    slug: 'education-robotics-kit',
    name: '[Education robotics kit]',
    categoryId: 'cat_education',
    sku: '[SKU-PENDING-ERK]',
    salesType: 'B2C',
    tagline: '[Teach embedded robotics with real hardware.]',
    description:
      '[A modular robotics kit for classroom labs, workshops, and university-level prototyping.]',
    statusNote: '[PLANNED]',
    chips: ['[Sensors]', '[Motor drivers]', '[Curriculum]'],
    highlights: [
      '[Pairs hardware modules with structured learning exercises.]',
      '[Keeps wiring visible so students understand the signal path.]',
    ],
    specs: [{ title: 'Kit contents', rows: [{ label: 'Controller', value: '[MCU pending]' }] }],
    downloads: ['[Curriculum outline (PDF, size pending)]', '[Lab guide (PDF, size pending)]'],
    mediaId: 'media_product_education_kit',
    mediaPath:
      'media/products/education-robotics-kit/products-education-robotics-kit-hero-01-4x5.svg',
  },
  {
    id: 'prod_iot_gateway',
    slug: 'iot-gateway-node',
    name: '[IoT gateway node]',
    categoryId: 'cat_smart_city',
    sku: '[SKU-PENDING-IGN]',
    salesType: 'B2B',
    tagline: '[Route field sensor data to the right dashboard.]',
    description:
      '[A configurable gateway node for sensor networks, telemetry collection, and edge buffering.]',
    statusNote: '[CUSTOM QUOTE]',
    chips: ['[MQTT]', '[Edge buffer]', '[OTA]'],
    highlights: [
      '[Buffers telemetry during intermittent network windows.]',
      '[Publishes data over standard IoT protocols.]',
    ],
    specs: [
      {
        title: 'Connectivity',
        rows: [{ label: 'WAN', value: '[Ethernet / Wi-Fi / LTE pending]' }],
      },
    ],
    downloads: ['[Deployment brief (PDF, size pending)]', '[Protocol sheet (PDF, size pending)]'],
    mediaId: 'media_product_iot_gateway',
    mediaPath: 'media/products/iot-gateway-node/products-iot-gateway-node-hero-01-4x5.svg',
  },
  {
    id: 'prod_custom_controller',
    slug: 'custom-embedded-controller',
    name: '[Custom embedded controller]',
    categoryId: 'cat_custom',
    sku: '[SKU-PENDING-CEC]',
    salesType: 'B2B',
    tagline: '[Prototype a control board around your duty cycle.]',
    description:
      '[Custom electronics, firmware, and enclosure design for robotics and IoT product development.]',
    statusNote: '[ENGINEERING SERVICE]',
    chips: ['[PCB]', '[Firmware]', '[Enclosure]'],
    highlights: [
      '[Defines board requirements from the mechanical and firmware needs.]',
      '[Builds testable prototypes before production decisions.]',
    ],
    specs: [{ title: 'Engagement', rows: [{ label: 'Discovery', value: '[SCOPE pending]' }] }],
    downloads: [
      '[R&D intake checklist (PDF, size pending)]',
      '[NDA / procurement pack (PDF, size pending)]',
    ],
    mediaId: 'media_product_custom_controller',
    mediaPath:
      'media/products/custom-embedded-controller/products-custom-embedded-controller-hero-01-4x5.svg',
  },
];

const blogCategories = [
  [
    'blog_cat_robotics_rd',
    'robotics-rd',
    'Robotics R&D',
    '[Autonomous robotics build notes and engineering updates.]',
  ],
  [
    'blog_cat_iot_bd',
    'iot-in-bangladesh',
    'IoT in Bangladesh',
    '[Field telemetry, sensing, and connected-device notes for Bangladesh.]',
  ],
  [
    'blog_cat_engineering',
    'engineering-notes',
    'Engineering Notes',
    '[Regional hardware engineering observations and build decisions.]',
  ],
] as const;

const blogs: BlogSeed[] = [
  {
    id: 'blog_autonomous_robots_bd',
    slug: 'building-autonomous-robots-bangladesh',
    title: 'Building autonomous robots in Bangladesh',
    excerpt:
      'How designing autonomous robots for real South Asian environments changes imported engineering assumptions.',
    categoryId: 'blog_cat_robotics_rd',
    tags: ['autonomous-systems', 'product-development', 'south-asia'],
    readingTimeMinutes: 8,
    mediaId: 'media_blog_cover_rd',
    mediaPath: 'media/blog/blog-cover-rd-01-16x9.svg',
    bodyPath: 'content/blog/building-autonomous-robots-bangladesh.mdx',
  },
  {
    id: 'blog_iot_agriculture',
    slug: 'iot-sensor-networks-smart-agriculture',
    title: 'IoT sensor networks for smart agriculture',
    excerpt:
      'Designing field telemetry for smallholder farms with intermittent connectivity and practical alerting.',
    categoryId: 'blog_cat_iot_bd',
    tags: ['iot', 'agriculture', 'lorawan', 'telemetry'],
    readingTimeMinutes: 6,
    mediaId: 'media_blog_cover_iot',
    mediaPath: 'media/blog/blog-cover-iot-bd-01-16x9.svg',
    bodyPath: 'content/blog/iot-sensor-networks-smart-agriculture.mdx',
  },
  {
    id: 'blog_regional_robotics',
    slug: 'regional-robotics-local-engineering',
    title: 'Why regional robotics needs local engineering',
    excerpt:
      'The case for building hardware knowledge inside Bangladesh rather than importing solutions.',
    categoryId: 'blog_cat_engineering',
    tags: ['engineering', 'bangladesh', 'manufacturing', 'ecosystem'],
    readingTimeMinutes: 10,
    mediaId: 'media_blog_cover_tutorial',
    mediaPath: 'media/blog/blog-cover-tutorial-01-16x9.svg',
    bodyPath: 'content/blog/regional-robotics-local-engineering.mdx',
  },
];

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function json(value: JsonValue): string {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function mediaSize(storageKey: string): number {
  const path = join(root, 'public', ...storageKey.split('/'));
  return existsSync(path) ? statSync(path).size : 0;
}

function mdx(path: string): string {
  return readFileSync(join(root, ...path.split('/')), 'utf8');
}

/** File mtime (ms since epoch) — honest, deterministic launch publication date. */
function fileMtimeIso(path: string): string {
  return statSync(join(root, ...path.split('/'))).mtime.toISOString();
}

const statements: string[] = ['BEGIN;'];

// ─── Insert-only policy (D1 production seed safety) ─────────────────────────
// Every content row below uses `ON CONFLICT ... DO NOTHING` — the seed is an
// INITIAL bootstrap only. Once an administrator can edit content (blog posts,
// products, categories, roles, media metadata), a rerun of the seed must never
// overwrite their edits or force re-publication (the previous upsert reset
// BlogPost rows to PUBLISHED and clobbered admin-edited titles/bodies).
// System bookkeeping (SystemSetting seed marker) may still update in place.
// Regression coverage: tests/seed-safety.test.ts.

for (const role of roles) {
  statements.push(
    `INSERT INTO "Role" ("id","key","name","permissions","createdAt","updatedAt") VALUES (${sql(role.id)}, '${role.key}', ${sql(role.name)}, ${json(role.permissions)}, NOW(), NOW()) ON CONFLICT ("key") DO NOTHING;`,
  );
}

statements.push(
  `INSERT INTO "User" ("id","email","name","locale","preferredCurrency","status","createdAt","updatedAt") VALUES ('user_admin_seed', 'admin@ariot.local', '[ARIOT Admin Placeholder]', 'en', 'BDT', 'ACTIVE', NOW(), NOW()) ON CONFLICT ("email") DO NOTHING;`,
);
statements.push(
  `INSERT INTO "UserRole" ("userId","roleId") VALUES ('user_admin_seed','role_super_admin') ON CONFLICT ("userId","roleId") DO NOTHING;`,
);

for (const [id, slug, name, description] of categories) {
  statements.push(
    `INSERT INTO "Category" ("id","slug","name","description","isPublished","createdAt","updatedAt") VALUES (${sql(id)}, ${sql(slug)}, ${sql(name)}, ${sql(description)}, true, NOW(), NOW()) ON CONFLICT ("slug") DO NOTHING;`,
  );
}

for (const [id, slug, name, description] of blogCategories) {
  statements.push(
    `INSERT INTO "BlogCategory" ("id","slug","name","description","isPublished","createdAt","updatedAt") VALUES (${sql(id)}, ${sql(slug)}, ${sql(name)}, ${sql(description)}, true, NOW(), NOW()) ON CONFLICT ("slug") DO NOTHING;`,
  );
}

for (const item of [...products, ...blogs]) {
  statements.push(
    `INSERT INTO "MediaAsset" ("id","kind","mime","sizeBytes","storageKey","cdnUrl","variants","altText","folder","tags","isPublic","createdAt","updatedAt") VALUES (${sql(item.mediaId)}, 'IMAGE', 'image/svg+xml', ${mediaSize(item.mediaPath)}, ${sql(item.mediaPath)}, ${sql(`/${item.mediaPath}`)}, '[]'::jsonb, ${sql('name' in item ? item.name : item.title)}, ${sql(item.mediaPath.split('/').slice(0, 2).join('/'))}, '[]'::jsonb, true, NOW(), NOW()) ON CONFLICT ("id") DO NOTHING;`,
  );
}

for (const product of products) {
  statements.push(
    `INSERT INTO "Product" ("id","slug","name","tagline","description","categoryId","sku","salesType","currency","stock","stockPolicy","status","heroImageId","specs","highlights","inTheBox","createdAt","updatedAt") VALUES (${sql(product.id)}, ${sql(product.slug)}, ${sql(product.name)}, ${sql(product.tagline)}, ${sql(product.description)}, ${sql(product.categoryId)}, ${sql(product.sku)}, '${product.salesType}', 'BDT', 0, 'MADE_TO_ORDER', 'DRAFT', ${sql(product.mediaId)}, ${json({ status: product.statusNote, chips: product.chips, groups: product.specs })}, ${json(product.highlights)}, ${json(product.downloads)}, NOW(), NOW()) ON CONFLICT ("slug") DO NOTHING;`,
  );
}

for (const blog of blogs) {
  // L3 launch: seed posts PUBLISHED with the source MDX file's mtime as the
  // honest publication date. No fabricated "now()" — we use the real file
  // timestamp so seeded content reflects when the article was actually
  // authored. Admin can unpublish/edit from /admin/blog after seed. Insert-only
  // (DO NOTHING): a rerun never touches an existing post, so admin edits and
  // unpublish decisions survive.
  const publishedAt = fileMtimeIso(blog.bodyPath);
  statements.push(
    `INSERT INTO "BlogPost" ("id","slug","title","excerpt","body","categoryId","tags","coverImageId","authorId","readingTimeMinutes","status","isLab","publishedAt","createdAt","updatedAt") VALUES (${sql(blog.id)}, ${sql(blog.slug)}, ${sql(blog.title)}, ${sql(blog.excerpt)}, ${sql(mdx(blog.bodyPath))}, ${sql(blog.categoryId)}, ${json(blog.tags)}, ${sql(blog.mediaId)}, 'user_admin_seed', ${blog.readingTimeMinutes}, 'PUBLISHED', false, ${sql(publishedAt)}::timestamptz, ${sql(publishedAt)}::timestamptz, NOW()) ON CONFLICT ("slug") DO NOTHING;`,
  );
}

statements.push(
  `INSERT INTO "SystemSetting" ("key","value","updatedAt","updatedBy") VALUES ('site.seed.version', ${json({ step: '2.1.5', seededAt: '2026-07-07' })}, NOW(), 'user_admin_seed') ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW(), "updatedBy" = EXCLUDED."updatedBy";`,
);
statements.push('COMMIT;');

const result =
  process.platform === 'win32'
    ? spawnSync('npx prisma db execute --stdin', {
        cwd: root,
        input: statements.join('\n'),
        shell: true,
        stdio: ['pipe', 'inherit', 'inherit'],
      })
    : spawnSync('npx', ['prisma', 'db', 'execute', '--stdin'], {
        cwd: root,
        input: statements.join('\n'),
        shell: false,
        stdio: ['pipe', 'inherit', 'inherit'],
      });

if (result.error) {
  console.error(result.error.message);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('Seed data written.');

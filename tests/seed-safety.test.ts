/**
 * tests/seed-safety.test.ts — production seed safety (D1).
 *
 * Verifies the insert-only seed policy in prisma/seed.ts: rerunning the seed
 * against a database whose content an administrator has since edited must NOT
 * overwrite the admin's edits or force re-publication. (The previous upsert
 * logic reset BlogPost rows to PUBLISHED and clobbered edited titles/bodies —
 * a production blocker for any seed rerun.)
 *
 * The disposable database (ariot_seed_safety_test) is created from scratch
 * with `prisma migrate deploy` — this also verifies that the committed
 * migrations apply cleanly to an empty database, exactly as production does.
 * The primary database is never touched.
 *
 * Run:
 *   node --import ./tests/helpers/register-hooks.mjs --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/seed-safety.test.ts
 */

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const { Client } = pg;

// ── Environment / disposable DB setup ────────────────────────────────────────

function loadEnvVar(key: string): string {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) throw new Error('.env not found');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*(.*)`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(`${key} not found in .env`);
}

const baseUrl = loadEnvVar('DATABASE_URL');
const TEST_DB_NAME = 'ariot_seed_safety_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);

// Safety: the disposable DB must be local and distinct from the primary.
assert.ok(
  testUrl.includes('localhost') || testUrl.includes('127.0.0.1'),
  'Test URL must be local',
);
assert.ok(testUrl.includes(TEST_DB_NAME), 'Test URL must target the disposable database');
assert.notEqual(testUrl, baseUrl, 'Test URL must differ from the primary DATABASE_URL');

const adminUrl = baseUrl.replace(/\/ariot(\?|$)/, '/postgres$1');

async function withAdminClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function createDisposableDb() {
  await withAdminClient(async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  });
}

async function dropDisposableDb() {
  await withAdminClient(async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  });
}

function run(cmd: string, args: string[], env: Record<string, string>): void {
  const result = spawnSync(cmd, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function migrateDeploy() {
  // Production-parity migration path: `prisma migrate deploy` on an empty DB.
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: testUrl });
}

function runSeed() {
  run(
    'node',
    [
      '--experimental-strip-types',
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      'prisma/seed.ts',
    ],
    { DATABASE_URL: testUrl },
  );
}

// ── Assertions against the disposable DB ─────────────────────────────────────

async function queryOne<T extends pg.QueryResultRow>(sqlText: string, params: unknown[] = []): Promise<T> {
  const client = new Client({ connectionString: testUrl });
  await client.connect();
  try {
    const { rows } = await client.query<T>(sqlText, params);
    assert.ok(rows.length === 1, `expected exactly one row for: ${sqlText}`);
    return rows[0] as T;
  } finally {
    await client.end();
  }
}

async function exec(sqlText: string, params: unknown[] = []): Promise<void> {
  const client = new Client({ connectionString: testUrl });
  await client.connect();
  try {
    await client.query(sqlText, params);
  } finally {
    await client.end();
  }
}

interface PostRow {
  title: string;
  excerpt: string;
  body: string;
  status: string;
  publishedAt: Date | null;
  readingTimeMinutes: number;
}

describe('seed safety (insert-only rerun)', () => {
  before(async () => {
    await createDisposableDb();
    migrateDeploy();
    runSeed();
  });

  after(async () => {
    await dropDisposableDb();
  });

  it('initial seed creates the expected published blog posts', async () => {
    const row = await queryOne<PostRow>(
      `SELECT title, excerpt, body, status, "publishedAt", "readingTimeMinutes"
       FROM "BlogPost" WHERE slug = 'building-autonomous-robots-bangladesh'`,
    );
    assert.equal(row.status, 'PUBLISHED');
    assert.ok(row.publishedAt instanceof Date, 'seed sets an honest publishedAt');
    assert.notEqual(row.title, '', 'seeded title present');
  });

  it('a rerun does not overwrite administrator-edited content', async () => {
    // Simulate admin edits after the first seed: rewrite + unpublish a post,
    // rename a category, change role permissions, edit media alt text.
    await exec(
      `UPDATE "BlogPost" SET title = 'Admin edited title', excerpt = 'Admin edited excerpt',
         body = 'Admin edited body', status = 'DRAFT', "publishedAt" = NULL,
         "readingTimeMinutes" = 42, "updatedAt" = NOW()
       WHERE slug = 'building-autonomous-robots-bangladesh'`,
    );
    await exec(`UPDATE "Category" SET name = 'Admin renamed category', "updatedAt" = NOW() WHERE slug = 'robotics'`);
    await exec(`UPDATE "Role" SET permissions = '["blog.read"]'::jsonb, "updatedAt" = NOW() WHERE key = 'CONTENT_ADMIN'`);
    await exec(`UPDATE "MediaAsset" SET "altText" = 'Admin alt text', "updatedAt" = NOW() WHERE id = 'media_blog_cover_rd'`);

    runSeed();

    const post = await queryOne<PostRow>(
      `SELECT title, excerpt, body, status, "publishedAt", "readingTimeMinutes"
       FROM "BlogPost" WHERE slug = 'building-autonomous-robots-bangladesh'`,
    );
    assert.equal(post.title, 'Admin edited title');
    assert.equal(post.excerpt, 'Admin edited excerpt');
    assert.equal(post.body, 'Admin edited body');
    assert.equal(post.status, 'DRAFT', 'rerun must not force re-publication');
    assert.equal(post.publishedAt, null, 'rerun must not reset publishedAt');
    assert.equal(post.readingTimeMinutes, 42);

    const category = await queryOne<{ name: string }>(
      `SELECT name FROM "Category" WHERE slug = 'robotics'`,
    );
    assert.equal(category.name, 'Admin renamed category');

    const role = await queryOne<{ permissions: unknown }>(
      `SELECT permissions FROM "Role" WHERE key = 'CONTENT_ADMIN'`,
    );
    assert.deepEqual(role.permissions, ['blog.read']);

    const media = await queryOne<{ altText: string }>(
      `SELECT "altText" FROM "MediaAsset" WHERE id = 'media_blog_cover_rd'`,
    );
    assert.equal(media.altText, 'Admin alt text');
  });

  it('rerunning the seed is idempotent — no duplicate rows', async () => {
    runSeed();

    const counts = await queryOne<{
      posts: string;
      categories: string;
      products: string;
      media: string;
      roles: string;
      users: string;
    }>(
      `SELECT (SELECT count(*) FROM "BlogPost")::text AS posts,
              (SELECT count(*) FROM "Category")::text AS categories,
              (SELECT count(*) FROM "Product")::text AS products,
              (SELECT count(*) FROM "MediaAsset")::text AS media,
              (SELECT count(*) FROM "Role")::text AS roles,
              (SELECT count(*) FROM "User")::text AS users`,
    );
    assert.equal(Number(counts.posts), 3);
    assert.equal(Number(counts.categories), 6);
    assert.equal(Number(counts.products), 6);
    assert.equal(Number(counts.media), 9);
    assert.equal(Number(counts.roles), 4);
    assert.equal(Number(counts.users), 1);
  });

  it('seeded schema matches the committed migrations on an empty database', async () => {
    // `prisma migrate deploy` (in before()) must leave the DB fully migrated:
    // every recorded migration finished, none rolled back.
    const failed = await queryOne<{ cnt: string }>(
      `SELECT count(*)::text AS cnt FROM _prisma_migrations
       WHERE "rolled_back_at" IS NOT NULL OR "finished_at" IS NULL`,
    );
    assert.equal(failed.cnt, '0', 'no failed or rolled-back migrations');
    const stock = await queryOne<{ cnt: string }>(
      `SELECT count(*)::text AS cnt FROM information_schema.tables WHERE table_name = 'StockMovement'`,
    );
    assert.equal(stock.cnt, '1', 'StockMovement table exists after migrate deploy');
  });
});

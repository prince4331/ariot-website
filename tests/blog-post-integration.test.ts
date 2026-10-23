/**
 * tests/blog-post-integration.test.ts — L3 Minimal Marketing CMS verification.
 *
 * Integration tests against a disposable PostgreSQL database (ariot_blog_test)
 * exercising the REAL production blog services:
 *   - server/admin/blog/create-blog-post.ts  (executeCreateBlogPost)
 *   - server/admin/blog/update-blog-post.ts  (executeUpdateBlogPost)
 *   - server/admin/blog/authorized-blog-mutation.ts (denied-write wrapper)
 *   - server/public/blog.ts                  (public visibility contract)
 *
 * The disposable database is created with `prisma db push` against the real
 * schema — no hand-maintained SQL mirror. The primary database is never
 * touched: the test URL must be local and point at ariot_blog_test only.
 *
 * Run:
 *   node --import ./tests/helpers/register-hooks.mjs --test tests/blog-post-integration.test.ts
 */

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client.ts';
import { utcPoolConfig } from '../server/db-timezone.ts';
import { executeCreateBlogPost } from '../server/admin/blog/create-blog-post.ts';
import { executeUpdateBlogPost } from '../server/admin/blog/update-blog-post.ts';
import { createAuthorizedBlogWriter } from '../server/admin/blog/authorized-blog-mutation.ts';
import {
  listPublishedPosts,
  getPublishedPostBySlug,
} from '../server/public/blog.ts';

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
const TEST_DB_NAME = 'ariot_blog_test';
const testUrl = baseUrl.replace(/\/ariot(\?|$)/, `/${TEST_DB_NAME}$1`);

// Safety: the disposable DB must be local and distinct from the primary.
assert.ok(
  testUrl.includes('localhost') || testUrl.includes('127.0.0.1'),
  'Test URL must be local',
);
assert.ok(testUrl.includes(TEST_DB_NAME), 'Test URL must target the disposable database');
assert.notEqual(testUrl, baseUrl, 'Test URL must differ from the primary DATABASE_URL');

async function createDisposableDb() {
  const admin = new Client({ connectionString: baseUrl.replace(/\/ariot(\?|$)/, '/postgres$1') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  await admin.end();
}

async function dropDisposableDb() {
  const admin = new Client({ connectionString: baseUrl.replace(/\/ariot(\?|$)/, '/postgres$1') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await admin.end();
}

function pushSchema() {
  // `prisma db push` against the disposable DB — prisma.config.ts reads
  // DATABASE_URL from the process env, which overrides the .env file.
  // NOTE: `--skip-generate` was removed in Prisma 7; `db push` no longer
  // auto-generates, so it is simply omitted.
  const result = spawnSync(
    'npx',
    ['prisma', 'db', 'push', '--accept-data-loss'],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: testUrl },
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  if (result.status !== 0) {
    throw new Error(`prisma db push failed: ${result.stdout}\n${result.stderr}`);
  }
}

// ── Test fixtures / shared clients ───────────────────────────────────────────

const ACTOR = { userId: 'test_author_1', roles: ['CONTENT_ADMIN'] };

let db: InstanceType<typeof PrismaClient>;

async function enableExtensions() {
  // Required Postgres extensions (mirrors the init migration prelude) —
  // must run BEFORE `prisma db push`, which creates citext columns.
  const ext = new Client({ connectionString: testUrl });
  await ext.connect();
  await ext.query('CREATE EXTENSION IF NOT EXISTS citext');
  await ext.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await ext.end();
}

before(async () => {
  await createDisposableDb();
  await enableExtensions();
  pushSchema();

  db = new PrismaClient({ adapter: new PrismaPg(utcPoolConfig(testUrl)) });

  await db.user.create({
    data: { id: ACTOR.userId, email: 'author@test.local', name: 'Test Author' },
  });
  await db.blogCategory.createMany({
    data: [
      { id: 'cat_robotics', slug: 'robotics-rd', name: 'Robotics R&D', isPublished: true },
      { id: 'cat_iot', slug: 'iot-in-bangladesh', name: 'IoT in Bangladesh', isPublished: true },
      { id: 'cat_eng', slug: 'engineering-notes', name: 'Engineering Notes', isPublished: true },
    ],
  });
});

after(async () => {
  if (db) await db.$disconnect();
  await dropDisposableDb();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function draftPayload(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      title: 'CleanBot navigation field log',
      slug: 'cleanbot-navigation-field-log',
      excerpt: 'LiDAR SLAM tuning notes from a real Dhaka office floor.',
      body: '## Field notes\n\nFirst navigation run on a real floor.',
      categoryId: 'cat_robotics',
      tags: ['slam', 'field-test'],
      status: 'DRAFT',
      ...overrides,
    },
  };
}

async function auditCount(action?: string): Promise<number> {
  return action
    ? db.auditLog.count({ where: { action } })
    : db.auditLog.count();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BlogPost L3 integration (disposable DB)', () => {
  it('1. creates a draft with a server-derived author and no published date', async () => {
    const result = await executeCreateBlogPost(draftPayload(), ACTOR, db);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.slug, 'cleanbot-navigation-field-log');

    const post = await db.blogPost.findUnique({ where: { slug: result.slug } });
    assert.ok(post);
    assert.equal(post.status, 'DRAFT');
    assert.equal(post.publishedAt, null);
    assert.equal(post.authorId, ACTOR.userId);
    assert.equal(await auditCount('BLOG_POST_CREATED'), 1);
  });

  it('2. keeps drafts out of the public queries', async () => {
    const list = await listPublishedPosts({ limit: 50 }, db);
    assert.equal(list.length, 0);
    const detail = await getPublishedPostBySlug('cleanbot-navigation-field-log', db);
    assert.equal(detail, null);
  });

  it('3. publishes the draft — honest server date + PUBLISHED audit', async () => {
    const current = await db.blogPost.findUniqueOrThrow({
      where: { slug: 'cleanbot-navigation-field-log' },
    });
    const result = await executeUpdateBlogPost(
      {
        postId: current.id,
        expectedUpdatedAt: current.updatedAt.toISOString(),
        data: { ...draftPayload().data, status: 'PUBLISHED' },
      },
      ACTOR,
      db,
    );
    assert.equal(result.ok, true);

    const post = await db.blogPost.findUniqueOrThrow({
      where: { slug: 'cleanbot-navigation-field-log' },
    });
    assert.equal(post.status, 'PUBLISHED');
    assert.ok(post.publishedAt, 'publish must stamp publishedAt');
    assert.equal(await auditCount('BLOG_POST_PUBLISHED'), 1);
  });

  it('4. published post appears in public list and detail queries', async () => {
    const list = await listPublishedPosts({ limit: 50 }, db);
    assert.equal(list.length, 1);
    assert.equal(list[0].slug, 'cleanbot-navigation-field-log');
    assert.equal(list[0].categoryName, 'Robotics R&D');

    const detail = await getPublishedPostBySlug('cleanbot-navigation-field-log', db);
    assert.ok(detail);
    assert.equal(detail.authorName, 'Test Author');
    assert.ok(detail.body.includes('First navigation run'));
  });

  it('5. rejects a duplicate slug (no write, no audit)', async () => {
    const before = await auditCount();
    const result = await executeCreateBlogPost(
      draftPayload({ slug: 'cleanbot-navigation-field-log' }),
      ACTOR,
      db,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.type, 'duplicate');
    assert.equal(await auditCount(), before);
  });

  it('6. rejects unknown fields (mass assignment) with no audit', async () => {
    const before = await auditCount();
    const payload = draftPayload({ slug: 'mass-assignment-attempt' });
    (payload.data as Record<string, unknown>).userId = 'attacker';
    (payload.data as Record<string, unknown>).role = 'SUPER_ADMIN';
    const result = await executeCreateBlogPost(payload, ACTOR, db);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.type, 'validation');
    assert.equal(await auditCount(), before);
  });

  it('7. applies an update and audits a safe summary (body never dumped)', async () => {
    const current = await db.blogPost.findUniqueOrThrow({
      where: { slug: 'cleanbot-navigation-field-log' },
    });
    const result = await executeUpdateBlogPost(
      {
        postId: current.id,
        expectedUpdatedAt: current.updatedAt.toISOString(),
        data: {
          ...draftPayload().data,
          status: 'PUBLISHED',
          title: 'CleanBot navigation field log — week 2',
          body: '## Field notes\n\nSecond navigation run with tuned inflation radius.',
        },
      },
      ACTOR,
      db,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.changedFields.includes('title'));
    assert.ok(result.changedFields.includes('body'));

    const audit = await db.auditLog.findFirstOrThrow({
      where: { action: 'BLOG_POST_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });
    const afterJson = JSON.stringify(audit.after);
    assert.ok(!afterJson.includes('Second navigation run'), 'audit must not contain the body');
  });

  it('8. treats an identical resubmission as a no-op (no write, no audit)', async () => {
    const before = await auditCount();
    const current = await db.blogPost.findUniqueOrThrow({
      where: { slug: 'cleanbot-navigation-field-log' },
    });
    const result = await executeUpdateBlogPost(
      {
        postId: current.id,
        expectedUpdatedAt: current.updatedAt.toISOString(),
        data: {
          ...draftPayload().data,
          status: 'PUBLISHED',
          title: 'CleanBot navigation field log — week 2',
          body: '## Field notes\n\nSecond navigation run with tuned inflation radius.',
        },
      },
      ACTOR,
      db,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.noChanges, true);
    assert.equal(await auditCount(), before);
  });

  it('9. denies an unauthorized write via the wrapper (no write, no audit)', async () => {
    const before = await auditCount();
    const postsBefore = await db.blogPost.count();

    const deniedWriter = createAuthorizedBlogWriter(
      async () => {
        throw new Error('simulated authorization denial');
      },
      (rawInput, actor) => executeCreateBlogPost(rawInput, actor, db),
    );
    const result = await deniedWriter(draftPayload({ slug: 'should-never-exist' }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.type, 'forbidden');

    assert.equal(await db.blogPost.count(), postsBefore);
    assert.equal(await auditCount(), before);
  });

  it('10. read-only actor is denied mutation by the wrapper', async () => {
    // Production resolves the actor via requirePermission('blog.write'),
    // which throws for a read-only operator; the identical wrapper contract
    // is exercised here with a throwing authorize().
    const deniedWriter = createAuthorizedBlogWriter(
      async () => {
        throw new Error('blog.write missing');
      },
      (rawInput, actor) => executeUpdateBlogPost(rawInput, actor, db),
    );
    const current = await db.blogPost.findUniqueOrThrow({
      where: { slug: 'cleanbot-navigation-field-log' },
    });
    const result = await deniedWriter({
      postId: current.id,
      expectedUpdatedAt: current.updatedAt.toISOString(),
      data: { ...draftPayload().data, status: 'PUBLISHED', title: 'Hijacked title' },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.type, 'forbidden');

    const unchanged = await db.blogPost.findUniqueOrThrow({
      where: { slug: 'cleanbot-navigation-field-log' },
    });
    assert.equal(unchanged.title, 'CleanBot navigation field log — week 2');
  });

  it('11. unpublish removes the post from the public query', async () => {
    const current = await db.blogPost.findUniqueOrThrow({
      where: { slug: 'cleanbot-navigation-field-log' },
    });
    const saveAgain = await executeUpdateBlogPost(
      {
        postId: current.id,
        expectedUpdatedAt: current.updatedAt.toISOString(),
        data: {
          ...draftPayload().data,
          status: 'PUBLISHED',
          title: 'CleanBot navigation field log — week 2',
          body: '## Field notes\n\nSecond navigation run with tuned inflation radius.',
        },
      },
      ACTOR,
      db,
    );
    assert.equal(saveAgain.ok, true);
    if (!saveAgain.ok) return;

    const unpublish = await executeUpdateBlogPost(
      {
        postId: current.id,
        expectedUpdatedAt: saveAgain.updatedAt,
        data: { ...draftPayload().data, status: 'DRAFT' },
      },
      ACTOR,
      db,
    );
    assert.equal(unpublish.ok, true);

    const list = await listPublishedPosts({ limit: 50 }, db);
    assert.equal(list.length, 0);
    const detail = await getPublishedPostBySlug('cleanbot-navigation-field-log', db);
    assert.equal(detail, null);

    const post = await db.blogPost.findUniqueOrThrow({
      where: { slug: 'cleanbot-navigation-field-log' },
    });
    assert.equal(post.publishedAt, null, 'unpublish must clear the public date');
    assert.equal(await auditCount('BLOG_POST_UNPUBLISHED'), 1);
  });

  it('12. archived posts are excluded from the public query', async () => {
    await db.blogPost.update({
      where: { slug: 'cleanbot-navigation-field-log' },
      data: { status: 'ARCHIVED' },
    });
    const list = await listPublishedPosts({ limit: 50 }, db);
    assert.equal(list.length, 0);
    await db.blogPost.update({
      where: { slug: 'cleanbot-navigation-field-log' },
      data: { status: 'DRAFT' },
    });
  });

  it('13. filters published posts by Robotics and IoT categories', async () => {
    // Publish the robotics post again.
    const robotics = await db.blogPost.findUniqueOrThrow({
      where: { slug: 'cleanbot-navigation-field-log' },
    });
    await db.blogPost.update({
      where: { id: robotics.id },
      data: { status: 'PUBLISHED', publishedAt: new Date('2026-08-01T09:00:00Z') },
    });

    // Create + publish an IoT post.
    const iot = await executeCreateBlogPost(
      draftPayload({
        slug: 'soil-moisture-node-field-notes',
        title: 'Soil moisture node field notes',
        categoryId: 'cat_iot',
        status: 'PUBLISHED',
      }),
      ACTOR,
      db,
    );
    assert.equal(iot.ok, true);

    const roboticsPosts = await listPublishedPosts({ categorySlug: 'robotics-rd' }, db);
    assert.equal(roboticsPosts.length, 1);
    assert.equal(roboticsPosts[0].slug, 'cleanbot-navigation-field-log');

    const iotPosts = await listPublishedPosts({ categorySlug: 'iot-in-bangladesh' }, db);
    assert.equal(iotPosts.length, 1);
    assert.equal(iotPosts[0].slug, 'soil-moisture-node-field-notes');

    const all = await listPublishedPosts({ limit: 50 }, db);
    assert.equal(all.length, 2);
  });

  it('14. orders the homepage latest list newest-published first', async () => {
    await db.blogPost.update({
      where: { slug: 'cleanbot-navigation-field-log' },
      data: { publishedAt: new Date('2026-08-20T09:00:00Z') },
    });
    await db.blogPost.update({
      where: { slug: 'soil-moisture-node-field-notes' },
      data: { publishedAt: new Date('2026-08-25T09:00:00Z') },
    });

    const third = await executeCreateBlogPost(
      draftPayload({
        slug: 'workbench-torque-notes',
        title: 'Workbench torque notes',
        categoryId: 'cat_eng',
        status: 'PUBLISHED',
      }),
      ACTOR,
      db,
    );
    assert.equal(third.ok, true);
    await db.blogPost.update({
      where: { slug: 'workbench-torque-notes' },
      data: { publishedAt: new Date('2026-08-30T09:00:00Z') },
    });

    const latest = await listPublishedPosts({ limit: 3 }, db);
    assert.deepEqual(
      latest.map((p) => p.slug),
      [
        'workbench-torque-notes',
        'soil-moisture-node-field-notes',
        'cleanbot-navigation-field-log',
      ],
    );
  });
});

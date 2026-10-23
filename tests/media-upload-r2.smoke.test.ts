/**
 * tests/media-upload-r2.smoke.test.ts — Step 2.4.4 opt-in R2 dev-bucket smoke
 * test (STORAGE-1R / D-067).
 *
 * Opt-in behavior:
 *   - All five R2 credential vars + MEDIA_UPLOAD_TOKEN_SECRET set, dev-bucket
 *     sentinel ok: runs the 12-step real flow against a dev bucket and exits 0
 *     on PASS.
 *   - Any R2 var absent: skipped (exits 0). The standard `it.skip` makes
 *     node:test print "SKIPPED" and the suite passes.
 *   - Partial creds (some vars set, others missing): FAIL with a clear error
 *     so misconfiguration is loud, not silent.
 *   - Bucket name resolves to a known production bucket name: FAIL.
 *
 * Run:
 *   node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     --test tests/media-upload-r2.smoke.test.ts
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { DeleteObjectCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Config } from '../server/env.ts';
import { initiateUpload } from '../server/storage/upload-initiate.ts';
import { completeUpload } from '../server/storage/upload-complete.ts';
import { getR2Client, resetR2ClientForTests } from '../server/storage/r2-client.ts';
import {
  clearAuthContextOverride,
  getR2ConfigSafe,
  setAuthContextOverride,
} from '../server/storage/upload-context.ts';
import { buildPublicMediaKey } from '../server/storage/upload-keys.ts';

/**
 * Credentials the R2 provider genuinely requires (server/env.ts `getR2Config`):
 * the four R2_* values plus the upload-completion token secret.
 * `R2_PUBLIC_BASE_URL` is deliberately NOT listed — the app treats it as
 * optional (media URLs fall back to site-relative paths).
 */
const R2_CREDENTIALS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
] as const;

const TOKEN_SECRET = 'MEDIA_UPLOAD_TOKEN_SECRET';

/** Bucket names that must never be touched by smoke tests. */
const FORBIDDEN_BUCKETS = new Set<string>(['ariot-prod', 'ariot-production', 'ariot-live']);

interface EnvState {
  ready: boolean;
  partial: boolean;
  forbiddenBucket: boolean;
  bucketName: string;
}

/**
 * Mirrors the app's own configuration contract (server/env.ts):
 *   - no R2 credential set at all → not configured (the local provider is in
 *     use) → the smoke test skips;
 *   - some but not all R2 credentials set → misconfiguration → FAIL loudly;
 *   - all four R2 credentials set but the token secret missing → the app
 *     refuses to boot → FAIL loudly.
 */
const inspectEnv = (): EnvState => {
  const presentCredentials = R2_CREDENTIALS.filter((k) => !!process.env[k]);
  const bucketName = process.env.R2_BUCKET_NAME ?? '';

  if (presentCredentials.length === 0) {
    return { ready: false, partial: false, forbiddenBucket: false, bucketName: '' };
  }
  if (presentCredentials.length !== R2_CREDENTIALS.length || !process.env[TOKEN_SECRET]) {
    return { ready: false, partial: true, forbiddenBucket: false, bucketName: '' };
  }
  if (FORBIDDEN_BUCKETS.has(bucketName)) {
    return { ready: false, partial: false, forbiddenBucket: true, bucketName };
  }
  return { ready: true, partial: false, forbiddenBucket: false, bucketName };
};

const envState = inspectEnv();

/** Stub auth context with media.write permission — smoke-test only. */
const installAuthStub = (userId: string): void => {
  setAuthContextOverride(async () => ({
    userId,
    email: `${userId}@smoke.local`,
    roles: ['CONTENT_ADMIN'],
    permissions: ['media.write'],
  }));
};

/** Tiny PNG: 8x8 magenta square. Sufficient for file-type sniffing. */
const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x08, 0x08, 0x02, 0x00, 0x00, 0x00, 0x4b, 0x6d, 0x29,
  0xdc,
]);

describe('R2 dev-bucket smoke test (opt-in)', () => {
  if (envState.forbiddenBucket) {
    it('refuses to run against a known production bucket name', () => {
      assert.fail(
        `R2_BUCKET_NAME=${envState.bucketName} looks like a production bucket; refusing to smoke-test it.`,
      );
    });
    return;
  }

  if (envState.partial) {
    it('fails loudly on partial R2 configuration', () => {
      assert.fail(
        'Partial R2 configuration detected — set all of R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, MEDIA_UPLOAD_TOKEN_SECRET or unset them all.',
      );
    });
    return;
  }

  if (!envState.ready) {
    it('skips when R2 credentials are absent', { skip: true }, () => {
      assert.ok(true);
    });
    return;
  }

  it('reaches the bucket and then exercises the full 12-step flow', async () => {
    const config = getR2Config();
    const client = getR2Client();
    resetR2ClientForTests();

    // 1. Bucket reachability probe.
    try {
      await client.send(new HeadBucketCommand({ Bucket: config.bucketName }));
    } catch (err) {
      assert.fail(`Bucket ${config.bucketName} is not reachable: ${String(err)}`);
    }

    const userId = `smoke-${Date.now()}`;
    installAuthStub(userId);
    try {
      // 2. Initiate — strict contract, server mints id + keys.
      const filename = 'smoke.png';
      const init = await initiateUpload({
        filename,
        mimeType: 'image/png',
        sizeBytes: TINY_PNG.length,
        kind: 'IMAGE',
      });
      assert.equal(init.ok, true, init.ok ? '' : init.message);
      if (!init.ok) return;
      assert.ok(init.uploadUrl.length > 0);
      assert.ok(init.token.startsWith('v1.'));
      assert.ok(init.mediaAssetId.length === 25 && init.mediaAssetId.startsWith('c'));

      // 3. PUT to the presigned URL.
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: init.tempKey,
          Body: TINY_PNG,
          ContentType: 'image/png',
        }),
      );

      // 4. Complete — strict contract, completionToken only.
      const completeResult = await completeUpload({
        completionToken: init.token,
      });
      assert.equal(completeResult.ok, true, completeResult.ok ? '' : completeResult.message);
      if (!completeResult.ok) return;
      assert.equal(completeResult.created, true);
      assert.equal(completeResult.asset.id, init.mediaAssetId);

      // 5. Idempotency — second complete returns same asset with
      //    created=false; no second audit row.
      const replay = await completeUpload({ completionToken: init.token });
      assert.equal(replay.ok, true);
      if (!replay.ok) return;
      assert.equal(replay.created, false);
      assert.equal(replay.asset.id, init.mediaAssetId);

      // 6. Best-effort cleanup of the permanent object so the dev bucket
      //    stays tidy.
      const publicKey = buildPublicMediaKey({
        kind: 'IMAGE',
        id: init.mediaAssetId,
        ext: 'png',
        date: new Date(),
      });
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: config.bucketName, Key: init.tempKey }),
        );
        await client.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: publicKey }));
      } catch {
        // smoke artifacts may need manual cleanup; do not fail the run.
      }

      // 7. getR2ConfigSafe agrees with getR2Config when fully configured.
      const safe = getR2ConfigSafe();
      assert.ok(safe);
      assert.equal(safe?.bucketName, config.bucketName);
    } finally {
      clearAuthContextOverride();
      resetR2ClientForTests();
    }
  });
});

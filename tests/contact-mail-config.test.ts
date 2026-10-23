/**
 * tests/contact-mail-config.test.ts — D2 production contact email (I-031).
 *
 * Before D2 the contact/quote sender and recipient were hardcoded
 * placeholders on an unverified domain, so delivery could not work in
 * production. Routing is now env-driven (`MAIL_FROM` / `MAIL_TO`) via
 * `server/mail/routing.ts`, and the placeholder address never reaches the
 * public site (bracketed values are filtered out of JSON-LD).
 *
 * Covered (D2 Task 7):
 *   8. Contact mail configuration validation — env-driven sender/recipient,
 *      dev fallbacks preserved, production fails closed when unset.
 *   9. No fake success when email delivery fails — a missing production
 *      routing config throws instead of returning a success result.
 *  10. Public placeholder never published — JSON-LD filters bracketed values.
 *
 * No real email is ever sent (no Resend API key, no network, no DB).
 *
 * Run:
 *   node --import ./tests/helpers/register-hooks.mjs --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/contact-mail-config.test.ts
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');

/**
 * Run `script` in an isolated child with the given env overrides applied on
 * top of the test process env. Used so each NODE_ENV/mail posture is a clean
 * module graph (`server/env.ts` validates once at import). Returns parsed JSON.
 */
function runChild(script: string, overrides: Record<string, string | undefined>): unknown {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  const stdout = execFileSync(
    process.execPath,
    [
      '--import',
      './tests/helpers/register-hooks.mjs',
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      '--input-type=module',
      '--eval',
      script,
    ],
    { cwd: ROOT, env, encoding: 'utf8', timeout: 30_000 },
  );

  const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '';
  return JSON.parse(line) as unknown;
}

describe('contact mail routing configuration (D2 / I-031)', () => {
  it('falls back to placeholder routing in development when unset', async () => {
    const { resolveMailFrom, resolveContactInbox } = await import('../server/mail/routing.ts');

    // Dev/test: placeholders keep local flows working (client.ts also stubs
    // the actual send when RESEND_API_KEY is absent).
    assert.match(resolveMailFrom(), /@ariot\.example/);
    assert.match(resolveContactInbox(), /ariot\.example/);
  });

  // NOTE: `resolveMailFrom` / `resolveContactInbox` read the frozen `env`
  // binding from `server/env.ts`, which is validated once per process. So the
  // "configured" and "production + set" postures are asserted in isolated
  // subprocesses (below), not in-process — mutating `process.env` after import
  // is invisible to the frozen binding.

  it('fails closed in production when MAIL_FROM / MAIL_TO are unset', () => {
    const script = `
      const { resolveMailFrom, resolveContactInbox, MailRoutingError } =
        await import('./server/mail/routing.ts');
      const out = { from: null, to: null };
      try { resolveMailFrom(); } catch (e) {
        out.from = { name: e?.name, code: e?.code, isRouting: e instanceof MailRoutingError };
      }
      try { resolveContactInbox(); } catch (e) {
        out.to = { name: e?.name, code: e?.code, isRouting: e instanceof MailRoutingError };
      }
      process.stdout.write(JSON.stringify(out));
    `;

    const result = runChild(script, {
      NODE_ENV: 'production',
      MAIL_FROM: undefined,
      MAIL_TO: undefined,
    }) as {
      from: { name: string; code: string; isRouting: boolean } | null;
      to: { name: string; code: string; isRouting: boolean } | null;
    };

    assert.ok(result.from, 'resolveMailFrom must throw in production when unset');
    assert.equal(result.from.name, 'MailRoutingError');
    assert.equal(result.from.code, 'MAIL_ROUTING_NOT_CONFIGURED');
    assert.equal(result.from.isRouting, true);

    assert.ok(result.to, 'resolveContactInbox must throw in production when unset');
    assert.equal(result.to.name, 'MailRoutingError');
    assert.equal(result.to.code, 'MAIL_ROUTING_NOT_CONFIGURED');
    assert.equal(result.to.isRouting, true);
  });

  it('never leaks a value in the production error message', () => {
    const script = `
      process.env.MAIL_TO = 'secret-inbox-that-must-not-leak@example.test';
      const { MailRoutingError } = await import('./server/mail/routing.ts');
      // Reconstruct the exact error the resolver throws when unset.
      const e = new MailRoutingError('MAIL_TO');
      process.stdout.write(JSON.stringify({ message: e.message }));
    `;

    const result = runChild(script, { NODE_ENV: 'production' }) as { message: string };
    assert.equal(result.message, 'MAIL_TO is not configured for production email delivery.');
    assert.ok(!/secret-inbox/.test(result.message), 'error must never echo a configured value');
    assert.ok(!/@/.test(result.message), 'error must not contain any email address');
  });

  it('returns configured routing in production when MAIL_FROM / MAIL_TO are set', () => {
    const script = `
      const { resolveMailFrom, resolveContactInbox } = await import('./server/mail/routing.ts');
      process.stdout.write(JSON.stringify({
        from: resolveMailFrom(),
        to: resolveContactInbox(),
      }));
    `;

    const result = runChild(script, {
      NODE_ENV: 'production',
      MAIL_FROM: 'no-reply@mail-routing-test.example',
      MAIL_TO: 'inbox@mail-routing-test.example',
    }) as { from: string; to: string };

    assert.equal(result.from, 'no-reply@mail-routing-test.example');
    assert.equal(result.to, 'inbox@mail-routing-test.example');
  });
});

describe('placeholder addresses are never published (D2)', () => {
  const siteSource = readFileSync(join(ROOT, 'lib/seo/site.ts'), 'utf8');
  const orgSource = readFileSync(join(ROOT, 'components/seo/organization.tsx'), 'utf8');

  it('the public contact identity stays bracketed in siteConfig', () => {
    // Bracketed => treated as a placeholder everywhere it is consumed.
    assert.match(siteSource, /email:\s*'\[hello@ariot\.example\]'/);
  });

  it('JSON-LD filters bracketed placeholders out of public structured data', () => {
    assert.match(orgSource, /startsWith\('\['\)/);
  });

  it('no mailto: link exposes a contact address on the public site', () => {
    // Static guard across app/ + components/: a mailto: anywhere would
    // publish an address (placeholder or real) without owner approval.
    // grep exits 1 when there is no match (= the passing condition), so a
    // non-zero exit is treated as "no hits" rather than a tooling failure.
    let hits = '';
    try {
      hits = execFileSync(
        'grep',
        ['-rn', 'mailto:', 'app', 'components', '--include=*.tsx', '--include=*.ts'],
        { cwd: ROOT, encoding: 'utf8' },
      ).trim();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status !== 1) throw error; // real tooling failure, not "no match"
    }
    assert.equal(hits, '', `no mailto: should exist in public UI, found:\n${hits}`);
  });
});

/**
 * tests/helpers/register-hooks.mjs — Node native TS loader hooks for tests.
 *
 * Node 24 runs .ts files natively (type stripping) as ESM, but does NOT
 * understand the tsconfig `@/*` path alias or extensionless relative imports
 * (`./product-variant-schema`). This hooks module teaches the resolver both,
 * so the REAL production server modules (server/admin/products/*) can be
 * imported by node:test without tsx, CJS interop, or a duplicate SQL mirror.
 *
 * Register with:
 *   node --import ./tests/helpers/register-hooks.mjs --test tests/...
 */

import { registerHooks } from 'node:module';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = process.cwd();

// Load `.env` (mirrors Next.js behavior) so server modules that read
// `process.env` (server/env.ts, server/db.ts) work under plain `node --test`.
function loadDotEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnv();

function tryResolveFile(absBase) {
  if (existsSync(absBase) && statSync(absBase).isFile()) return absBase;
  for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
    if (existsSync(absBase + ext) && statSync(absBase + ext).isFile()) {
      return absBase + ext;
    }
  }
  for (const idx of ['index.ts', 'index.tsx', 'index.js']) {
    const cand = join(absBase, idx);
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // tsconfig `@/*` path alias → workspace-relative file.
    if (specifier.startsWith('@/')) {
      const target = tryResolveFile(join(ROOT, specifier.slice(2)));
      if (target) {
        return { url: pathToFileURL(target).href, shortCircuit: true };
      }
    }

    // `next/*` subpath exports — Next 16's package.json `exports` map omits
    // `./headers` (and friends), so Node's default resolver can't find the
    // real file. Resolve to node_modules/next/<sub>.js.
    if (specifier.startsWith('next/')) {
      const sub = specifier.slice('next/'.length);
      const file = tryResolveFile(join(ROOT, 'node_modules/next', sub));
      if (file) {
        return { url: pathToFileURL(file).href, shortCircuit: true };
      }
    }

    // Extensionless relative imports → append .ts/.tsx when the exact file
    // does not exist. Pass through when the specifier already resolves.
    const parentURL = context.parentURL;
    if (
      parentURL &&
      parentURL.startsWith('file:') &&
      (specifier.startsWith('./') || specifier.startsWith('../'))
    ) {
      const abs = fileURLToPath(new URL(specifier, parentURL));
      if (!existsSync(abs)) {
        const target = tryResolveFile(abs);
        if (target) {
          return { url: pathToFileURL(target).href, shortCircuit: true };
        }
      }
    }

    return nextResolve(specifier, context);
  },
});

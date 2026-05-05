// scripts/build-mobile.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Builds the Next.js app in mobile (static export) mode and runs `cap sync`.
//
// Why this script exists:
//   Next.js 14 errors out when `output: 'export'` is combined with:
//     1. A `middleware.ts` file ("Middleware cannot be used with output: export")
//     2. Any `/api/*` route that's marked dynamic, calls server-only APIs,
//        or has runtime data fetching ("export const dynamic = 'force-dynamic'
//        cannot be used with output: export")
//
//   We need all of these on the WEB build:
//     - middleware.ts for CORS
//     - /api/* routes for the actual backend (Supabase queries, etc.)
//
//   But none of them belong inside the iOS bundle anyway — the mobile app
//   calls them remotely on https://liveleeapp.com via the fetch shim.
//
//   So during the mobile build we temporarily move both completely OUT of
//   the project tree (not just rename them in place — Next.js scans every
//   folder under app/ regardless of name, so app/api.bak still got picked
//   up). We park them in a sibling `.mobile-build-stash/` folder, build the
//   static export of just the UI pages, sync that into the iOS project,
//   then restore everything. The web build is untouched (this script is
//   only run by `npm run build:mobile`).
//
// Used by the `build:mobile` script in package.json. Run from repo root:
//   npm run build:mobile
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const STASH = resolve(ROOT, '.mobile-build-stash');

// Things to move aside before building, then restore after. Each entry is
// [original repo path, stash subpath]. Stash is a hidden folder OUTSIDE the
// app/ tree so Next.js never scans these files during the mobile build.
const stowList = [
  { from: resolve(ROOT, 'middleware.ts'), to: resolve(STASH, 'middleware.ts') },
  { from: resolve(ROOT, 'app/api'),       to: resolve(STASH, 'app__api')      },
];

const stowed = [];

function stow() {
  // Make sure the stash dir exists and is empty (a previous crashed run may
  // have left old files in it — those would block restoration).
  if (existsSync(STASH)) rmSync(STASH, { recursive: true, force: true });
  mkdirSync(STASH, { recursive: true });

  for (const item of stowList) {
    if (existsSync(item.from)) {
      // Make sure parent of stash target exists (for nested paths).
      mkdirSync(dirname(item.to), { recursive: true });
      renameSync(item.from, item.to);
      stowed.push(item);
      console.log(`▸ stashed ${item.from.replace(ROOT + '/', '')}`);
    }
  }
}

function restore() {
  // Reverse so we restore in the opposite order we stowed.
  for (const item of [...stowed].reverse()) {
    if (existsSync(item.to)) {
      // Make sure parent of original location exists (it should, but defensive).
      mkdirSync(dirname(item.from), { recursive: true });
      renameSync(item.to, item.from);
      console.log(`▸ restored ${item.from.replace(ROOT + '/', '')}`);
    }
  }
  // Clean up the stash folder once empty.
  try { rmSync(STASH, { recursive: true, force: true }); } catch { /* ignore */ }
}

stow();

const env = { ...process.env, NEXT_BUILD_TARGET: 'mobile' };
let exitCode = 0;

try {
  console.log('▸ next build (NEXT_BUILD_TARGET=mobile)');
  const build = spawnSync('npx', ['next', 'build'], {
    stdio: 'inherit',
    env,
    shell: true,
  });
  exitCode = build.status ?? 1;

  if (exitCode === 0) {
    console.log('▸ npx cap sync');
    const sync = spawnSync('npx', ['cap', 'sync'], {
      stdio: 'inherit',
      env,
      shell: true,
    });
    exitCode = sync.status ?? 1;
  }
} finally {
  // Always restore, even on failure or interrupt — never leave the repo in
  // a half-stowed state where Vercel would also fail.
  restore();
}

process.exit(exitCode);

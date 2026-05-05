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
//   So during the mobile build we temporarily move both aside, build the
//   static export of just the UI pages, sync that into the iOS project, then
//   restore everything. The web build is untouched (this script is only run
//   by `npm run build:mobile`).
//
// Used by the `build:mobile` script in package.json. Run from repo root:
//   npm run build:mobile
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

// Things to move aside before building, then restore after. Each entry is
// [original path, backup path]. The api directory is the big one — it
// contains routes like /api/db, /api/exercise-images, /api/debug-ai-env
// that all use server-only features incompatible with static export.
const stowList = [
  [resolve(ROOT, 'middleware.ts'), resolve(ROOT, 'middleware.ts.bak')],
  [resolve(ROOT, 'app/api'),       resolve(ROOT, 'app/api.bak')],
];

const stowed = [];

function stow() {
  for (const [original, backup] of stowList) {
    if (existsSync(original)) {
      renameSync(original, backup);
      stowed.push([original, backup]);
      console.log(`▸ moved ${original.replace(ROOT + '/', '')} → ${backup.replace(ROOT + '/', '')} for static export`);
    }
  }
}

function restore() {
  // Reverse so we restore in the opposite order we stowed.
  for (const [original, backup] of [...stowed].reverse()) {
    if (existsSync(backup)) {
      renameSync(backup, original);
      console.log(`▸ restored ${original.replace(ROOT + '/', '')}`);
    }
  }
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

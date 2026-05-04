// scripts/build-mobile.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Builds the Next.js app in mobile (static export) mode and runs `cap sync`.
//
// Why this script exists:
//   Next.js 14 errors out when `output: 'export'` is combined with a
//   `middleware.ts` file ("Middleware cannot be used with output: export").
//   We need both — middleware on the web build for CORS, static export on
//   the mobile build. So we move middleware.ts aside for the duration of
//   the mobile build, then restore it. A failed build still restores it.
//
// Used by the `build:mobile` script in package.json. Run from repo root:
//   npm run build:mobile
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const middleware = resolve(ROOT, 'middleware.ts');
const middlewareBak = resolve(ROOT, 'middleware.ts.bak');

let renamed = false;
if (existsSync(middleware)) {
  renameSync(middleware, middlewareBak);
  renamed = true;
  console.log('▸ moved middleware.ts → middleware.ts.bak for static export');
}

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
  if (renamed) {
    renameSync(middlewareBak, middleware);
    console.log('▸ restored middleware.ts');
  }
}

process.exit(exitCode);

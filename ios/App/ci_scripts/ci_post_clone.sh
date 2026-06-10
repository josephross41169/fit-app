#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud right AFTER it clones the repo,
# BEFORE it resolves Swift packages / builds.
#
# Produces everything the iOS build needs that ISN'T committed to git:
#   1. node_modules (gitignored) — the Capacitor plugins Package.swift uses.
#   2. The real web build in out/ (only a placeholder index.html is committed)
#      AND the iOS app's public/ folder + config.xml.
#      `npm run build:mobile` does both: it runs `next build` (static export)
#      with middleware/api stashed, then `cap sync` to copy out/ -> iOS public/
#      and write config.xml.
#   3. Swift package resolution: handled automatically by the build; we do NOT
#      commit a Package.resolved (it goes stale after cap sync regenerates the
#      package graph), so this script removes any stale one so Xcode resolves
#      fresh.

set -e

echo "===== ci_post_clone: start ====="

# Xcode Cloud sets this to the cloned repo root (/Volumes/workspace/repository).
cd "$CI_PRIMARY_REPOSITORY_PATH"
echo "Repo root: $(pwd)"

# --- 1. Node + JS dependencies (recreates node_modules/@capacitor/*) ---
if ! command -v node >/dev/null 2>&1; then
  echo "Node not found — installing via Homebrew…"
  brew install node
fi
echo "Node: $(node -v)  npm: $(npm -v)"

npm install

# --- 2. Build the real web app AND sync it into iOS (out/, public/, config.xml) ---
echo "Building mobile web bundle + syncing iOS (npm run build:mobile)…"
npm run build:mobile

# --- 3. Remove any committed/stale Package.resolved so Xcode resolves fresh ---
# (cap sync above can change the package graph; a stale resolved file makes
#  Xcode Cloud fail with "out-of-date resolved file".)
RESOLVED="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
if [ -f "$RESOLVED" ]; then
  echo "Removing stale Package.resolved so Xcode regenerates it…"
  rm -f "$RESOLVED"
fi

echo "===== ci_post_clone: done ====="

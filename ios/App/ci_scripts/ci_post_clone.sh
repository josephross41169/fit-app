#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud right AFTER it clones the repo,
# BEFORE it resolves Swift packages / builds.
#
# Produces everything the iOS build needs that ISN'T committed to git, in the
# right order so the committed Package.resolved stays valid:
#   1. node_modules (gitignored) — the Capacitor plugins Package.swift uses.
#   2. The real web build + iOS public/ + config.xml  (npm run build:mobile).
#   3. AFTER cap sync (which can rewrite CapApp-SPM/Package.swift), explicitly
#      resolve Swift packages so the Package.resolved on disk matches the
#      current graph. Xcode Cloud disables AUTOMATIC resolution, so we resolve
#      EXPLICITLY here and write the result to the exact path Xcode Cloud reads.

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

# --- 3. Explicitly resolve Swift packages so Package.resolved matches the
#        post-sync graph. This is what satisfies Xcode Cloud's requirement for
#        a present, up-to-date resolved file when auto-resolution is disabled. ---
echo "Resolving Swift package dependencies (writing Package.resolved)…"
xcodebuild -resolvePackageDependencies \
  -project "ios/App/App.xcodeproj" \
  -scheme "App"

echo "Resolved file now at:"
ls -l "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved" || true

echo "===== ci_post_clone: done ====="

#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud right AFTER it clones the repo,
# BEFORE it resolves Swift packages / builds.
#
# Produces everything the iOS build needs that ISN'T committed to git, in the
# right order so Swift package resolution succeeds:
#   1. node_modules (gitignored) — the Capacitor plugins Package.swift uses.
#   2. The real web build + iOS public/ + config.xml  (npm run build:mobile).
#   3. AFTER cap sync (which can rewrite CapApp-SPM/Package.swift), explicitly
#      resolve Swift packages so Package.resolved matches the current graph.
#      Xcode Cloud disables AUTOMATIC resolution, so we resolve EXPLICITLY here.

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

# --- 3. Explicitly resolve Swift packages so Package.resolved is present and
#        matches the post-sync graph. Write resolved packages into the build's
#        derived-data SourcePackages dir AND let it update the in-repo
#        Package.resolved. This satisfies Xcode Cloud's "resolved file required
#        when automatic resolution is disabled" check. ---
echo "Resolving Swift package dependencies…"
xcodebuild -resolvePackageDependencies \
  -project "ios/App/App.xcodeproj" \
  -scheme "App" \
  -clonedSourcePackagesDirPath "${CI_DERIVED_DATA_PATH:-$PWD/DerivedData}/SourcePackages" \
  -disableAutomaticPackageResolution=NO \
  || echo "WARN: resolvePackageDependencies returned non-zero; archive step will retry resolution."

echo "Resolved file:"
ls -l "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved" 2>/dev/null || echo "(not at expected path; Xcode will generate during archive)"

echo "===== ci_post_clone: done ====="

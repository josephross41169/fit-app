#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud right AFTER it clones the repo,
# BEFORE it resolves Swift packages / builds.
#
# Fixes the chain of things that aren't committed to git but the iOS build needs:
#   1. node_modules (gitignored) — the Capacitor plugins Package.swift points at.
#      => npm install
#   2. Swift package resolution (Xcode Cloud disables auto-resolution).
#      => xcodebuild -resolvePackageDependencies (Package.resolved is also committed)
#   3. The iOS app's `public/` folder (the web build) and `config.xml`, which
#      Capacitor generates and are NOT in git.
#      => npx cap sync ios  (copies `out/` -> ios/App/App/public and writes config.xml)

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

# --- 2. Capacitor sync: generates ios/App/App/public + config.xml ---
# `out/` (the committed Next.js static export) is the webDir source.
echo "Running Capacitor sync for iOS…"
npx cap sync ios

# --- 3. Resolve Swift packages so Package.resolved is present/valid ---
echo "Resolving Swift package dependencies…"
xcodebuild -resolvePackageDependencies \
  -project "ios/App/App.xcodeproj" \
  -scheme "App" \
  -clonedSourcePackagesDirPath "$CI_DERIVED_DATA_PATH/SourcePackages" \
  || echo "resolvePackageDependencies returned non-zero (continuing; archive step will resolve)"

echo "===== ci_post_clone: done ====="

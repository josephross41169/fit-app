#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud right AFTER it clones the repo,
# BEFORE it resolves Swift packages / builds.
#
# Fixes two things that otherwise break the build:
#   1. node_modules is gitignored, so the Capacitor plugins that Package.swift
#      points at (../../../node_modules/@capacitor/*) don't exist on the build
#      machine. We run `npm install` to recreate them.
#   2. Xcode Cloud disables automatic Swift package resolution and demands a
#      committed Package.resolved. Rather than rely on a hand-written one, we
#      let Xcode resolve packages here so a valid Package.resolved is produced
#      before the Archive step runs.

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

# --- 2. Resolve Swift packages so Package.resolved exists/updates ---
# Point at the project's workspace and let SwiftPM resolve dependencies,
# which writes the required Package.resolved into xcshareddata/swiftpm.
echo "Resolving Swift package dependencies…"
xcodebuild -resolvePackageDependencies \
  -project "ios/App/App.xcodeproj" \
  -scheme "App" \
  -clonedSourcePackagesDirPath "$CI_DERIVED_DATA_PATH/SourcePackages" \
  || echo "resolvePackageDependencies returned non-zero (continuing; archive step will resolve)"

echo "===== ci_post_clone: done ====="

#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud after clone, before its build steps.
#
# Confirmed build sequence on Xcode Cloud:
#   [this script] -> "Resolve package dependencies" (Xcode Cloud's own step) -> build
#
# The "Resolve package dependencies" step runs with automatic resolution
# DISABLED, so if a committed Package.resolved exists that doesn't match the
# current package graph, it errors ("out-of-date resolved file ... not allowed").
#
# Because npm run build:mobile runs cap sync, which regenerates
# CapApp-SPM/Package.swift, ANY pre-committed Package.resolved becomes stale.
#
# Fix: after building, DELETE the committed Package.resolved. With no stale file
# present, Xcode Cloud's resolve step resolves the (post-sync) graph fresh and
# succeeds.

set -e

echo "===== ci_post_clone: start ====="
cd "$CI_PRIMARY_REPOSITORY_PATH"
echo "Repo root: $(pwd)"

# 1. Node + JS deps (recreates node_modules/@capacitor/*)
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node via Homebrew..."
  brew install node
fi
echo "Node: $(node -v)  npm: $(npm -v)"
npm install

# 2. Real web build + Capacitor iOS sync (writes public/, config.xml; rewrites Package.swift)
echo "Building mobile bundle + syncing iOS..."
npm run build:mobile

# 3. Remove any committed/stale Package.resolved so Xcode Cloud's resolve step
#    (which follows this script) resolves the current graph fresh instead of
#    rejecting a stale file.
RESOLVED="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
if [ -f "$RESOLVED" ]; then
  echo "Removing stale committed Package.resolved: $RESOLVED"
  rm -f "$RESOLVED"
else
  echo "No committed Package.resolved present (good)."
fi

echo "===== ci_post_clone: done ====="

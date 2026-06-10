#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud after clone, before its build steps.
#
# Build sequence on Xcode Cloud (confirmed from logs):
#   [this script] -> "Resolve package dependencies" -> "Check project configuration" -> archive
#
# Xcode Cloud runs with automatic package resolution DISABLED. From the logs we
# learned it requires BOTH:
#   - a committed Package.resolved that EXISTS, and
#   - one that MATCHES the current package graph (after cap sync rewrites it).
# A missing file -> "a resolved file is required". A stale file -> "out-of-date".
#
# This script makes the file exist AND match, by resolving packages ourselves
# (which produces a Package.resolved with the correct originHash) and copying it
# into the path Xcode Cloud checks.

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

# 3. Resolve Swift packages, then ensure the resolved file is at the path Xcode
#    Cloud checks. Resolving writes Package.resolved into DerivedData; we copy it
#    into the committed workspace location so the "Check project configuration"
#    step finds a present, matching file.
DERIVED="$PWD/_derived_resolve"
echo "Resolving Swift package dependencies into $DERIVED ..."
xcodebuild -resolvePackageDependencies \
  -project "ios/App/App.xcodeproj" \
  -scheme "App" \
  -derivedDataPath "$DERIVED"

DEST_DIR="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
DEST="$DEST_DIR/Package.resolved"
mkdir -p "$DEST_DIR"

# Find the Package.resolved that the resolver just generated and copy it in.
GENERATED="$(find "$DERIVED" -name 'Package.resolved' -print 2>/dev/null | head -1)"
if [ -n "$GENERATED" ]; then
  echo "Copying resolver output -> $DEST"
  cp "$GENERATED" "$DEST"
  echo "Final Package.resolved:"
  cat "$DEST"
else
  if [ -f "$DEST" ]; then
    echo "Package.resolved already present at workspace path:"
    cat "$DEST"
  else
    echo "ERROR: no Package.resolved produced by resolver." >&2
    exit 1
  fi
fi

echo "===== ci_post_clone: done ====="

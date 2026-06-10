#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud after clone, before its build steps.
#
# The hard problem: npm run build:mobile runs cap sync, which rewrites
# CapApp-SPM/Package.swift, so ANY pre-committed Package.resolved is stale by
# the time Xcode Cloud validates it ("out-of-date resolved file"). The fix:
# AFTER cap sync, regenerate Package.resolved in place so it matches the
# post-sync graph, then Xcode Cloud's check passes.

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

# 3. Regenerate Package.resolved to match the post-cap-sync graph. Disable set -e
#    around the resolve so a non-zero exit cannot abort the run; verify after.
echo "Resolving Swift package dependencies in place..."
set +e
xcodebuild -resolvePackageDependencies \
  -project "ios/App/App.xcodeproj" \
  -scheme "App"
RESOLVE_RC=$?
set -e
echo "resolvePackageDependencies exit code: $RESOLVE_RC"

RESOLVED="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
if [ -f "$RESOLVED" ]; then
  echo "Package.resolved present after resolve:"
  cat "$RESOLVED"
else
  echo "WARN: Package.resolved not found; searching DerivedData..."
  GEN="$(find "$HOME/Library/Developer/Xcode/DerivedData" -name 'Package.resolved' 2>/dev/null | head -1)"
  if [ -n "$GEN" ]; then
    echo "Copying generated resolved file from $GEN"
    mkdir -p "$(dirname "$RESOLVED")"
    cp "$GEN" "$RESOLVED"
    cat "$RESOLVED"
  fi
fi

echo "===== ci_post_clone: done ====="

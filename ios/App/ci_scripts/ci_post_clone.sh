#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud after clone, before its build steps.
#
# Root cause of the persistent "out-of-date resolved file ... not allowed when
# automatic dependency resolution is disabled" failures:
# Xcode Cloud sets two Xcode defaults that prevent Swift Package Manager from
# resolving LOCAL path packages (our 6 @capacitor/* plugins in CapApp-SPM):
#   IDEPackageOnlyUseVersionsFromResolvedFile = YES
#   IDEDisableAutomaticPackageResolution      = YES
# With those set, SPM refuses to resolve the local packages and errors out,
# regardless of what Package.resolved contains.
#
# Fix (proven for Capacitor/local-package projects on Xcode Cloud): delete those
# defaults here so Xcode resolves packages normally during the build.

set -e

echo "===== ci_post_clone: start ====="

# Remove the flags Xcode Cloud injects that break local-package resolution.
# Use '|| true' so the script doesn't fail if a key isn't set.
defaults delete com.apple.dt.Xcode IDEPackageOnlyUseVersionsFromResolvedFile 2>/dev/null || true
defaults delete com.apple.dt.Xcode IDEDisableAutomaticPackageResolution 2>/dev/null || true
echo "Cleared IDEPackageOnlyUseVersionsFromResolvedFile / IDEDisableAutomaticPackageResolution."

cd "$CI_PRIMARY_REPOSITORY_PATH"
echo "Repo root: $(pwd)"

# 1. Node + JS deps (recreates node_modules/@capacitor/*)
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node via Homebrew..."
  brew install node
fi
echo "Node: $(node -v)  npm: $(npm -v)"
npm install

# 2. Real web build + Capacitor iOS sync (writes public/, config.xml)
echo "Building mobile bundle + syncing iOS..."
npm run build:mobile

echo "===== ci_post_clone: done ====="

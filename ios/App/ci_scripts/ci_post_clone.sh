#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud after clone, before its build steps.
#
# Provides the two things not committed to git that the build needs:
#   1. node_modules (gitignored) — the Capacitor plugins Package.swift references.
#   2. The real web build + iOS public/ + config.xml (npm run build:mobile).
#
# Package resolution: a committed Package.resolved (version 2, no originHash) is
# in the repo at project.xcworkspace/xcshareddata/swiftpm/Package.resolved and
# pins the only remote dependency (capacitor-swift-pm 8.3.0). The package graph
# is deterministic (cap sync always regenerates the same Package.swift), so the
# committed resolved file stays valid — no in-script resolve needed.

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

# 2. Real web build + Capacitor iOS sync (writes public/, config.xml)
echo "Building mobile bundle + syncing iOS..."
npm run build:mobile

echo "===== ci_post_clone: done ====="

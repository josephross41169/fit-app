#!/bin/sh

# ci_post_clone.sh — runs on Xcode Cloud right AFTER it clones the repo,
# BEFORE it resolves Swift packages / builds.
#
# Why this exists: the iOS project's Package.swift points at the Capacitor
# plugins inside node_modules/@capacitor/*. That folder is gitignored, so it
# isn't in the repo Xcode Cloud clones — which makes the build fail with
# "package ... cannot be accessed (doesn't exist in file system)".
# Running `npm install` here regenerates node_modules on the build machine
# so those package paths resolve.

set -e

echo "===== ci_post_clone: installing Node + JS dependencies ====="

# Xcode Cloud clones into /Volumes/workspace/repository. This script runs
# from ios/App/ci_scripts, so the repo root is three levels up.
cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "Repo root: $(pwd)"

# Install Node via Homebrew (preinstalled on Xcode Cloud machines).
if ! command -v node >/dev/null 2>&1; then
  echo "Node not found — installing via Homebrew…"
  brew install node
fi

echo "Node: $(node -v)  npm: $(npm -v)"

# Install JS dependencies (this recreates node_modules/@capacitor/*).
npm install

echo "===== ci_post_clone: done ====="

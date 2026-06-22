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
# IMPORTANT: NEXT_PUBLIC_* vars are inlined into the JS bundle at build time.
# If they're missing, lib/supabase.ts falls back to a PLACEHOLDER Supabase URL
# and the shipped app can't sign in (this caused repeated App Store rejections,
# "Error message still appeared when we tried to sign in"). We export the real
# values here so the build is self-sufficient and never ships the placeholder.
# The anon (publishable) key is safe to include — it's a public client key,
# already present in the web bundle, and protected by Supabase Row Level
# Security. The service-role key is NOT here and must never be in the app.
#
# If these are also set as Xcode Cloud environment variables, those take
# precedence automatically (we only set a default when unset).
: "${NEXT_PUBLIC_SUPABASE_URL:=https://biqsvrrnnoyulrrhgitc.supabase.co}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcXN2cnJubm95dWxycmhnaXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODc0NTcsImV4cCI6MjA4OTk2MzQ1N30.JVQtMIzswxiNzfaNCzosJJpn9B4OouRIVmBm682DAVk}"
export NEXT_PUBLIC_SUPABASE_URL
export NEXT_PUBLIC_SUPABASE_ANON_KEY
echo "Supabase URL for build: $NEXT_PUBLIC_SUPABASE_URL"
echo "Supabase anon key present: $([ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] && echo yes || echo NO)"

echo "Building mobile bundle + syncing iOS..."
npm run build:mobile

echo "===== ci_post_clone: done ====="

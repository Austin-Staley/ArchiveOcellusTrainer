#!/usr/bin/env bash
set -euo pipefail

side="$1"
repo="$side/repo"
rm -rf "$repo"
mkdir "$repo"
git -C "$repo" init --quiet
for revision in base head; do
  find "$repo" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  cp -R "$side/$revision/." "$repo/"
  git -C "$repo" add -A
  git -C "$repo" -c user.name=fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false commit --quiet -m "$revision"
  git -C "$repo" tag "$revision"
done

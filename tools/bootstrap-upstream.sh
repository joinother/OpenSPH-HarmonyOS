#!/usr/bin/env bash
# 建立可 diff 的上游工作副本并打上鸿蒙补丁。
# 用法: tools/bootstrap-upstream.sh [目标目录，默认 upstream/opensph]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/upstream/opensph}"
BASE_COMMIT="7415f249663e1a1b91b7f8e8df703ca8b2cd360e"
UPSTREAM_URL="https://github.com/pavelsevecek/OpenSPH.git"

if [ -e "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null || true)" ]; then
  echo "目标已存在: $DEST" >&2
  echo "如需重建，请先自行删除。" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
echo "==> 克隆上游（blobless，随后按需取基线快照）"
git clone --filter=blob:none --no-checkout "$UPSTREAM_URL" "$DEST"
cd "$DEST"
git fetch --depth=1 origin "$BASE_COMMIT"
git checkout -q "$BASE_COMMIT"
git switch -q -c work

echo "==> 应用 OpenSPH 鸿蒙补丁"
git apply --stat "$ROOT/patches/opensph-harmonyos.patch" | tail -3
git apply "$ROOT/patches/opensph-harmonyos.patch"

echo
echo "完成。当前差异："
git diff --stat | tail -3
echo
echo "查看逐行改动:  git -C \"$DEST\" diff"
echo "注意: patches/wxwidgets-harmonyos.patch 是对 wxWidgets 的改动，需在 wxWidgets 源码树里单独应用。"

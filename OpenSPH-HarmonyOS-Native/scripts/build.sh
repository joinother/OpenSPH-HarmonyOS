#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
ide_dir="${DEVECO_STUDIO_HOME:-/Applications/DevEco-Studio.app/Contents}"
export PATH="$ide_dir/tools/node/bin:$ide_dir/tools/ohpm/bin:$PATH"
export DEVECO_SDK_HOME="${DEVECO_SDK_HOME:-$ide_dir/sdk}"
cd "$project_dir"
"$ide_dir/tools/ohpm/bin/ohpm" install
"$ide_dir/tools/hvigor/bin/hvigorw" assembleHap --mode module -p product=default --no-daemon

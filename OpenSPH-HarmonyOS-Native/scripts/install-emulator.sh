#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
ide_dir="${DEVECO_STUDIO_HOME:-/Applications/DevEco-Studio.app/Contents}"
hdc_bin="$ide_dir/sdk/default/openharmony/toolchains/hdc"
target="${1:-127.0.0.1:5555}"
hap="$project_dir/entry/build/default/outputs/default/entry-default-unsigned.hap"
# The development emulator used for this prototype accepts this unsigned HAP.
# Real hardware and distribution require a valid signing profile.
"$hdc_bin" -t "$target" install -r "$hap"
"$hdc_bin" -t "$target" shell aa start -a EntryAbility -b com.opensph.lab

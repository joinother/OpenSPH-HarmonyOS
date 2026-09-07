#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$project_dir/build/placement-tests"
if [[ $# == 0 ]]; then
  clang++ -std=c++17 -O1 -g -fsanitize=address,undefined -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/placement_projection_test.cpp" -o "$project_dir/build/placement-tests/projection"
  "$project_dir/build/placement-tests/projection"
else
  [[ "$1" == "127.0.0.1:5555" ]]
  sdk="${DEVECO_STUDIO_HOME:-/Applications/DevEco-Studio.app/Contents}/sdk/default/openharmony"
  "$sdk/native/llvm/bin/clang++" --target=aarch64-linux-ohos --sysroot="$sdk/native/sysroot" -std=c++17 -O2 -static-libstdc++ -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/placement_projection_test.cpp" -o "$project_dir/build/placement-tests/projection-ohos"
  "$sdk/toolchains/hdc" -t "$1" file send "$project_dir/build/placement-tests/projection-ohos" /data/local/tmp/sph-placement-test
  "$sdk/toolchains/hdc" -t "$1" shell chmod 755 /data/local/tmp/sph-placement-test
  result="$("$sdk/toolchains/hdc" -t "$1" shell /data/local/tmp/sph-placement-test)"
  printf '%s\n' "$result"
  [[ "$result" == *"PASS 264"* ]]
fi

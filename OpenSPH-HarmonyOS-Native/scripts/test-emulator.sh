#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
ide_dir="${DEVECO_STUDIO_HOME:-/Applications/DevEco-Studio.app/Contents}"
sdk="$ide_dir/sdk/default/openharmony"
build_dir="$project_dir/build/native-test"
cmake="$sdk/native/build-tools/cmake/bin/cmake"
"$cmake" -S "$project_dir/third_party/opensph" -B "$build_dir" \
  -DCMAKE_TOOLCHAIN_FILE="$sdk/native/build/cmake/ohos.toolchain.cmake" \
  -DOHOS_ARCH=arm64-v8a -DCMAKE_BUILD_TYPE=Release -G Ninja \
  -DCMAKE_MAKE_PROGRAM="$sdk/native/build-tools/cmake/bin/ninja"
"$cmake" --build "$build_dir" -j 6
"$sdk/native/llvm/bin/clang++" --target=aarch64-linux-ohos --sysroot="$sdk/native/sysroot" \
  -std=c++17 -O2 -DNDEBUG -I"$project_dir/third_party/opensph/core" \
  -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/engine_smoke.cpp" \
  "$project_dir/entry/src/main/cpp/engine.cpp" "$project_dir/entry/src/main/cpp/galaxy_simulation.cpp" "$project_dir/entry/src/main/cpp/orbit.cpp" "$build_dir/core/libcore.a" \
  -pthread -static-libstdc++ -o "$build_dir/engine_smoke"
hdc_bin="$sdk/toolchains/hdc"
target="${1:-127.0.0.1:5555}"
"$hdc_bin" -t "$target" file send "$build_dir/engine_smoke" /data/local/tmp/opensph_engine_smoke
"$hdc_bin" -t "$target" shell chmod 755 /data/local/tmp/opensph_engine_smoke
result="$("$hdc_bin" -t "$target" shell /data/local/tmp/opensph_engine_smoke /data/local/tmp/sph-lab-tests)"
printf '%s\n' "$result"
# hdc may return success even when the remote program returns nonzero.
[[ "$result" == *"PASS pause/resume"* && "$result" != *"FAIL "* ]]

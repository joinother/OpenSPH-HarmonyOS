#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
sdk="${DEVECO_STUDIO_HOME:-/Applications/DevEco-Studio.app/Contents}/sdk/default/openharmony"
device="${1:?Explicit device required}"
core_build="$project_dir/build/native-test"
if [[ ! -f "$core_build/core/libcore.a" ]]; then
  "$sdk/native/build-tools/cmake/bin/cmake" -S "$project_dir/third_party/opensph" -B "$core_build" \
    -DCMAKE_TOOLCHAIN_FILE="$sdk/native/build/cmake/ohos.toolchain.cmake" -DOHOS_ARCH=arm64-v8a -DCMAKE_BUILD_TYPE=Release -G Ninja \
    -DCMAKE_MAKE_PROGRAM="$sdk/native/build-tools/cmake/bin/ninja"
fi
"$sdk/native/build-tools/cmake/bin/cmake" --build "$core_build" -j 6
"$sdk/native/llvm/bin/clang++" --target=aarch64-linux-ohos --sysroot="$sdk/native/sysroot" \
 -std=c++17 -O2 -DNDEBUG -I"$project_dir/third_party/opensph/core" -I"$project_dir/entry/src/main/cpp" \
 "$project_dir/tests/impact_sph_test.cpp" "$project_dir/entry/src/main/cpp/engine.cpp" "$project_dir/entry/src/main/cpp/galaxy_simulation.cpp" "$project_dir/entry/src/main/cpp/orbit.cpp" "$core_build/core/libcore.a" \
 -pthread -static-libstdc++ -o "$core_build/impact_sph_test"
hdc="$sdk/toolchains/hdc"
"$hdc" -t "$device" file send "$core_build/impact_sph_test" /data/local/tmp/sph-impact-sph-test
"$hdc" -t "$device" shell chmod 755 /data/local/tmp/sph-impact-sph-test
"$hdc" -t "$device" shell mkdir -p /data/local/tmp/sph-impact-sph-results
result="$("$hdc" -t "$device" shell /data/local/tmp/sph-impact-sph-test /data/local/tmp/sph-impact-sph-results)"
printf '%s\n' "$result"
[[ "$result" == *"PASS staged cancellation"* && "$result" != *"FAIL "* ]]

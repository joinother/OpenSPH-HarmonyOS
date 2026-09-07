#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:-127.0.0.1:5555}"
[[ "$target" == '127.0.0.1:5555' ]] || { echo 'Only the task emulator is allowed' >&2; exit 1; }
sdk="${DEVECO_STUDIO_HOME:-/Applications/DevEco-Studio.app/Contents}/sdk/default/openharmony"
build_dir="$project_dir/build/native-test"
"$sdk/native/build-tools/cmake/bin/cmake" -S "$project_dir/third_party/opensph" -B "$build_dir" \
  -DCMAKE_TOOLCHAIN_FILE="$sdk/native/build/cmake/ohos.toolchain.cmake" -DOHOS_ARCH=arm64-v8a \
  -DCMAKE_BUILD_TYPE=Release -G Ninja -DCMAKE_MAKE_PROGRAM="$sdk/native/build-tools/cmake/bin/ninja" >&2
"$sdk/native/build-tools/cmake/bin/cmake" --build "$build_dir" -j 6 >&2
"$sdk/native/llvm/bin/clang++" --target=aarch64-linux-ohos --sysroot="$sdk/native/sysroot" \
  -std=c++17 -O3 -DNDEBUG -I"$project_dir/third_party/opensph/core" -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/sph_relaxation.cpp" \
  "$build_dir/core/libcore.a" -pthread -static-libstdc++ -o "$build_dir/sph_relaxation"
hdc="$sdk/toolchains/hdc"
"$hdc" -t "$target" file send "$build_dir/sph_relaxation" /data/local/tmp/opensph_sph_relaxation >&2
"$hdc" -t "$target" shell chmod 755 /data/local/tmp/opensph_sph_relaxation >&2
# HDC does not reliably propagate program exit codes. Completion plus full
# numerical validation below is mandatory before emitting machine-readable data.
"$hdc" -t "$target" shell /data/local/tmp/opensph_sph_relaxation > "$build_dir/sph-relaxation.jsonl"
node -e 'const fs=require("fs"),s=fs.readFileSync(process.argv[1],"utf8");if(s.includes("FAIL")||!JSON.parse(s.trim().split("\n").at(-1)).ok)process.exit(1)' "$build_dir/sph-relaxation.jsonl"
cat "$build_dir/sph-relaxation.jsonl"

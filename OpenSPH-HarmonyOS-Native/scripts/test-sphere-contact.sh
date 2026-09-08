#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="$project_dir/build/sphere-contact-tests"
mkdir -p "$build_dir"
if [[ $# == 0 ]]; then
  clang++ -std=c++17 -O2 -I"$project_dir/entry/src/main/cpp" \
    "$project_dir/tests/sphere_contact_test.cpp" "$project_dir/entry/src/main/cpp/orbit.cpp" -o "$build_dir/sphere_contact_test"
  "$build_dir/sphere_contact_test"
else
  sdk="${DEVECO_STUDIO_HOME:-/Applications/DevEco-Studio.app/Contents}/sdk/default/openharmony"
  "$sdk/native/llvm/bin/clang++" --target=aarch64-linux-ohos --sysroot="$sdk/native/sysroot" \
    -std=c++17 -O2 -static-libstdc++ -I"$project_dir/entry/src/main/cpp" \
    "$project_dir/tests/sphere_contact_test.cpp" "$project_dir/entry/src/main/cpp/orbit.cpp" -o "$build_dir/sphere_contact_test-ohos"
  "$sdk/toolchains/hdc" -t "$1" file send "$build_dir/sphere_contact_test-ohos" /data/local/tmp/sph-contact-test
  "$sdk/toolchains/hdc" -t "$1" shell chmod 755 /data/local/tmp/sph-contact-test
  result="$("$sdk/toolchains/hdc" -t "$1" shell /data/local/tmp/sph-contact-test)"
  printf '%s\n' "$result"
  [[ "$result" == *"PASS gravitational demo"* && "$result" != *"FAIL "* ]]
fi

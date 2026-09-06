#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$project_dir/build/sky-tests"
clang++ -std=c++17 -O2 -fsanitize=address,undefined -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/sky_data_test.cpp" "$project_dir/entry/src/main/cpp/sky_data.cpp" -o "$project_dir/build/sky-tests/sky_test"
"$project_dir/build/sky-tests/sky_test"

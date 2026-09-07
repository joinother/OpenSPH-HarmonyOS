#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$project_dir/build/moon-test"
clang++ -std=c++17 -O1 -g -fsanitize=address,undefined -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/moon_map_test.cpp" -o "$project_dir/build/moon-test/moon_map_test"
"$project_dir/build/moon-test/moon_map_test"

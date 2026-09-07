#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$project_dir/build/ring-tests"
clang++ -std=c++17 -O2 -fsanitize=address,undefined -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/ring_trace_test.cpp" -o "$project_dir/build/ring-tests/ring_trace_test"
"$project_dir/build/ring-tests/ring_trace_test"
clang++ -std=c++17 -O2 -fsanitize=address,undefined -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/dense_ring_test.cpp" -o "$project_dir/build/ring-tests/dense_ring_test"
"$project_dir/build/ring-tests/dense_ring_test"

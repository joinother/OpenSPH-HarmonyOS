#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$project_dir/build/fragment-tests"
clang++ -std=c++17 -O1 -g -fsanitize=address,undefined -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/fragment_follow_test.cpp" -o "$project_dir/build/fragment-tests/follow"
"$project_dir/build/fragment-tests/follow"

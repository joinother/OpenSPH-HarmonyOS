#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$project_dir/build"
"${CXX:-clang++}" -std=c++17 -O2 -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/impact_plan_test.cpp" "$project_dir/entry/src/main/cpp/orbit.cpp" -o "$project_dir/build/impact_plan_test"
"$project_dir/build/impact_plan_test"

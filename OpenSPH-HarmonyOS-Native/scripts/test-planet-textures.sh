#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$project_dir/build/material-tests"
clang++ -std=c++17 -O2 -fsanitize=address,undefined \
  -I"$project_dir/entry/src/main/cpp" \
  "$project_dir/tests/planet_texture_test.cpp" "$project_dir/entry/src/main/cpp/planet_texture.cpp" \
  -o "$project_dir/build/material-tests/planet_texture_test"
"$project_dir/build/material-tests/planet_texture_test"
clang++ -std=c++17 -O2 -fsanitize=address,undefined -pthread \
  -I"$project_dir/entry/src/main/cpp" \
  "$project_dir/tests/surface_generator_test.cpp" "$project_dir/entry/src/main/cpp/planet_texture.cpp" "$project_dir/entry/src/main/cpp/surface_generator.cpp" \
  -o "$project_dir/build/material-tests/surface_generator_test"
"$project_dir/build/material-tests/surface_generator_test"

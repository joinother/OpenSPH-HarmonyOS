#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$project_dir/build/projection-tests"
clang++ -std=c++17 -O1 -g -fsanitize=address,undefined -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/projection_test.cpp" -o "$project_dir/build/projection-tests/projection_test"
"$project_dir/build/projection-tests/projection_test"

clang++ -std=c++17 -O1 -g -fsanitize=address,undefined -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/camera_journey_test.cpp" -o "$project_dir/build/projection-tests/camera_journey_test"
"$project_dir/build/projection-tests/camera_journey_test"

clang++ -std=c++17 -O1 -g -fsanitize=address,undefined -I"$project_dir/entry/src/main/cpp" "$project_dir/tests/camera_navigation_test.cpp" -o "$project_dir/build/projection-tests/camera_navigation_test"
"$project_dir/build/projection-tests/camera_navigation_test"

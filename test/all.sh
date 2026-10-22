#!/bin/bash
# Quick suite: build, then the fast checks. Takes about two minutes.
# Slow balance runs (lab.py, policy.py, clubs.py) are separate; see ARCHITECTURE.md.
set -e
cd "$(dirname "$0")/.."
./build.sh
for t in smoke tipcheck tooltip fuzz sprites hooks traits sports stats why tips free chest fitcheck pausesave difficulty_ui practice pops season_goals profiles trouble forfeit; do
  echo "== $t"; timeout 240 python3 test/$t.py | tail -3
done

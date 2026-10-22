#!/bin/bash
# Quick suite: build, then the fast checks.
# Works on macOS and Linux. Uses the project venv if present, and a per-check timeout only where one exists
# (GNU timeout on Linux, gtimeout from `brew install coreutils` on macOS).
cd "$(dirname "$0")/.."
PY=python3; [ -x .venv/bin/python ] && PY=.venv/bin/python
if command -v timeout >/dev/null 2>&1; then TO="timeout 240"
elif command -v gtimeout >/dev/null 2>&1; then TO="gtimeout 240"
else TO=""; fi
./build.sh || exit 1
fail=0
for t in smoke tipcheck tooltip fuzz sprites hooks traits sports stats why tips free chest fitcheck pausesave difficulty_ui practice pops season_goals profiles trouble forfeit realm_audit realm_tiles realm_smoke realm_match realm_save realm_party realm_road realm_town realm_dungeon realm_cups realm_bot realm_polish; do
  echo "== $t"
  $TO "$PY" "test/$t.py" > "/tmp/sd-$t.log" 2>&1 || { echo "   FAILED (exit $?), see /tmp/sd-$t.log"; fail=1; }
  tail -3 "/tmp/sd-$t.log"
done
exit $fail
#!/bin/bash
# Quick suite: build both pages once, then the checks, several at a time.
#   ./test/all.sh                       every check
#   ./test/all.sh realm_smoke realm_music  just those
#   JOBS=1 ./test/all.sh                one at a time (JOBS defaults to half the cores, at least 2)
# Each check's output goes to /tmp/sd-<check>.log; the summary prints in list order once they're all done, with each
# check's last lines, any failures, and the slowest checks. Checks start slowest first (from the last run's times,
# kept in build/test-times.txt), so the long ones aren't left until the end. The checks don't rebuild (SD_BUILT=1,
# test/paths.py). Works on macOS and Linux. Uses the project venv if present. Each check has 240 seconds (realm_music,
# which renders a minute of audio for each of its palettes, 600): through GNU
# timeout on Linux, gtimeout from `brew install coreutils` on macOS, or perl's alarm otherwise, so a stuck check fails
# rather than holding up the suite. Ctrl-C stops the checks that are running too.
cd "$(dirname "$0")/.."
PY=python3; [ -x .venv/bin/python ] && PY=.venv/bin/python
if command -v timeout >/dev/null 2>&1; then TO=timeout
elif command -v gtimeout >/dev/null 2>&1; then TO=gtimeout
else TO=perl; fi
CHECKS="smoke tipcheck tooltip fuzz sprites hooks traits sports stats why tips free chest fitcheck pausesave difficulty_ui practice pops season_goals profiles trouble forfeit realm_audit realm_tiles realm_smoke realm_match realm_save realm_party realm_road realm_town realm_dungeon realm_cups realm_bot realm_polish realm_feel realm_ground realm_ways realm_camp realm_stats realm_bonds realm_league realm_diamond_source realm_journal realm_diamond realm_diamond_ratings realm_diamond_nine realm_diamond_game realm_diamond_cup realm_diamond_feel realm_click realm_grounds realm_gmatch realm_cities realm_spots realm_fixtures realm_home realm_gfeel realm_notices realm_legs realm_captain realm_weather realm_name realm_tour realm_sinks realm_defend realm_legends realm_gate realm_settings realm_map soccer realm_soccer realm_retire indeck realm_eggs realm_prospects realm_engines realm_gridiron realm_gridiron_game realm_gridiron_play realm_gridiron_seven realm_gridiron_playbook realm_gridiron_world realm_gridiron_powers realm_gridiron_cup realm_gridiron_fixes realm_gridiron_feel realm_gridiron_view realm_gridiron_bench realm_gridiron_stance realm_music"
[ $# -gt 0 ] && CHECKS="$*"
CORES=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)
JOBS=${JOBS:-$(( CORES / 2 > 2 ? CORES / 2 : 2 ))}
case "$JOBS" in ''|*[!0-9]*) echo "JOBS must be a whole number, at least 1 (got '$JOBS')" >&2; exit 2 ;; esac
[ "$JOBS" -ge 1 ] || { echo "JOBS must be at least 1 (0 would start every check at once)" >&2; exit 2; }
T0=$(date +%s)
./build.sh || exit 1
./build.sh src/realm/manifest.txt || exit 1
export SD_BUILT=1 PY TO
mkdir -p build/test-status; rm -f build/test-status/*
TIMES=build/test-times.txt; touch "$TIMES"

# one check: its log, then "<exit code> <seconds>" in build/test-status/<check>
run_one() {
  local t="$1" s=$(date +%s) code lim=240
  [ "$t" = realm_music ] && lim=600
  if [ "$TO" = perl ]; then perl -e 'alarm shift @ARGV; exec @ARGV' $lim "$PY" "test/$t.py" > "/tmp/sd-$t.log" 2>&1
  else "$TO" --foreground -k 10 $lim "$PY" "test/$t.py" > "/tmp/sd-$t.log" 2>&1; fi; code=$?
  echo "$code $(( $(date +%s) - s ))" > "build/test-status/$t"
}
export -f run_one
# slowest first: by the last run's seconds (a check with no time yet goes first)
order=$(for t in $CHECKS; do echo "$(awk -v t="$t" '$1 == t { s = $2 } END { print (s == "" ? 99999 : s) }' "$TIMES") $t"; done | sort -rn | awk '{ print $2 }')
echo "$(echo $CHECKS | wc -w | tr -d ' ') checks, $JOBS at a time"
# Ctrl-C (or a kill) takes the running checks down with the suite, rather than leaving them to finish on their own
# (xargs runs in the background and the suite waits on it: bash runs a trap only between commands, and waiting is one)
# (only the suite's own processes: xargs and everything under it; it may share a process group with whatever started it)
kill_tree() { local c; for c in $(pgrep -P "$1"); do kill_tree "$c"; done; kill -TERM "$1" 2>/dev/null; }
printf '%s\n' $order | xargs -P "$JOBS" -I{} bash -c 'run_one "$1"' _ {} &
XARGS=$!
trap 'trap - INT TERM; kill_tree $XARGS; echo; echo "stopped"; exit 130' INT TERM
wait $XARGS
trap - INT TERM

fail=0; slow=""
for t in $CHECKS; do
  # a check with no status didn't run (or was stopped): a failure, and no time kept for it
  if [ -f "build/test-status/$t" ]; then read -r code secs < "build/test-status/$t"; slow="$slow$secs $t"$'\n'; else code="didn't run"; secs='-'; fi
  echo "== $t (${secs}s)"
  [ "$code" = 0 ] || { echo "   FAILED (exit $code), see /tmp/sd-$t.log"; fail=1; }
  [ -f "/tmp/sd-$t.log" ] && tail -3 "/tmp/sd-$t.log"
done
# keep the times for next time's order: the checks that ran this time get their new time, and every other keeps its old one
ran=$(printf '%s' "$slow" | awk 'NF == 2 { print $2 }' | tr '\n' ' ')
{ printf '%s' "$slow" | awk 'NF == 2 { print $2, $1 }'; awk -v seen="$ran" 'BEGIN { split(seen, a, " "); for (i in a) s[a[i]] = 1 } !($1 in s)' "$TIMES"; } > "$TIMES.new" && mv "$TIMES.new" "$TIMES"
echo "slowest: $(printf '%s' "$slow" | sort -rn | head -5 | awk '{ printf "%s %ss  ", $2, $1 }')"
echo "total $(( $(date +%s) - T0 ))s, $JOBS at a time"
[ $fail = 0 ] && echo "all passed" || echo "SOME FAILED"
exit $fail

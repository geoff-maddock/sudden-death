#!/bin/bash
# Build a game from a manifest: ./build.sh [manifest]   (default: src/manifest.txt)
#
# A manifest lists source files, one path per line, relative to the repo root, in the order they are
# concatenated into one <script>. Blank lines and # comments are ignored. Directives:
#   shell <file>     the HTML page the script is wrapped in (required)
#   out <file>       where the built page is written (required)
#   include <file>   read another manifest at this point, as if its lines were pasted in
#   style <file>     extra CSS added at the end of the shell's <style> (repeatable)
#   title <text>     replaces the shell's <title> (the page and tab name)
#   scope <NAME> <manifest> <exports>
#                    wraps that manifest's source files in one function, so their top-level names stay private,
#                    and sets the global NAME to what the <exports> file returns (it holds a `return {...};`,
#                    added at the end of the function). The manifest's shell, out, style and title lines are
#                    ignored, so a standalone game's own manifest can be scoped as it is. Duplicate names are
#                    checked inside each scope on its own. Scopes do not nest.
#   text <NAME> <file>
#                    a source line `const NAME = "<the file's contents>";`, so a script can carry a stylesheet or
#                    markup (the Realm's diamond scope mounts Brimstone Diamond's page from these)
# Plain bash, no dependencies beyond node (for the syntax check).
set -e
cd "$(dirname "$0")"
MANIFEST="${1:-src/manifest.txt}"
SHELL_HTML=""; OUT=""; TITLE=""; ITEMS=(); STYLES=(); SCOPE=""

# ITEMS holds f:<file>, t:<NAME>=<file> (a text constant), o:<scope name> (open a scope) and c:<exports file> (close it)
read_manifest() {
  local m="$1" line kw arg sn sm se tn tf
  [ -f "$m" ] || { echo "Manifest not found: $m" >&2; exit 1; }
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"                                   # strip comments
    line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [ -z "$line" ] && continue
    kw="${line%%[[:space:]]*}"; arg="$(printf '%s' "${line#"$kw"}" | sed -e 's/^[[:space:]]*//')"
    if [ -n "$SCOPE" ] && { [ "$kw" = shell ] || [ "$kw" = out ] || [ "$kw" = title ] || [ "$kw" = style ]; }; then continue; fi
    case "$kw" in
      shell)   SHELL_HTML="$arg" ;;
      out)     OUT="$arg" ;;
      title)   TITLE="$arg" ;;
      include) read_manifest "$arg" ;;
      style)   [ -f "$arg" ] || { echo "Missing style file in $m: $arg" >&2; exit 1; }
               STYLES+=("$arg") ;;
      scope)   read -r sn sm se <<< "$arg"
               [[ "$sn" =~ ^[A-Za-z_\$][A-Za-z0-9_\$]*$ ]] || { echo "Bad scope name in $m: $sn" >&2; exit 1; }
               [ -z "$SCOPE" ] || { echo "Scopes do not nest ($sn inside $SCOPE) in $m" >&2; exit 1; }
               [ -f "$se" ] || { echo "Missing exports file in $m: $se" >&2; exit 1; }
               SCOPE="$sn"; ITEMS+=("o:$sn"); read_manifest "$sm"; ITEMS+=("c:$se"); SCOPE="" ;;
      text)    read -r tn tf <<< "$arg"
               [[ "$tn" =~ ^[A-Za-z_\$][A-Za-z0-9_\$]*$ ]] || { echo "Bad text name in $m: $tn" >&2; exit 1; }
               [ -f "$tf" ] || { echo "Missing text file in $m: $tf" >&2; exit 1; }
               ITEMS+=("t:$tn=$tf") ;;
      *)       [ -f "$line" ] || { echo "Missing source file in $m: $line" >&2; exit 1; }
               ITEMS+=("f:$line") ;;
    esac
  done < "$m"
}
read_manifest "$MANIFEST"
[ -n "$SHELL_HTML" ] || { echo "No 'shell' line in $MANIFEST" >&2; exit 1; }
[ -n "$OUT" ] || { echo "No 'out' line in $MANIFEST" >&2; exit 1; }
[ ${#ITEMS[@]} -gt 0 ] || { echo "No source files in $MANIFEST" >&2; exit 1; }

NAME="$(basename "$OUT" .html)"
JS="build/$NAME.js"
mkdir -p build "$(dirname "$OUT")"
# one build of a page at a time: a second one (a single check run while the suite runs) waits its turn rather than
# mixing their files in build/ (a lock more than a minute old was left by a killed build, and is taken over); and the
# page is written whole and then moved into place, so a check reading it never gets half of it, and an interrupted
# build leaves no half-written file behind
LOCK="build/.$NAME.lock"
until mkdir "$LOCK" 2>/dev/null; do
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then rm -rf "$LOCK"; else sleep .1; fi
done
trap 'rmdir "$LOCK" 2>/dev/null; rm -f "$OUT.tmp.$$"' EXIT
# the whole script, plus one file per name space for the duplicate check: build/NAME.global.js holds the
# global files and each scope's `const NAME` line; build/NAME.scope-<S>.js holds what scope S wraps
: > "$JS"; : > "build/$NAME.global.js"; NS="build/$NAME.global.js"; SPACES=("$NS")
for it in "${ITEMS[@]}"; do
  case "$it" in
    f:*) cat "${it#f:}" >> "$JS"; cat "${it#f:}" >> "$NS" ;;
    t:*) tn="${it#t:}"; tn="${tn%%=*}"
         node -e 'const fs = require("fs"); process.stdout.write("const " + process.argv[1] + " = " + JSON.stringify(fs.readFileSync(process.argv[2], "utf8")).replace(/<\/(script)/gi, "<\\/$1") + ";\n")' "$tn" "${it#*=}" | tee -a "$JS" >> "$NS" ;;
    o:*) printf 'const %s = (function () {\n' "${it#o:}" | tee -a "$JS" >> "build/$NAME.global.js"
         NS="build/$NAME.scope-${it#o:}.js"; : > "$NS"; SPACES+=("$NS") ;;
    c:*) { printf '\n'; cat "${it#c:}"; printf '\n})();\n'; } >> "$JS"; NS="build/$NAME.global.js" ;;
  esac
done
node --check "$JS"
# extra styles go just before the shell's first </style>
if [ ${#STYLES[@]} -gt 0 ]; then
  n=$(grep -n '^</style>$' "$SHELL_HTML" | head -1 | cut -d: -f1)
  [ -n "$n" ] || { echo "No '</style>' line in $SHELL_HTML for style lines" >&2; exit 1; }
  { head -n $((n - 1)) "$SHELL_HTML"; cat "${STYLES[@]}"; tail -n +"$n" "$SHELL_HTML"; } > "build/$NAME.shell.html"
  SHELL_HTML="build/$NAME.shell.html"
fi
# a title line swaps the shell's <title> (awk reads it from the environment, so no escaping is needed)
if [ -n "$TITLE" ]; then
  grep -q '<title>.*</title>' "$SHELL_HTML" || { echo "No <title> in $SHELL_HTML for the title line" >&2; exit 1; }
  T="$(printf '%s' "$TITLE" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g')" awk '!done && match($0, /<title>.*<\/title>/) { $0 = substr($0, 1, RSTART - 1) "<title>" ENVIRON["T"] "</title>" substr($0, RSTART + RLENGTH); done = 1 } { print }' "$SHELL_HTML" > "build/$NAME.titled.html"
  SHELL_HTML="build/$NAME.titled.html"
fi
{ cat "$SHELL_HTML"; echo '<script>'; cat "$JS"; echo '</script>'; echo '</body></html>'; } > "$OUT.tmp.$$"
mv -f "$OUT.tmp.$$" "$OUT"
wc -c "$OUT"
# every part shares one global scope (or one scope's function): a second top-level function or const with the
# same name silently replaces the first, so refuse to build if that happens
for ns in "${SPACES[@]}"; do
  dups=$(grep -oE "^(async )?function [A-Za-z_\$][A-Za-z0-9_\$]*|^(const|let|var) [A-Za-z_\$][A-Za-z0-9_\$]*" "$ns" | awk '{print $NF}' | sort | uniq -d)
  if [ -n "$dups" ]; then
    where="global"; case "$ns" in *.scope-*) where="scope ${ns##*.scope-}"; where="${where%.js}" ;; esac
    echo "Duplicate names ($where): $dups" >&2; exit 1
  fi
done

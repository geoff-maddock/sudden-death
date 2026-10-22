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
# Plain bash, no dependencies beyond node (for the syntax check).
set -e
cd "$(dirname "$0")"
MANIFEST="${1:-src/manifest.txt}"
SHELL_HTML=""; OUT=""; TITLE=""; FILES=(); STYLES=()

read_manifest() {
  local m="$1" line kw arg
  [ -f "$m" ] || { echo "Manifest not found: $m" >&2; exit 1; }
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"                                   # strip comments
    line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [ -z "$line" ] && continue
    kw="${line%%[[:space:]]*}"; arg="$(printf '%s' "${line#"$kw"}" | sed -e 's/^[[:space:]]*//')"
    case "$kw" in
      shell)   SHELL_HTML="$arg" ;;
      out)     OUT="$arg" ;;
      title)   TITLE="$arg" ;;
      include) read_manifest "$arg" ;;
      style)   [ -f "$arg" ] || { echo "Missing style file in $m: $arg" >&2; exit 1; }
               STYLES+=("$arg") ;;
      *)       [ -f "$line" ] || { echo "Missing source file in $m: $line" >&2; exit 1; }
               FILES+=("$line") ;;
    esac
  done < "$m"
}
read_manifest "$MANIFEST"
[ -n "$SHELL_HTML" ] || { echo "No 'shell' line in $MANIFEST" >&2; exit 1; }
[ -n "$OUT" ] || { echo "No 'out' line in $MANIFEST" >&2; exit 1; }
[ ${#FILES[@]} -gt 0 ] || { echo "No source files in $MANIFEST" >&2; exit 1; }

NAME="$(basename "$OUT" .html)"
JS="build/$NAME.js"
mkdir -p build "$(dirname "$OUT")"
cat "${FILES[@]}" > "$JS"
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
{ cat "$SHELL_HTML"; echo '<script>'; cat "$JS"; echo '</script>'; echo '</body></html>'; } > "$OUT"
wc -c "$OUT"
# every part shares one global scope: a second top-level function or const with the same name silently
# replaces the first, so refuse to build if that happens
dups=$(grep -oE "^(async )?function [A-Za-z_\$][A-Za-z0-9_\$]*|^(const|let|var) [A-Za-z_\$][A-Za-z0-9_\$]*" "$JS" | awk '{print $NF}' | sort | uniq -d)
if [ -n "$dups" ]; then echo "Duplicate global names: $dups" >&2; exit 1; fi

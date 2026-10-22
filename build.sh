#!/bin/bash
# Build a game from a manifest: ./build.sh [manifest]   (default: src/manifest.txt)
#
# A manifest lists source files, one path per line, relative to the repo root, in the order they are
# concatenated into one <script>. Blank lines and # comments are ignored. Directives:
#   shell <file>     the HTML page the script is wrapped in (required)
#   out <file>       where the built page is written (required)
#   include <file>   read another manifest at this point, as if its lines were pasted in
# Plain bash, no dependencies beyond node (for the syntax check).
set -e
cd "$(dirname "$0")"
MANIFEST="${1:-src/manifest.txt}"
SHELL_HTML=""; OUT=""; FILES=()

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
      include) read_manifest "$arg" ;;
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
{ cat "$SHELL_HTML"; echo '<script>'; cat "$JS"; echo '</script>'; echo '</body></html>'; } > "$OUT"
wc -c "$OUT"
# every part shares one global scope: a second top-level function or const with the same name silently
# replaces the first, so refuse to build if that happens
dups=$(grep -oE "^(async )?function [A-Za-z_\$][A-Za-z0-9_\$]*|^(const|let|var) [A-Za-z_\$][A-Za-z0-9_\$]*" "$JS" | awk '{print $NF}' | sort | uniq -d)
if [ -n "$dups" ]; then echo "Duplicate global names: $dups" >&2; exit 1; fi

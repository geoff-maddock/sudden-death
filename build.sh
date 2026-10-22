#!/bin/bash
set -e
mkdir -p "$(dirname "$0")/build"
cd "$(dirname "$0")"
cat src/p1.js src/p2.js src/p2b.js src/p2e.js src/p2d.js src/p3.js src/p3b.js src/p3c.js src/p4.js src/p4b.js src/p4c.js src/p4d.js src/p4e.js src/p2c.js src/p5.js src/p5b.js src/p5c.js src/p5d.js src/p6.js src/p7.js src/p7b.js src/p7c.js src/p7d.js src/p8.js src/p8b.js src/p8c.js src/p9.js > build/all.js
node --check build/all.js
{ cat src/p0.html; echo '<script>'; cat build/all.js; echo '</script>'; echo '</body></html>'; } > sudden-death.html
wc -c sudden-death.html
# every part shares one global scope: a second top-level function or const with the same name silently
# replaces the first, so refuse to build if that happens
dups=$(grep -oE "^(async )?function [A-Za-z_\$][A-Za-z0-9_\$]*|^(const|let|var) [A-Za-z_\$][A-Za-z0-9_\$]*" build/all.js | awk '{print $NF}' | sort | uniq -d)
if [ -n "$dups" ]; then echo "Duplicate global names: $dups" >&2; exit 1; fi

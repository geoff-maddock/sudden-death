#!/usr/bin/env python3
"""Split the quick checks across CI's shards, balanced by how long each takes in CI (issue #94).

  python3 test/shard.py K N check1 check2 ...     the checks for shard K of N (0-based), one per line
  python3 test/shard.py --from-log < ci.log       a fresh test/ci-times.txt from a CI run's log (see below)

The times are test/ci-times.txt ("<check> <seconds>", from a CI run, where the checks are slower than on a laptop).
The longest check goes first, each to the shard with the least work so far; a check with no time yet counts as the
median. Every shard computes the same split from the same list and file, so the shards share nothing at run time.

To refresh the times after the suite changes a lot:
  gh run view <run id> --log | python3 test/shard.py --from-log > test/ci-times.txt
(the log of every shard of a run, or of the one job before the split: each check's "== name (Ns)" line).
"""
import os, re, sys

TIMES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ci-times.txt')

def load_times():
    t = {}
    if os.path.exists(TIMES):
        for line in open(TIMES):
            p = line.split()
            if len(p) == 2 and p[1].isdigit(): t[p[0]] = int(p[1])
    return t

def split(checks, n, times):
    known = sorted(times[c] for c in checks if c in times)
    med = known[len(known) // 2] if known else 30
    load, out = [0] * n, [[] for _ in range(n)]
    # longest first, each to the least-loaded shard (ties: the lowest shard), in a fixed order so every shard agrees
    for c in sorted(checks, key=lambda c: (-times.get(c, med), c)):
        k = min(range(n), key=lambda i: (load[i], i))
        out[k].append(c); load[k] += times.get(c, med)
    return out, load

def main(argv):
    if argv[:1] == ['--from-log']:
        seen = {}
        for line in sys.stdin:
            m = re.search(r'== ([a-z0-9_]+) \((\d+)s\)', line)
            if m: seen[m.group(1)] = int(m.group(2))
        for c in sorted(seen): print(c, seen[c])
        return 0
    if len(argv) < 3 or not argv[0].isdigit() or not argv[1].isdigit():
        print(__doc__, file=sys.stderr); return 2
    k, n, checks = int(argv[0]), int(argv[1]), argv[2:]
    if not 0 <= k < n: print(f'shard {k} is not one of 0 to {n - 1}', file=sys.stderr); return 2
    out, load = split(checks, n, load_times())
    print(f'shard {k} of {n}: {len(out[k])} checks, about {load[k]}s of CI time (shards: {", ".join(f"{x}s" for x in load)})', file=sys.stderr)
    print('\n'.join(out[k]))
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

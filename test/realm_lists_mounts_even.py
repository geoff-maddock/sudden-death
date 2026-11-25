# Realm lists (issue #117, phase 3): the mounts, the even case. Under a dwarf in a long heat no mount is far ahead (paired
# seeds, a Knight on either side, the dwarves' four against a side of vampires on Destriers, 400 matches a mount): the
# Destrier is best on some seed bases and the Courser or the Charger on others (phase 12's review), so the three are
# asked only to come within 32 matches of each other (they come within 8 to 13 on the seed bases tried). (Split from
# realm_lists_four for time: about 1,200 matches; the other mounts' cases are realm_lists_mounts.)
# Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:900]))
    if not ok: FAILS.append(what)
    return ok

HELP = r"""
window.__T = (ks, r, x) => Object.assign({ name: ks.join(''), short: ks[0].slice(0, 3), roster: ks.map((k, i) => Object.assign({ n: k + i, kind: k }, r ? { r: Object.assign({}, r) } : {})) }, x || {});
window.__run = (n, s0, o) => { const w = [0, 0]; for (let i = 0; i < n; i++) w[wJT.simMatch(Object.assign({ seed: s0 + i }, o)).win]++; return w; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wJT !== 'undefined'")
        await pg.evaluate(HELP)

        # ---------- the mounts: a dwarf in a long heat ----------
        mt = await pg.evaluate("""(() => { const T = k => __T([k, k, k, k]), out = {};
          const run = (k, c, m) => __run(400, 70000, { skill: [1, 1], courses: c, teams: [T(k), T('vampire')], mounts: [[m, m], ['destrier', 'destrier']] })[0];
          for (const [k, c] of __CASES) out[k + c] = { charger: run(k, c, 'charger'), destrier: run(k, c, 'destrier'), courser: run(k, c, 'courser') };
          return out; })()""".replace('__CASES', '[["dwarf", 5]]'))
        for k2, v2 in mt.items(): print(f'   ({k2}: {v2})')
        close = max(mt['dwarf5'].values()) - min(mt['dwarf5'].values())
        check(close <= 32, 'under a dwarf in a long heat no mount is far ahead', [mt['dwarf5'], close])

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

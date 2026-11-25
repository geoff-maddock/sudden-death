# Realm lists (issue #117, phase 3): the mounts, their own cases. On paired seeds (a Knight on either side, a kind's four
# against a side of vampires on Destriers, 400 matches a cell): a Charger is the better pick under an elf's lance in a
# short heat; under a harpy in a long heat a Courser beats a Destrier and does as well as a Charger (it is ahead of the
# Charger on most seed bases tried, behind it by 8 matches on one, so no closer claim is made); the captain picks a
# Charger, a Destrier and a Courser for an elf in a short heat, a dwarf in a long one and a harpy in a long one. (Split
# from realm_lists_four for time: about 2,400 matches; the dwarf's case, no mount far ahead, is realm_lists_mounts_even.)
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

        # ---------- the mounts ----------
        # each mount has a case where it is the better pick (paired seeds, a Knight on either side, against a side of vampires on Destriers)
        mt = await pg.evaluate("""(() => { const T = k => __T([k, k, k, k]), out = {};
          const run = (k, c, m) => __run(400, 70000, { skill: [1, 1], courses: c, teams: [T(k), T('vampire')], mounts: [[m, m], ['destrier', 'destrier']] })[0];
          for (const [k, c] of __CASES) out[k + c] = { charger: run(k, c, 'charger'), destrier: run(k, c, 'destrier'), courser: run(k, c, 'courser') };
          return out; })()""".replace('__CASES', '[["elf", 3], ["harpy", 5]]'))
        for k2, v2 in mt.items(): print(f'   ({k2}: {v2})')
        best = max(mt['elf3'], key=mt['elf3'].get); h = mt['harpy5']
        # (a Charger's case holds on every seed base tried, by 18 to 42 matches; a Courser's under a harpy is thinner: ahead
        # of a Destrier by 25 to 56, and of a Charger by 17 to 46 on two seed bases, behind it by 8 on the third)
        check(best == 'charger', 'a Charger is the better pick under an elf\'s lance in a short heat', mt['elf3'])
        check(h['courser'] > h['destrier'] + 10 and h['courser'] >= h['charger'] - 20, 'under a harpy in a long heat a Courser beats a Destrier and does as well as a Charger', h)
        mf = await pg.evaluate("[['elf', 3], ['dwarf', 5], ['harpy', 5]].map(([k, c]) => wJT.mountFor(wJT.rs(k), c).m)")
        check(mf == ['charger', 'destrier', 'courser'], 'the captain picks those mounts for them (a Destrier for a dwarf in a long heat)', mf)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

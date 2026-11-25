# Realm lists (#120, phase 4): the mounts, the Courser's case. Under a hard rider (a minotaur's four: ride 12) in a long
# heat a Courser is the clear pick, at three seed bases (paired seeds, the minotaurs on each mount against a side of
# vampires on Destriers, a Knight on either side, 400 matches a cell): it is ahead of both the others by 15 matches or
# more at every base (the lab's six bases read 17 to 65; in a short heat 23 to 45, but the captain keeps a Destrier
# there: realm_lists_mounts). (The other mounts' cases and the captain are realm_lists_mounts and
# realm_lists_mounts_destrier; split for time, about 3,600 matches a check, the three seed bases side by side.)
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
// a kind's four on each mount against a side of vampires on Destriers, a Knight on either side, 400 matches a seed base
// (the same seeds for each mount): { base: { charger, destrier, courser } }
window.__case = (k, c, bases) => { const T = kk => __T([kk, kk, kk, kk]), out = {};
  for (const b of bases) { out[b] = {}; for (const m of ['charger', 'destrier', 'courser']) out[b][m] = __run(400, b, { skill: [1, 1], courses: c, teams: [T(k), T('vampire')], mounts: [[m, m], ['destrier', 'destrier']] })[0]; }
  return out; };
0"""
# the seed bases every mount's case is asked at (#120, phase 4)
BASES = [10000, 30000, 70000]
# ahead at every seed base, and by 15 matches in 400 or more over the three together (45 of 1,200): a single base's
# lead varies by about 10 between bases, so asking 15 of each would break on a reshuffle with nothing changed (#120 review)
MARGIN = 15

def ahead(row, m):
    """by how many matches m is ahead of the better of the other two"""
    return row[m] - max(v for k, v in row.items() if k != m)

async def new_page(br, errs):
    pg = await br.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wJT !== 'undefined'")
    await pg.evaluate(HELP)
    return pg

async def open_page(p):
    br = await p.chromium.launch()
    errs = []
    return br, await new_page(br, errs), errs

async def case(br, errs, kind, courses, mount, what):
    # (each seed base in a page of its own, so the three run side by side: each page is its own process)
    async def one(b):
        pg = await new_page(br, errs)
        row = await pg.evaluate(f"__case({json.dumps(kind)}, {courses}, [{b}])[{b}]")
        await pg.close()
        return row
    rows = dict(zip(BASES, await asyncio.gather(*[one(b) for b in BASES])))
    for b, row in rows.items(): print(f'   ({kind}, {courses} courses, seed base {b}: {row}, the {mount} ahead by {ahead(row, mount)})')
    for b, row in rows.items(): check(ahead(row, mount) > 0, f'{what}, ahead at seed base {b}', row)
    tot = sum(ahead(row, mount) for row in rows.values())
    check(tot >= MARGIN * len(rows), f'{what}, by {MARGIN} matches of 400 or more over the {len(rows)} seed bases together ({tot} of {400 * len(rows)})', rows)
    return rows

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br, pg, errs = await open_page(p)

        # ---------- the Courser: a minotaur's hard ride in a long heat ----------
        await case(br, errs, 'minotaur', 5, 'courser', "a Courser is the clear pick under a minotaur's hard ride in a long heat")

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

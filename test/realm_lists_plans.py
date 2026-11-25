# Realm lists (issue #117, phase 2's review): the course is a game, a plan always ridden against a Knight. A Knight
# rides the mix nobody beats by always riding one plan, so no plan always ridden beats it by more than the noise. Each of
# the twelve plans (an aim, a guard and a pace) is ridden all match, 300 seeded matches each. (Split from
# realm_lists_sim for time, about 3,600 matches: against an Archmage is realm_lists_plans_arch; the guards and the read
# realm_lists_policy; your squire's word realm_lists_word.)
# Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wJT !== 'undefined'")

        pol = await pg.evaluate("""(() => { const run = (o, n, s0) => { const w = [0, 0]; for (let i = 0; i < n; i++) w[wJT.simMatch(Object.assign({ seed: s0 + i }, o)).win]++; return w[0] / n; }, N = 300, out = {};
          for (const aim of ['shield', 'body', 'helm']) for (const guard of ['angled', 'square']) for (const pace of ['canter', 'gallop']) { const f = { aim, guard, pace }, k = `${aim}/${guard}/${pace}`;
            out[k] = run({ skill: [1, 1], fix: [f, null] }, N, 40000); }
          return out; })()""")
        print('   (a plan always ridden v a Knight:', pol, ')')
        check(max(pol.values()) <= .56, 'no plan always ridden beats a Knight by more than the noise', pol)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

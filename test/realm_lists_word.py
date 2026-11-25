# Realm lists (issue #117, phase 2's review): your squire's word is the right call by the odds: riding it (with a
# Knight's hands) does as well as a Knight's own plan, against a Knight and an Archmage, 600 seeded matches each.
# (Split from realm_lists_sim for time: about 2,400 matches; the guards and the read are realm_lists_policy.)
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

        pol = await pg.evaluate("""(() => { const run = (o, n, s0) => { const w = [0, 0]; for (let i = 0; i < n; i++) w[wJT.simMatch(Object.assign({ seed: s0 + i }, o)).win]++; return w[0] / n; }, out = {};
          out.word = { k: run({ skill: [1, 1], planBy: ['word', null] }, 600, 44000), a: run({ skill: [1, 2], planBy: ['word', null] }, 600, 44000), kk: run({ skill: [1, 1] }, 600, 44000), ka: run({ skill: [1, 2] }, 600, 44000) };
          return out; })()""")
        print('   (riding your squire\'s word, a Knight\'s hands, v a Knight:', pol['word']['k'], 'v an Archmage:', pol['word']['a'], '; a Knight\'s own plan v them:', pol['word']['kk'], pol['word']['ka'], ')')
        check(pol['word']['k'] >= pol['word']['kk'] - .02 and pol['word']['a'] >= pol['word']['ka'] - .02, 'your squire\'s word is the right call by the odds: riding it does as well as a Knight\'s own plan, against a Knight and an Archmage', pol['word'])

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

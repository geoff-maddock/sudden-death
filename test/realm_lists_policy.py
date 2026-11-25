# Realm lists (issue #117, phase 2's review): the course is a game, the guards and the read. Neither guard always held
# beats a Knight by more than the noise. The guard plays off the aim: angled is far the better guard against a rider who
# aims at the shield, and against one who aims at the body it gains nothing (square does as well; the two are within a
# match or two of each other on every seed base tried, so no closer claim is made). An Archmage's read beats a fixed
# plan by more than a Knight's plan does and loses nothing to a Knight's; a Knight's plan beats a random one. (Split
# from realm_lists_sim for time: about 4,600 seeded matches; your squire's word is realm_lists_word.)
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
          out.gk = { angled: run({ skill: [1, 1], guardBy: ['angled', null] }, 600, 40000), square: run({ skill: [1, 1], guardBy: ['square', null] }, 600, 40000) };
          const sh = { aim: 'shield', guard: 'square', pace: 'canter' }, bd = { aim: 'body', guard: 'square', pace: 'canter' };
          out.vsShield = { angled: run({ skill: [1, 1], guardBy: ['angled', null], fix: [null, sh] }, 400, 41000), square: run({ skill: [1, 1], guardBy: ['square', null], fix: [null, sh] }, 400, 41000) };
          out.vsBody = { angled: run({ skill: [1, 1], guardBy: ['angled', null], fix: [null, bd] }, 400, 41000), square: run({ skill: [1, 1], guardBy: ['square', null], fix: [null, bd] }, 400, 41000) };
          out.read = { arch: run({ skill: [2, 1], handsBy: [1, null], fix: [null, sh] }, 400, 42000), knight: run({ skill: [1, 1], fix: [null, sh] }, 400, 42000) };
          out.aVk = run({ skill: [2, 1], handsBy: [1, null] }, 600, 43000); out.kVr = run({ skill: [1, 1], planBy: [null, 0] }, 400, 9000);
          return out; })()""")
        print('   (a Knight with its guard held v a Knight:', pol['gk'], '; against always the shield:', pol['vsShield'], '; against always the body:', pol['vsBody'], ')')
        print('   (against always the shield, an Archmage\'s plan (a Knight\'s hands):', pol['read']['arch'], 'a Knight\'s:', pol['read']['knight'], '; an Archmage\'s plan v a Knight\'s:', pol['aVk'], '; a Knight\'s v a random one:', pol['kVr'], ')')
        check(max(pol['gk'].values()) <= .55, 'neither guard always held beats a Knight by more than the noise', pol['gk'])
        vs, vb = pol['vsShield'], pol['vsBody']
        check(vs['angled'] > vs['square'] + .15 and vb['square'] >= vb['angled'] - .02 and (vs['angled'] - vs['square']) - (vb['angled'] - vb['square']) > .2,
              'the guard plays off the aim: angled is far the better guard against a rider who aims at the shield, and gains nothing against one who aims at the body', [vs, vb])
        check(pol['read']['arch'] > pol['read']['knight'] + .03 and pol['aVk'] >= .47 and pol['kVr'] >= .55, 'an Archmage\'s read beats a fixed plan by more than a Knight\'s plan does, and loses nothing to a Knight\'s; a Knight\'s plan beats a random one', pol)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

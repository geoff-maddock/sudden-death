# Realm engines (issue #9, phase 0): W_ENGINES lists the engines that play a sport on their own field, with the diamond
# behind it (its view shows it, and every other view hides it, as before). Cinder Gridiron builds in its own scope (wGF)
# and leaves none of its names on the page. Its rules: first and ten from the 25; four downs to make the line to gain;
# first and goal inside the ten; a touchdown is 6 and the other side starts from its 25; a safety is 2 the other way;
# missing on fourth down turns the ball over where it is. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the registry, with the diamond behind it ----------
        r = await pg.evaluate("""(() => { const D = W_ENGINES.diamond;
          showView('diamond'); const shown = wBD.on && UI.view === 'diamond';
          showView('world'); const hidden = !wBD.on;
          return { ids: Object.keys(W_ENGINES), api: D.api === wBD, view: D.view, sport: D.sport, shown, hidden }; })()""")
        check(r == {'ids': ['diamond'], 'api': True, 'view': 'diamond', 'sport': 'baseball', 'shown': True, 'hidden': True},
              'W_ENGINES has the diamond: its view shows it, and another view hides it', r)

        # ---------- the gridiron's scope ----------
        s = await pg.evaluate("""(() => ({ api: typeof wGF === 'object' && typeof wGF.newGame === 'function' && typeof wGF.spot === 'function',
          leaks: ['GF_RULES', 'gfNewGame', 'gfSpot', 'gfGive', 'gfFirstDown'].filter(n => (0, eval)('typeof ' + n) !== 'undefined'), side: wGF.rules.side }))()""")
        check(s['api'] and not s['leaks'] and s['side'] == 7, 'Cinder Gridiron builds in its own scope (wGF), seven a side, and none of its names reach the page', s)

        # ---------- the rules ----------
        d = await pg.evaluate("""(() => { const at = () => { const G = wGF.G; return [G.poss, G.ball, G.down, G.togo]; };
          wGF.newGame(); const start = at();
          const short = [wGF.spot(4), at()], first = [wGF.spot(7), at()];
          wGF.G.ball = 85; const goal = [wGF.spot(10), at()];
          return { start, short, first, goal }; })()""")
        check(d['start'] == [0, 25, 1, 10], 'first and ten from your own 25', d)
        check(d['short'] == ['down', [0, 29, 2, 6]] and d['first'] == ['first', [0, 36, 1, 10]], 'a short gain is the next down; making the line is first and ten again', d)
        check(d['goal'] == ['first', [0, 95, 1, 5]], 'inside the ten it is first and goal', d)
        t = await pg.evaluate("""(() => { const at = () => { const G = wGF.G; return [G.poss, G.ball, G.down, G.togo]; };
          wGF.newGame(); wGF.G.ball = 97; const td = [wGF.spot(5), at(), wGF.G.score.slice()];
          wGF.G.ball = 3; const sf = [wGF.spot(-5), at(), wGF.G.score.slice()];
          wGF.newGame(); const downs = [1, 2, 3, 4].map(() => wGF.spot(1));
          return { td, sf, downs, after: at(), plays: wGF.G.plays }; })()""")
        check(t['td'] == ['td', [1, 25, 1, 10], [6, 0]], 'a touchdown is 6, and the other side starts from its 25', t)
        check(t['sf'] == ['safety', [0, 25, 1, 10], [8, 0]], 'a safety is 2 for the defense, which then gets the ball', t)
        check(t['downs'] == ['down', 'down', 'down', 'turnover'] and t['after'] == [1, 71, 1, 10] and t['plays'] == 4,
              'four downs short of the line: the ball turns over where it is', t)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

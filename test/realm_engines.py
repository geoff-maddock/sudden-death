# Realm engines (issue #9, phase 0): W_ENGINES lists the engines that play a sport on their own field (the diamond and
# the gridiron), with the diamond behind it (its view shows it, and every other view hides it, as before). Cinder Gridiron builds in its own scope (wGF)
# and leaves none of its names on the page. Its rules: first and ten from the 25; four downs to make the line to gain;
# first and goal inside the ten; a touchdown is 6 and the other side starts from its 25; a safety is 2 the other way;
# missing on fourth down turns the ball over where it is.
# The Anvil Ring (issue #23, phase 0) builds in its own scope too (wBX). Its rules: three rounds; three judges score each
# round 10-9 (10-10 when even); a knockdown decides the round by the pro rule (10-8 for one, or 10-9 when the fighter who
# went down was winning it on work; a point more for each knockdown more); three knockdowns stop the bout, and failing to beat the count is a knockout; the decision is
# unanimous, split or majority, or a draw; a card of bouts goes to the side with more bouts won, then more knockdowns
# scored, then more points. Asserts; exits nonzero on failure.
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
        check(r == {'ids': ['diamond', 'gridiron', 'ring'], 'api': True, 'view': 'diamond', 'sport': 'baseball', 'shown': True, 'hidden': True},
              'W_ENGINES has the diamond, the gridiron and the ring: the diamond\'s view shows it, and another view hides it', r)
        rg = await pg.evaluate("({ api: W_ENGINES.ring.api === wBX, view: W_ENGINES.ring.view, sport: W_ENGINES.ring.sport })")
        check(rg == {'api': True, 'view': 'ring', 'sport': 'boxing'}, 'the ring is boxing, in the ring view', rg)

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

        # ---------- the ring's scope and rules ----------
        s = await pg.evaluate("""(() => ({ api: typeof wBX === 'object' && typeof wBX.newBout === 'function' && typeof wBX.bell === 'function',
          leaks: ['BX_RULES', 'bxNewBout', 'bxKnockdown', 'bxBell', 'bxDecision', 'bxCardResult', 'bxRoundScore'].filter(n => (0, eval)('typeof ' + n) !== 'undefined'), r: wBX.rules }))()""")
        check(s['api'] and not s['leaks'] and s['r']['rounds'] == 3 and s['r']['judges'] == 3 and s['r']['card'] == 3 and s['r']['kd'] == 3,
              'the Anvil Ring builds in its own scope (wBX): three rounds, three judges, three bouts a card, three knockdowns stop it; none of its names reach the page', s)
        sc = await pg.evaluate("""(() => { wBX.newBout();
          return { work: wBX.roundScore([2, -3, 0.05], [0, 0]), kdLost: wBX.roundScore([-2], [1, 0]), kdWon: wBX.roundScore([2], [1, 0]), kdEven: wBX.roundScore([0], [0, 1]),
            two: wBX.roundScore([-1], [2, 0]), both: wBX.roundScore([3], [1, 1]) }; })()""")
        check(sc['work'] == [[10, 9], [9, 10], [10, 10]], 'a round goes 10-9 to whoever did more, and 10-10 when it is even', sc)
        check(sc['kdLost'] == [[8, 10]] and sc['kdEven'] == [[10, 8]] and sc['kdWon'] == [[9, 10]], 'a knockdown decides the round by the pro rule: 10-8, or 10-9 when the fighter who went down was winning it', sc)
        check(sc['two'] == [[7, 10]] and sc['both'] == [[10, 9]], 'each knockdown more is a point more; a knockdown each leaves the round to the work', sc)
        bt = await pg.evaluate("""(() => { const G = wBX.newBout();
          const r1 = wBX.bell([1, 1, -1]), r2 = wBX.bell([1, -1, -1]), last = wBX.bell([2, 2, 2]);
          const dec = Object.assign({}, G.over), totals = wBX.totals();
          wBX.newBout(); const k1 = wBX.knockdown(1), k2 = wBX.knockdown(1), k3 = wBX.knockdown(1), tko = Object.assign({}, wBX.G.over), after = wBX.knockdown(0);
          wBX.newBout(); wBX.bell([1, 1, 1]); const ko = [wBX.countOut(0), Object.assign({}, wBX.G.over)];
          return { r: [r1, r2, last], dec, totals, rounds: G.round, kd: [k1, k2, k3, after], tko, ko }; })()""")
        check(bt['r'] == ['round', 'round', 'over'] and bt['rounds'] == 3, 'the bell ends a round; after the third the bout goes to the cards', bt)
        check(bt['totals'] == [[30, 27], [29, 28], [28, 29]] and bt['dec']['how'] == 'dec' and bt['dec']['win'] == 0 and bt['dec']['kind'] == 'split',
              'two judges of three is a split decision', bt)
        check(bt['kd'] == ['kd', 'kd', 'tko', None] and bt['tko']['how'] == 'tko' and bt['tko']['win'] == 0 and bt['tko']['kd'] == [0, 3],
              'the third knockdown stops the bout (a TKO), and nothing happens after it', bt)
        check(bt['ko'][0] == 'ko' and bt['ko'][1]['how'] == 'ko' and bt['ko'][1]['win'] == 1 and bt['ko'][1]['round'] == 2 and bt['ko'][1]['pts'] == [30, 27],
              'failing to beat the count is a knockout, in the round it happened, with the points scored so far', bt)
        dk = await pg.evaluate("""(() => ({ un: wBX.decision([[[10, 9], [10, 9], [10, 9]]]), maj: wBX.decision([[[10, 9], [10, 9], [10, 10]]]),
          draw: wBX.decision([[[10, 9], [9, 10], [10, 10]]]), even: wBX.decision([[[10, 10], [10, 10], [10, 10]]]) }))()""")
        check(dk['un'] == {'how': 'dec', 'win': 0, 'kind': 'unanimous'} and dk['maj'] == {'how': 'dec', 'win': 0, 'kind': 'majority'}
              and dk['draw']['win'] is None and dk['even'] == {'how': 'dec', 'win': None, 'kind': 'draw'}, 'unanimous, majority, and a draw when no fighter has two judges', dk)
        cr = await pg.evaluate("""(() => ({ bouts: wBX.cardResult([{ win: 0, kd: [0, 0], pts: [30, 27] }, { win: 1, kd: [1, 0], pts: [27, 30] }, { win: 0, kd: [0, 0], pts: [29, 28] }]),
          kds: wBX.cardResult([{ win: 0, kd: [0, 0], pts: [30, 27] }, { win: 1, kd: [2, 0], pts: [26, 30] }, { win: null, kd: [0, 0], pts: [28, 28] }]),
          pts: wBX.cardResult([{ win: 0, kd: [0, 0], pts: [29, 28] }, { win: 1, kd: [0, 0], pts: [27, 30] }, { win: null, kd: [1, 1], pts: [28, 28] }]),
          draw: wBX.cardResult([{ win: 0, kd: [0, 0], pts: [29, 28] }, { win: 1, kd: [0, 0], pts: [28, 29] }, { win: null, kd: [0, 0], pts: [28, 28] }]) }))()""")
        check(cr['bouts']['win'] == 0 and cr['bouts']['by'] == 'bouts' and cr['bouts']['won'] == [2, 1], 'a card goes to the side that wins more bouts', cr)
        check(cr['kds']['win'] == 1 and cr['kds']['by'] == 'knockdowns' and cr['kds']['kd'] == [0, 2], 'level on bouts: more knockdowns scored wins it', cr)
        check(cr['pts']['win'] == 1 and cr['pts']['by'] == 'points' and cr['pts']['pts'] == [84, 86], 'level on knockdowns too: more points on the cards', cr)
        check(cr['draw']['win'] is None and cr['draw']['by'] == 'draw', 'level on everything, the card is a draw', cr)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

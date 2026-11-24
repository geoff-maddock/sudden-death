# Realm engines (issue #9, phase 0): W_ENGINES lists the engines that play a sport on their own field (the diamond and
# the gridiron), with the diamond behind it (its view shows it, and every other view hides it, as before). Cinder Gridiron builds in its own scope (wGF)
# and leaves none of its names on the page. Its rules: first and ten from the 25; four downs to make the line to gain;
# first and goal inside the ten; a touchdown is 6 and the other side starts from its 25; a safety is 2 the other way;
# missing on fourth down turns the ball over where it is.
# The Anvil Ring (issue #23, phase 0) builds in its own scope too (wBX). Its rules: three rounds; three judges score each
# round 10-9 (10-10 when even); a knockdown decides the round by the pro rule (10-8 for one, or 10-9 when the fighter who
# went down was winning it on work; a point more for each knockdown more); three knockdowns stop the bout, and failing to beat the count is a knockout; the decision is
# unanimous, split or majority, or a draw; a card of bouts goes to the side with more bouts won, then more knockdowns
# scored, then more points.
# Black Ice at the Pond Rink (issue #83, phase 0) builds in its own scope too (wHK), five skaters and a goalie. Its rules:
# a game of 6 minutes by default (3, 6, 9 or 12) in three periods; a minor is a sixth of a period and leaves a side a
# skater short, never below three (a third penalty waits); a goal against a short-handed side ends its earliest penalty;
# icing counts from a side's own half and never against a short-handed side; the sides swap ends each period; level
# after three is sudden death at three a side for half a period, then a shootout that gives the winner one goal.
# The Charter Court (issue #77, phase 0) builds in its own scope too (wBK), five a side. Its rules: a game of 5 minutes by
# default (3, 5, 8 or 12), four quarters; a 14-second shot clock that runs out into a turnover, holds while a shot is up
# and is off when the period has less left; 2 inside the arc and 3 beyond it; a shooting foul is two free throws, three
# on a three, one on an and-one; past four team fouls in a quarter every foul is two; five personal fouls and a player
# is out, or, with nobody to come in, stays on and gives a free throw more for every foul after; team fouls start again
# each quarter; the ball after a break goes by the arrow; the sides swap ends at halftime; level after four quarters is
# overtime, up to three, then a tie. Asserts; exits nonzero on failure.
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
        check(r == {'ids': ['diamond', 'gridiron', 'ring', 'court', 'rink', 'links', 'lanes', 'shed', 'lists'], 'api': True, 'view': 'diamond', 'sport': 'baseball', 'shown': True, 'hidden': True},
              'W_ENGINES has the diamond, the gridiron, the ring, the court, the rink, the links, the lanes, the shed and the lists: the diamond\'s view shows it, and another view hides it', r)
        rk = await pg.evaluate("({ api: W_ENGINES.rink.api === wHK, view: W_ENGINES.rink.view, sport: W_ENGINES.rink.sport })")
        check(rk == {'api': True, 'view': 'rink', 'sport': 'hockey'}, 'the rink is hockey, in the rink view', rk)
        ct = await pg.evaluate("({ api: W_ENGINES.court.api === wBK, view: W_ENGINES.court.view, sport: W_ENGINES.court.sport })")
        check(ct == {'api': True, 'view': 'court', 'sport': 'basketball'}, 'the court is basketball, in the court view', ct)
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

        # ---------- the court's scope and rules ----------
        s = await pg.evaluate("""(() => ({ api: typeof wBK === 'object' && typeof wBK.newGame === 'function' && typeof wBK.foul === 'function',
          leaks: ['BK_RULES', 'bkNewGame', 'bkScore', 'bkFoul', 'bkRun', 'bkPeriodEnd', 'bkShotValue', 'bkDir', 'BK_KIND', 'bkTick', 'bkDraw', 'L', 'GD', 'BKP', 'BKT'].filter(n => (0, eval)('typeof ' + n) !== 'undefined'), r: wBK.rules }))()""")
        check(s['api'] and not s['leaks'] and s['r']['side'] == 5 and s['r']['shot'] == 14 and s['r']['mins'] == 5 and s['r']['quarters'] == 4 and s['r']['minsAt'] == [3, 5, 8, 12],
              'the Charter Court builds in its own scope (wBK): five a side, a 14-second shot clock, 5 minutes in four quarters by default; none of its names reach the page', s)
        g = await pg.evaluate("""(() => { const G = wBK.newGame(); const d = { q: G.q, clock: G.clock, shot: G.shot, score: G.score.slice() };
          const lens = [3, 5, 8, 12, 7].map(m => wBK.newGame({ mins: m }).qlen);
          return { d, lens, two: wBK.shotValue(6.7, 2), three: wBK.shotValue(6.75), far: wBK.shotValue(9), corner: wBK.shotValue(6.7, 6.6), inCorner: wBK.shotValue(6.7, 6.5) }; })()""")
        check(g['d'] == {'q': 1, 'clock': 75, 'shot': 14, 'score': [0, 0]}, 'a game starts in the first quarter, 1:15 on the clock (5 minutes over four), 14 on the shot clock, 0 to 0', g)
        check(g['lens'] == [45, 75, 120, 180, 75], 'the length is 3, 5, 8 or 12 minutes, four quarters of a quarter of it; anything else is 5', g)
        check([g['two'], g['three'], g['far'], g['corner'], g['inCorner']] == [2, 3, 3, 3, 2], 'a basket is 2 inside the arc and 3 from 6.75 metres out, or from 6.6 metres out from the middle in the corners', g)
        c = await pg.evaluate("""(() => { const G = wBK.newGame({ poss: 0 });
          const a = [wBK.run(5), G.shot, G.clock]; const hold = [wBK.run(3, true), G.shot, G.clock];
          G.shot = 0.5; const viol = wBK.run(1); wBK.violation(); const after = [G.poss, G.shot];
          G.clock = 6; G.shot = 9; const off = [wBK.run(2), G.shot]; G.shot = 9; const end = wBK.run(10);
          return { a, hold, viol, after, off, end, clock: G.clock }; })()""")
        check(c['a'] == ['', 9, 70] and c['hold'] == ['', 9, 67], 'both clocks run; the shot clock holds while a shot is up or the ball is loose', c)
        check(c['viol'] == 'shot' and c['after'] == [1, 14], 'the shot clock running out turns the ball over, on a full shot clock', c)
        check(c['off'] == ['', 9] and c['end'] == 'end' and c['clock'] == 0, 'with less left in the period than on the shot clock, the shot clock is off; the period ends at 0', c)
        f = await pg.evaluate("""(() => { wBK.newGame();
          const two = wBK.foul(1, 0, { shooting: true }), three = wBK.foul(1, 1, { shooting: true, three: true }), and1 = wBK.foul(1, 2, { shooting: true, made: true, three: true });
          const reach = wBK.foul(1, 3, {}), bonus = wBK.foul(1, 3, {});
          return { two: two.shots, three: three.shots, and1: and1.shots, reach: [reach.shots, reach.bonus, reach.tf], bonus: [bonus.shots, bonus.bonus, bonus.tf] }; })()""")
        check([f['two'], f['three'], f['and1']] == [2, 3, 1], 'a shooting foul is two free throws, three on a three-point try, one if it went in (and one)', f)
        check(f['reach'] == [0, False, 4] and f['bonus'] == [2, True, 5], 'away from the shot a foul gives nothing until the bonus: past four team fouls in a quarter it is two', f)
        o = await pg.evaluate("""(() => { const G = wBK.newGame(); const r = [];
          for (let i = 0; i < 5; i++) r.push(wBK.foul(0, 2, { benchLeft: 2 }));
          wBK.newGame(); const s = [];
          for (let i = 0; i < 7; i++) s.push(wBK.foul(0, 2, { benchLeft: 0 }));
          return { out: r.map(x => x.out), stay: s.map(x => [x.out, x.extra, x.shots]) }; })()""")
        check(o['out'] == [False, False, False, False, True], 'the fifth personal foul puts a player out when someone can come in', o)
        check([x[0] for x in o['stay']] == [False] * 7 and [x[1] for x in o['stay']] == [False] * 5 + [True, True] and o['stay'][5][2] == 3 and o['stay'][6][2] == 3,
              'with nobody to come in they stay on, and every foul after the fifth gives one free throw more (two in the bonus, plus one)', o)
        q = await pg.evaluate("""(() => { const G = wBK.newGame({ poss: 0 }); G.arrow = 1; const dir = [wBK.dir(0), wBK.dir(1)];
          G.tf = [3, 5]; const r1 = wBK.periodEnd(); const a1 = [G.q, G.tf.slice(), G.poss, G.clock];
          const r2 = wBK.periodEnd(); const half = [G.q, wBK.dir(0), wBK.dir(1), G.poss, wBK.periodName(G.q)];
          wBK.periodEnd(); G.score = [20, 20]; const ot = [wBK.periodEnd(), G.q, G.clock, wBK.periodName(G.q)];
          G.score = [22, 20]; const over = [wBK.periodEnd(), Object.assign({}, G.over)];
          const H = wBK.newGame(); H.q = 4; H.score = [9, 9]; const ots = [wBK.periodEnd(), wBK.periodEnd(), wBK.periodEnd(), wBK.periodEnd(), H.over ? H.over.win : 'x', H.over ? H.over.ot : -1];
          return { dir, r1, a1, r2, half, ot, over, ots }; })()""")
        check(q['dir'] == [1, -1] and q['r1'] == 'quarter' and q['a1'] == [2, [0, 0], 1, 75], 'a quarter ends: team fouls start again, the ball goes by the arrow, the clock is full', q)
        check(q['r2'] == 'half' and q['half'] == [3, -1, 1, 0, '3rd'], 'at halftime the sides swap ends, and the arrow has swapped', q)
        check(q['ot'] == ['ot', 5, 30, 'OT'] and q['over'][0] == 'over' and q['over'][1] == {'win': 0, 'score': [22, 20], 'ot': 1},
              'level after the fourth is a 30-second overtime; ahead at the end of it wins', q)
        check(q['ots'] == ['ot', 'ot', 'ot', 'over', None, 3], 'still level after three overtimes, the game is a tie', q)

        # ---------- the rink's scope and rules ----------
        s = await pg.evaluate("""(() => ({ api: typeof wHK === 'object' && typeof wHK.newGame === 'function' && typeof wHK.penalty === 'function',
          leaks: ['HK_RULES', 'hkNewGame', 'hkGoal', 'hkPenalty', 'hkRun', 'hkPeriodEnd', 'hkStrength', 'hkDir', 'HK_KIND', 'hkTick', 'hkDraw', 'HKP', 'HKT', 'hkSoShot'].filter(n => (0, eval)('typeof ' + n) !== 'undefined'), r: wHK.rules }))()""")
        check(s['api'] and not s['leaks'] and s['r']['skaters'] == 5 and s['r']['side'] == 6 and s['r']['mins'] == 6 and s['r']['periods'] == 3 and s['r']['minsAt'] == [3, 6, 9, 12],
              'Black Ice builds in its own scope (wHK): five skaters and a goalie, 6 minutes in three periods by default; none of its names reach the page', s)
        g = await pg.evaluate("""(() => { const G = wHK.newGame(); const d = { p: G.p, clock: G.clock, score: G.score.slice(), minor: wHK.minor(), str: wHK.strength() };
          const lens = [3, 6, 9, 12, 7].map(m => wHK.newGame({ mins: m }).plen); const H = wHK.newGame();
          const a = [wHK.run(5).end, H.clock]; H.clock = .5; const end = [wHK.run(1).end, H.clock];
          return { d, lens, a, end }; })()""")
        check(g['d'] == {'p': 1, 'clock': 120, 'score': [0, 0], 'minor': 20, 'str': [5, 5]} and g['lens'] == [60, 120, 180, 240, 120] and g['a'] == [False, 115] and g['end'] == [True, 0],
              'a hockey game is three periods of a third of its length (6 minutes unless it is 3, 9 or 12); a minor is a sixth of a period; the clock runs down to the end of the period', g)
        pn = await pg.evaluate("""(() => { const G = wHK.newGame(); const a = wHK.penalty(0, 2, 'trip'); const one = { t: a.t, waits: a.waits, str: wHK.strength(), short: [wHK.short(0), wHK.short(1)] };
          const ice = [wHK.icingOn(0, 10), wHK.icingOn(1, 30), wHK.icingOn(1, 10)];
          wHK.run(5); wHK.penalty(0, 3); const c = wHK.penalty(0, 4); const three = { waits: c.waits, str: wHK.strength(), box: G.box.length, wait: G.wait.length };
          const r1 = wHK.run(15); const after1 = { out: r1.out.map(e => e.ri), str: wHK.strength(), box: G.box.map(e => [e.ri, Math.round(e.t)]), wait: G.wait.length };
          const r2 = wHK.run(5); const after2 = { out: r2.out.map(e => e.ri), str: wHK.strength(), box: G.box.map(e => [e.ri, Math.round(e.t)]) };
          return { one, ice, three, after1, after2 }; })()""")
        check(pn['one'] == {'t': 20, 'waits': False, 'str': [4, 5], 'short': [True, False]}, 'a penalty puts a side a skater short for the length of a minor', pn)
        check(pn['ice'] == [False, True, False], 'icing counts from a side\'s own half only, and never against a side that is short-handed', pn)
        check(pn['three'] == {'waits': True, 'str': [3, 5], 'box': 2, 'wait': 1}, 'a side is never below three skaters: a third penalty waits its turn', pn)
        check(pn['after1'] == {'out': [2], 'str': [3, 5], 'box': [[3, 5], [4, 20]], 'wait': 0} and pn['after2'] == {'out': [3], 'str': [4, 5], 'box': [[4, 15]]},
              'when a penalty runs out the player comes back, and the one that was waiting starts', pn)
        gl = await pg.evaluate("""(() => { let G = wHK.newGame(); wHK.penalty(1, 0); const pp = wHK.goal(0); const a = { score: G.score.slice(), freed: pp.freed && pp.freed.ri, str: wHK.strength(), over: pp.over };
          G = wHK.newGame(); wHK.penalty(1, 0); const sh = wHK.goal(1); const b = { score: G.score.slice(), freed: sh.freed, str: wHK.strength() };
          G = wHK.newGame(); wHK.penalty(0, 1); wHK.penalty(1, 1); const ev = wHK.goal(0); const c = { freed: ev.freed, str: wHK.strength() };
          return { a, b, c }; })()""")
        check(gl['a'] == {'score': [1, 0], 'freed': 0, 'str': [5, 5], 'over': False} and gl['b'] == {'score': [0, 1], 'freed': None, 'str': [5, 4]} and gl['c'] == {'freed': None, 'str': [4, 4]},
              'a goal against a short-handed side ends its earliest penalty; a goal by the short side, or with the sides even, ends none', gl)
        pe = await pg.evaluate("""(() => { let G = wHK.newGame(); const d1 = [wHK.dir(0), wHK.dir(1), wHK.goalX(0), wHK.goalX(1), wHK.up(0, 10), wHK.up(1, 10)];
          const r1 = wHK.periodEnd(); const p2 = [r1, G.p, G.clock, wHK.dir(0), wHK.dir(1)]; const r2 = wHK.periodEnd();
          G.score = [2, 2]; const r3 = wHK.periodEnd(); const ot = [r2, r3, G.p, G.clock, wHK.periodName(G.p), wHK.strength()];
          wHK.penalty(0, 1); const otpen = wHK.strength(); const w = wHK.goal(1); const sudden = [w.over, Object.assign({}, G.over)];
          G = wHK.newGame(); G.p = 3; G.score = [3, 1]; const reg = [wHK.periodEnd(), Object.assign({}, G.over)];
          G = wHK.newGame(); G.p = 4; G.score = [1, 1]; const so = [wHK.periodEnd(), G.so.tries.slice(), wHK.soTurn()];
          const tries = [wHK.soShot(0, true), wHK.soTurn(), wHK.soShot(1, false), wHK.soShot(0, true), wHK.soShot(1, false)]; const soOver = Object.assign({}, G.over);
          G = wHK.newGame(); G.p = 4; G.score = [0, 0]; wHK.periodEnd(); const long = [];
          for (let i = 0; i < 3; i++) { long.push(wHK.soShot(0, false)); long.push(wHK.soShot(1, false)); } long.push(wHK.soShot(0, false)); long.push(wHK.soShot(1, true));
          return { d1, p2, ot, otpen, sudden, reg, so, tries, soOver, long, longOver: Object.assign({}, G.over) }; })()""")
        check(pe['d1'] == [1, -1, 37, 3, 10, 30] and pe['p2'] == ['period', 2, 120, -1, 1], 'the sides attack opposite goals, and swap ends each period', pe)
        check(pe['ot'] == ['period', 'ot', 4, 60, 'OT', [3, 3]] and pe['otpen'] == [3, 4] and pe['sudden'] == [True, {'win': 1, 'score': [2, 3], 'ot': 1, 'so': False}],
              'level after three periods is sudden death, half a period at three skaters a side (a penalty there gives the other side a fourth), and the next goal wins', pe)
        check(pe['reg'] == ['over', {'win': 0, 'score': [3, 1], 'ot': 0, 'so': False}], 'ahead after three periods wins', pe)
        check(pe['so'] == ['shootout', [0, 0], 0] and pe['tries'] == [None, 1, None, None, 0] and pe['soOver'] == {'win': 0, 'score': [2, 1], 'ot': 1, 'so': True},
              'still level after sudden death is a shootout, taken in turns: it ends as soon as one side can\'t be caught, and the winner gets one goal', pe)
        check(pe['long'] == [None] * 7 + [1] and pe['longOver']['score'] == [0, 1], 'level after three tries each, the shootout goes on a round at a time until one scores and the other doesn\'t', pe)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

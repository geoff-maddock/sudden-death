# Realm links (issue #92, phase 0): Mossgate Links, the golf engine, builds in its own scope (wGL) behind W_ENGINES, and
# its rules are pure functions.
# The hitter rule: the first four shots of a hole are four different players, in the order the side picks; after that,
# anyone but the player who hit last; a refused stroke says why and changes nothing. Who is away: on the tee the side
# with the honour, then the side that hasn't hit, then the ball farther from the hole (level: the honour), and never a
# side that is done. A penalty drop is a stroke with no hitter; a ball is picked up at par + 4. A hole is won in fewer
# strokes or halved, and ends as soon as it is decided (one side holed and the other already on as many); a conceded
# putt is holed in one more stroke. The honour goes to the side that won the last hole and stays on a half.
# Match play: "3 and 2" once a side is more up than there are holes left, "1 up" at the last, Dormie, All square; level
# after the last hole, a playoff round the course again from the 1st, until a side wins a hole ("won at the 11th").
# The game is plain JSON. None of the engine's names reach the page.
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

# play the current hole: side 0 takes a strokes and side 1 takes b (the last of each is the putt that drops); the side
# with more strokes left is the one farther away. Returns what the last call said
HELP = r"""
window.__hole = (a, b) => { const left = () => [a - wGL.G.hole.st[0], b - wGL.G.hole.st[1]]; let r = null, n = 0;
  while (n++ < 40) { const h0 = wGL.G.res.length, s = wGL.away(left()); if (s < 0) break;
    const ri = wGL.hitters(s)[0]; wGL.stroke(s, ri); if (wGL.G.hole.st[s] >= (s ? b : a)) { r = wGL.holed(s); if (wGL.G.res.length > h0) break; } }
  return r; };
// play holes from a list of [a, b]
window.__holes = list => { let r = null; for (const [a, b] of list) { if (wGL.G.over) break; r = window.__hole(a, b); } return r; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGL !== 'undefined' && typeof W_ENGINES !== 'undefined'")
        await pg.evaluate(HELP)

        # ---------- the scope ----------
        s = await pg.evaluate("""(() => ({ api: typeof wGL === 'object' && typeof wGL.newGame === 'function' && typeof wGL.stroke === 'function',
          leaks: ['GL_RULES', 'glNewGame', 'glStroke', 'glDrop', 'glHoled', 'glConcede', 'glAway', 'glHitters', 'glCanHit', 'glDecide', 'glMatchCheck', 'glMatchText', 'glHoleState', 'glPars'].filter(n => (0, eval)('typeof ' + n) !== 'undefined'),
          eng: { api: W_ENGINES.links.api === wGL, view: W_ENGINES.links.view, sport: W_ENGINES.links.sport, on: wGL.on }, r: wGL.rules }))()""")
        check(s['api'] and not s['leaks'], 'Mossgate Links builds in its own scope (wGL); none of its names reach the page', s)
        check(s['eng'] == {'api': True, 'view': 'links', 'sport': 'golf', 'on': False}, 'W_ENGINES.links is golf, in the links view, and off', s['eng'])
        check(s['r']['side'] == 4 and s['r']['holes'] == 9 and s['r']['holesAt'] == [3, 6, 9, 18] and s['r']['cap'] == 4, 'four a side, 9 holes by default (3, 6, 9 or 18), picked up at par + 4', s['r'])

        # ---------- a new game ----------
        g = await pg.evaluate("""(() => { const G = wGL.newGame(); const d = { holes: G.holes, pars: G.pars.slice(), h: G.h, par: G.hole.par, honour: G.honour, over: G.over, no: wGL.holeNo() };
          const n = [3, 6, 9, 18, 7].map(k => wGL.newGame({ holes: k }).holes), p18 = wGL.newGame({ holes: 18 }).pars;
          const own = wGL.newGame({ holes: 3, pars: [3, 4, 5], honour: 1 }), bad = wGL.newGame({ holes: 3, pars: [3, 9, 5] }).pars;
          return { d, n, p18: [p18.length, p18[9] === p18[0], p18[17] === p18[8]], own: [own.pars, own.honour], bad }; })()""")
        check(g['d'] == {'holes': 9, 'pars': [4, 3, 5, 4, 4, 3, 4, 5, 4], 'h': 0, 'par': 4, 'honour': 0, 'over': None, 'no': 1}, 'a new game is the standing nine (par 36), on the 1st, side 0 with the honour', g['d'])
        check(g['n'] == [3, 6, 9, 18, 9] and g['p18'] == [18, True, True], 'a game is 3, 6, 9 or 18 holes (anything else is 9); eighteen plays the nine twice', g)
        check(g['own'] == [[3, 4, 5], 1] and g['bad'] == [4, 3, 5], 'a game can bring its own pars and honour; a par outside 3 to 5 is refused', g)

        # ---------- who may hit ----------
        h = await pg.evaluate("""(() => { wGL.newGame(); const out = { start: wGL.hitters(0) };
          out.a = wGL.stroke(0, 2).ok; out.after1 = wGL.hitters(0);
          const again = wGL.stroke(0, 2); out.again = [again.ok, again.why, wGL.G.hole.st[0]];
          wGL.stroke(0, 0); wGL.stroke(0, 3); out.after3 = wGL.hitters(0);
          const early = wGL.stroke(0, 0); out.early = [early.ok, early.why];
          wGL.stroke(0, 1); out.after4 = wGL.hitters(0); out.other = wGL.hitters(1); out.order = wGL.G.hole.hit[0].slice();
          wGL.stroke(0, 0); out.after5 = wGL.hitters(0);
          return out; })()""")
        check(h['start'] == [0, 1, 2, 3] and h['after1'] == [0, 1, 3] and h['after3'] == [1], 'the first four shots of a hole are four different players, in the order the side picks', h)
        check(h['again'][0] is False and 'twice running' in h['again'][1] and h['again'][2] == 1, 'nobody hits twice running: the stroke is refused, says why, and is not counted', h['again'])
        check(h['early'][0] is False and 'Everyone hits once' in h['early'][1], 'nobody hits twice before everyone has hit once', h['early'])
        check(h['order'] == [2, 0, 3, 1] and h['after4'] == [0, 2, 3] and h['after5'] == [1, 2, 3] and h['other'] == [0, 1, 2, 3], 'after four, anyone but the player who hit last; the other side picks its own', h)

        # ---------- who is away ----------
        a = await pg.evaluate("""(() => { const out = {}; wGL.newGame({ honour: 1 });
          out.tee = wGL.away([400, 400]); wGL.stroke(1, 0); out.second = wGL.away([400, 150]); wGL.stroke(0, 0);
          out.far0 = wGL.away([180, 150]); out.far1 = wGL.away([100, 150]); out.level = wGL.away([90, 90]);
          wGL.stroke(1, 1); wGL.holed(1); out.done = wGL.away([0, 300]);
          return out; })()""")
        check(a == {'tee': 1, 'second': 0, 'far0': 0, 'far1': 1, 'level': 1, 'done': 0}, 'away: the honour on the tee, then the side yet to hit, then the farther ball (level: the honour), never a side that is done', a)

        # ---------- strokes, drops and the pickup ----------
        d = await pg.evaluate("""(() => { wGL.newGame({ pars: [3, 3, 3, 3, 3, 3, 3, 3, 3] });
          wGL.stroke(0, 0); const dr = wGL.drop(0); const st = wGL.G.hole.st[0], hit = wGL.G.hole.hit[0].length;
          wGL.stroke(0, 1); wGL.stroke(0, 2); wGL.drop(0); wGL.drop(0); const before = [wGL.G.hole.st[0], wGL.G.hole.done[0]];
          const last = wGL.stroke(0, 3); const after = [wGL.G.hole.st[0], wGL.G.hole.done[0], wGL.G.hole.up[0], last.picked];
          const more = wGL.stroke(0, 0).ok;
          return { dr: dr.ok, st, hit, before, after, more }; })()""")
        check(d['dr'] and d['st'] == 2 and d['hit'] == 1, 'a penalty drop is a stroke with no hitter', d)
        check(d['before'] == [6, False] and d['after'] == [7, True, True, True] and d['more'] is False, 'a ball is picked up at par + 4 (7 on a par 3), and that side plays no more of the hole', d)

        # ---------- holes decided ----------
        hd = await pg.evaluate("""(() => { const out = {}; wGL.newGame();
          let r = __hole(4, 5); out.won = [r.end, r.res, wGL.G.won.slice(), wGL.G.honour, wGL.G.h, wGL.G.hole.st.slice()];
          r = __hole(3, 3); out.half = [r.res, wGL.G.won.slice(), wGL.G.honour];
          r = __hole(6, 5); out.won1 = [r.res, wGL.G.honour];
          r = __hole(4, 4); out.keep = wGL.G.honour;
          // early: side 1 holes in 3 while side 0 is on 3 and still out; side 0 can only take 4: the hole is over
          wGL.newGame(); wGL.stroke(0, 0); wGL.stroke(1, 0); wGL.stroke(1, 1); wGL.stroke(0, 1); wGL.stroke(0, 2); wGL.stroke(1, 2);
          r = wGL.holed(1); out.early = [r.end, r.res, wGL.G.res.slice()];
          // not over while the other could still halve
          wGL.newGame(); wGL.stroke(0, 0); wGL.stroke(1, 0); wGL.stroke(1, 1); wGL.stroke(1, 2); wGL.stroke(0, 1);
          r = wGL.holed(1); out.open = [r.end, wGL.G.res.length]; wGL.stroke(0, 2); r = wGL.holed(0); out.halved = [r.end, r.res];
          // a conceded putt: holed in one more stroke
          wGL.newGame(); wGL.stroke(0, 0); wGL.stroke(1, 0); wGL.stroke(0, 1); wGL.stroke(1, 1); wGL.stroke(1, 2); wGL.holed(1);
          const st0 = wGL.G.hole.st[0]; r = wGL.concede(1); out.concede = [st0, r.end, r.res, wGL.G.res.slice()];
          return out; })()""")
        check(hd['won'] == [True, 0, [1, 0], 0, 1, [0, 0]], 'fewer strokes wins the hole: the result, the honour, and the next hole fresh', hd['won'])
        check(hd['half'] == [-1, [1, 0], 0] and hd['won1'] == [1, 1] and hd['keep'] == 1, 'a level hole is halved and the honour stays; it moves to the side that wins a hole', hd)
        check(hd['early'] == [True, 1, [1]], 'the hole ends once decided: holed in 3 against a ball already on 3 wins it there', hd['early'])
        check(hd['open'] == [False, 0] and hd['halved'] == [True, -1], 'it stays open while the other side can still halve it', hd)
        check(hd['concede'] == [2, True, -1, [-1]], 'a conceded putt counts as holed in one more stroke', hd['concede'])

        # ---------- the match ----------
        m = await pg.evaluate("""(() => { const out = {}; wGL.newGame();
          __holes([[4, 5], [3, 4], [4, 5]]); out.three = [wGL.up(), wGL.left(), wGL.matchText(0), wGL.matchText(1)];
          __holes([[4, 4], [4, 4], [5, 5]]); out.dormie = [wGL.matchText(0), wGL.matchText(1)];
          __holes([[4, 4]]); out.win = [wGL.G.over, wGL.matchText(0), wGL.matchText(1), wGL.G.res.length];
          out.after = [wGL.stroke(0, 0).ok, wGL.away([10, 10]), wGL.hitters(0)];
          wGL.newGame(); __holes([[4, 4], [3, 3], [5, 5], [4, 4], [4, 4], [3, 3], [4, 4], [5, 5], [5, 4]]); out.oneUp = [wGL.G.over, wGL.matchText(1)];
          wGL.newGame(); out.as = wGL.matchText(0); __holes([[5, 4]]); out.down = wGL.matchText(0);
          wGL.newGame({ holes: 3 }); __holes([[4, 5], [4, 5]]); out.short = wGL.G.over;
          return out; })()""")
        check(m['three'] == [3, 6, '3 up with 6 to play', '3 down with 6 to play'], 'the match from each side: 3 up with 6 to play', m['three'])
        check(m['dormie'] == ['Dormie 3', 'Dormie 3 down'], 'as many up as there are holes left is dormie', m['dormie'])
        check(m['win'] == [{'win': 0, 'text': '3 and 2'}, 'Won 3 and 2', 'Lost 3 and 2', 7] and m['after'] == [False, -1, []], 'more up than holes left wins it there ("3 and 2"), and nothing more is played', m)
        check(m['oneUp'] == [{'win': 1, 'text': '1 up'}, 'Won 1 up'], 'won on the last hole is "1 up"', m['oneUp'])
        check(m['as'] == 'All square with 9 to play' and m['down'] == '1 down with 8 to play' and m['short'] == {'win': 0, 'text': '2 and 1'}, 'All square, one down, and a short game settled early too', m)

        # ---------- the playoff ----------
        po = await pg.evaluate("""(() => { const out = {}; wGL.newGame({ holes: 3, pars: [3, 4, 5] });
          __holes([[3, 3], [4, 4], [5, 5]]); out.level = [wGL.G.over, wGL.G.playoff, wGL.G.h, wGL.G.hole.par, wGL.holeNo(), wGL.matchText(0)];
          __hole(3, 3); out.again = [wGL.G.over, wGL.G.playoff, wGL.G.hole.par, wGL.matchText(0)];
          __hole(5, 4); out.won = [wGL.G.over, wGL.matchText(1), wGL.matchText(0), wGL.G.res];
          return out; })()""")
        check(po['level'] == [None, 1, 3, 3, 4, 'All square: playoff, extra hole 1 (the 4th)'], 'level after the last hole: a playoff, on the 1st hole again', po['level'])
        check(po['again'] == [None, 2, 4, 'All square: playoff, extra hole 2 (the 5th)'], 'a halved playoff hole plays on, round the course', po['again'])
        check(po['won'][:3] == [{'win': 1, 'text': 'at the 5th'}, 'Won at the 5th', 'Lost at the 5th'] and po['won'][3] == [-1, -1, -1, -1, 1], 'the first playoff hole won settles it', po['won'])

        # ---------- plain JSON ----------
        pj = await pg.evaluate("""(() => { wGL.newGame(); __holes([[4, 5], [3, 3]]); wGL.stroke(0, 1); const a = JSON.stringify(wGL.G); return a === JSON.stringify(JSON.parse(a)) && !/function/.test(a); })()""")
        check(pj, 'the game is plain JSON', pj)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

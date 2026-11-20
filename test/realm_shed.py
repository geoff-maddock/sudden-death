# Realm shed (issue #102, phase 0): the Curling Shed, the curling engine, builds in its own scope (wCR) behind
# W_ENGINES, and its rules are pure functions.
# The order: an end is sixteen stones, the sides alternating, the side without the hammer first, each side's stones
# lead, lead, second, second, third, third, skip, skip (by the side's order of its roster). Scoring: the side with the
# stone nearest the button scores one for each of its stones nearer than the other side's nearest; only stones touching
# the house count (a stone just touching counts, one just clear doesn't); none in the house is a blank. The side that
# scores gives up the hammer; after a blank it stays (so a steal leaves it where it was). A stone past the back line or
# short of the hog line is out of play. The free guard zone: before the fifth stone, taking the other side's guard out
# of play puts everything back and removes the thrown stone; your own guard, or after the fourth stone, is fair; off
# with fgz: false. Level after the last end: an extra end, until one side is ahead. A refused stone says why and changes
# nothing. The game is plain JSON. None of the engine's names reach the page. Asserts; exits nonzero on failure.
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

HELP = r"""
// throw a whole end: every stone changes nothing, and the last leaves `last` in play (each as [side, x, y])
window.__end = last => { let r = null; for (let i = 0; i < 16; i++) { const s = wCR.up(), G = wCR.G; const keep = G.stones.slice();
    const after = i < 15 ? keep : last.map(([ss, x, y], j) => ({ id: ss + ':x' + j, s: ss, x, y })); r = wCR.throw(s, after); } return r; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate(HELP)

        # ---------- the seam ----------
        sc = await pg.evaluate("""(() => ({ engine: W_ENGINES.shed && W_ENGINES.shed.api === wCR && W_ENGINES.shed.sport === 'curling' && W_ENGINES.shed.view === 'shed',
          leak: ['crNewGame', 'crThrow', 'CR_RULES', 'CR_SHEET', 'crScoreEnd'].filter(n => typeof window[n] !== 'undefined'), on: wCR.on }))()""")
        check(sc['engine'] and not sc['leak'] and sc['on'] is False, 'the Curling Shed is W_ENGINES.shed (curling), in its own scope: none of its names on the page, and never on yet', sc)

        # ---------- the order ----------
        o = await pg.evaluate("""(() => { wCR.newGame({ ends: 6, order: [[3, 2, 1, 0], [0, 1, 2, 3]], roster: [5, 4] }); const seq = [];
          for (let i = 0; i < 16; i++) { const s = wCR.up(); seq.push([s, wCR.pos(s), wCR.thrower(s), wCR.sideNo(s)]); wCR.throw(s, wCR.G.stones); }
          return { seq, end: wCR.G.end, k: wCR.G.k }; })()""")
        sides = [x[0] for x in o['seq']]; pos0 = [x[1] for x in o['seq'] if x[0] == 0]; who0 = [x[2] for x in o['seq'] if x[0] == 0]; no1 = [x[3] for x in o['seq'] if x[0] == 1]
        check(sides == [0, 1] * 8, 'an end is sixteen stones, the sides alternating, the side without the hammer first', sides)
        check(pos0 == [0, 0, 1, 1, 2, 2, 3, 3] and who0 == [3, 3, 2, 2, 1, 1, 0, 0] and no1 == list(range(8)), 'each side\'s stones: lead, lead, second, second, third, third, skip, skip, by the side\'s own order', [pos0, who0, no1])
        check(o['end'] == 1 and o['k'] == 0, 'after the sixteenth stone the end is scored and the next begins', o)

        # ---------- scoring ----------
        s = await pg.evaluate("""(() => { const S = wCR.sheet, R = S.houseR + S.stoneR, st = a => a.map(([s, x, y], i) => ({ id: s + ':' + i, s, x, y }));
          return { two: wCR.scoreEnd(st([[1, 0, 10], [1, 5, -30], [0, 0, 50], [1, 0, 70]])), four: wCR.scoreEnd(st([[0, 0, 0], [0, 20, 0], [0, -30, 10], [0, 0, -40], [1, 60, 0]])),
            blank: wCR.scoreEnd(st([[0, 0, -150], [1, 0, -200]])), edge: [wCR.inHouse({ x: 0, y: R - 0.1 }), wCR.inHouse({ x: 0, y: R + 0.1 })],
            outBack: wCR.inPlay({ x: 0, y: S.back + S.stoneR + 1 }), outBoard: wCR.inPlay({ x: S.halfW - 2, y: 0 }), short: wCR.inPlay({ x: 0, y: -S.hog - 3 }),
            guard: [wCR.inFgz({ x: 0, y: -120 }), wCR.inFgz({ x: 0, y: -20 }), wCR.inFgz({ x: 0, y: 30 })] }; })()""")
        check(s['two']['s'] == 1 and s['two']['n'] == 2 and s['four']['s'] == 0 and s['four']['n'] == 4, 'the nearest side scores each of its stones nearer than the other\'s nearest: two, and a four-ender', s)
        check(s['blank']['s'] == -1 and s['edge'] == [True, False], 'nothing in the house is a blank; a stone just touching the house counts, one just clear doesn\'t', s)
        check(not s['outBack'] and not s['outBoard'] and not s['short'] and s['guard'] == [True, False, False], 'past the back line, on the boards or short of the hog line is out of play; a guard is short of the house, not in it', s)

        # ---------- the hammer, and the extra end ----------
        h = await pg.evaluate("""(() => { wCR.newGame({ ends: 4 }); const out = { h0: wCR.G.hammer };
          out.e1 = __end([[1, 0, 10], [1, 0, 30], [0, 0, 60]]).end; out.h1 = wCR.G.hammer;       // the hammer scores two: it passes
          out.e2 = __end([[0, 0, 10], [1, 0, 30]]).end; out.h2 = wCR.G.hammer;                   // a steal: it stays
          out.e3 = __end([]).end; out.h3 = wCR.G.hammer;                                          // a blank: it stays
          out.e4 = __end([[0, 0, 0]]).end; out.tot = [wCR.total(0), wCR.total(1)]; out.extra = wCR.G.extra; out.over0 = wCR.G.over;
          out.e5 = __end([[0, 0, 0], [0, 0, 20]]); out.over = wCR.G.over; out.board = wCR.board(); out.text = [wCR.matchText(0), wCR.matchText(1)];
          out.json = JSON.stringify(wCR.G) === JSON.stringify(JSON.parse(JSON.stringify(wCR.G))); return out; })()""")
        check(h['h0'] == 1 and h['e1'] == {'s': 1, 'n': 2, 'shot': '1:x0', 'end': 1} and h['h1'] == 0, 'the side with the hammer scores two, and gives it up', h)
        check(h['e2']['s'] == 0 and h['h2'] == 1 and h['e3']['s'] == -1 and h['h3'] == 1, 'a steal and a blank both leave the hammer where it was', h)
        check(h['tot'] == [2, 2] and h['extra'] == 1 and h['over0'] is None, 'level after the last end: an extra end', h)
        check(h['over'] and h['over']['win'] == 0 and h['over']['tot'] == [4, 2] and h['over']['extra'] == 1 and h['text'][0].startswith('Won 4 to 2') and 'extra end' in h['text'][1], 'the extra end decides it, and the game says so', h)
        check(h['board']['sc'] == [[0, 1, 0, 1, 2], [2, 0, 0, 0, 0]] and h['json'], 'the board keeps every end\'s points, and the game is plain JSON', h['board'])

        # ---------- the free guard zone ----------
        f = await pg.evaluate("""(() => { const guard = { id: '0:0', s: 0, x: 0, y: -120 }, out = {};
          wCR.newGame({}); wCR.throw(0, [guard]); const r = wCR.throw(1, []); out.taken = [r.fgz, wCR.G.stones.map(x => x.id), wCR.G.k];
          wCR.newGame({}); wCR.throw(0, [guard]); out.own = wCR.throw(1, [guard, { id: '1:0', s: 1, x: 0, y: -100 }]).fgz;
          wCR.newGame({}); wCR.throw(0, [guard]); wCR.throw(1, [guard]); wCR.throw(0, [guard]); out.ownTake = wCR.throw(1, [guard, { id: '1:1', s: 1, x: 4, y: -110 }]).fgz;
          wCR.newGame({}); for (let i = 0; i < 4; i++) wCR.throw(wCR.up(), i === 0 ? [guard] : wCR.G.stones); out.late = [wCR.throw(wCR.up(), []).fgz, wCR.G.stones.length];
          wCR.newGame({ fgz: false }); wCR.throw(0, [guard]); out.off = [wCR.throw(1, []).fgz, wCR.G.stones.length];
          const bad = wCR.throw(1, []); out.refused = [bad.ok, bad.why, wCR.G.k];
          return out; })()""")
        check(f['taken'] == [True, ['0:0'], 2], 'before the fifth stone, taking the other side\'s guard out puts it back and removes the thrown stone', f)
        check(f['own'] is False and f['ownTake'] is False, 'a stone that leaves the guard, or plays to the other side of it, is fine', f)
        check(f['late'] == [False, 0] and f['off'] == [False, 0], 'from the fifth stone, or with no free guard zone, a guard can be taken out', f)
        check(f['refused'][0] is False and f['refused'][1] and f['refused'][2] == 2, 'a stone out of turn is refused, says why, and changes nothing', f)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

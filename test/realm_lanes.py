# Realm lanes (issue #100, phase 0): the Saltmere Lanes, the bowling engine, builds in its own scope (wBL) behind
# W_ENGINES, and its rules are pure functions.
# Ten-pin scoring: a strike is 10 plus the next two balls, a spare 10 plus the next one, the tenth frame has its fill
# balls; a perfect game is 300, all 9-spares 190, all 9s 90; a frame waiting on its bonus balls has no score yet. Checked
# against known sheets and against a reference scorer on random games. Splits: the headpin down and the standing pins
# in two or more groups (the 7-10, the 4-6, the 2-7), never the 2-3 or the bucket. The Baker order: five bowlers take
# the frames in turn, the anchor the 5th and the 10th. The sides take their frames in turn, the lead first, on a pair
# of lanes, moving across every frame. A refused ball says why and changes nothing. Level after the 10th, a roll-off
# of the 9th and the 10th by their bowlers, again if still level. The re-rack and the pinch bowler: once a game,
# before the frame's first ball. The game is plain JSON. None of the engine's names reach the page.
# Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess, random
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

# ---------- a reference scorer and random games, in Python ----------
def ref_score(frames):
    balls = [b for fr in frames for b in fr]; out = []; run = 0; i = 0
    for f in range(10):
        if balls[i] == 10: run += 10 + balls[i + 1] + balls[i + 2]; i += 1
        elif balls[i] + balls[i + 1] == 10: run += 10 + balls[i + 2]; i += 2
        else: run += balls[i] + balls[i + 1]; i += 2
        out.append(run)
    return out

def rand_game(rng):
    frames = []
    for f in range(9):
        a = rng.choice([10, 10, 10] + list(range(0, 10)))
        frames.append([10] if a == 10 else [a, rng.randint(0, 10 - a)])
    a = rng.choice([10, 10] + list(range(0, 10)))
    if a == 10:
        b = rng.choice([10] + list(range(0, 10)))
        c = rng.choice([10] + list(range(0, 10))) if b == 10 else rng.randint(0, 10 - b)
        frames.append([10, b, c])
    else:
        b = rng.randint(0, 10 - a)
        frames.append([a, b, rng.choice([10] + list(range(0, 10)))] if a + b == 10 else [a, b])
    return frames

# bowl both sides' balls in the order the game asks for them: q0 and q1 are each side's balls (counts), in order.
# Returns every roll's result, and stops when the game is over or a queue runs dry
HELP = r"""
window.__bowl = (q0, q1) => { const q = [q0.slice(), q1.slice()], out = [];
  for (let n = 0; n < 200; n++) { const s = wBL.up(); if (s < 0 || !q[s].length) break; out.push(Object.assign({ who: wBL.bowler(s) }, wBL.roll(s, q[s].shift()))); }
  return out; };
0"""
FLAT = lambda frames: [b for fr in frames for b in fr]
GAME167 = [[10], [7, 3], [9, 0], [10], [0, 8], [8, 2], [0, 6], [10], [10], [10, 8, 1]]
SPARES = [[9, 1]] * 9 + [[9, 1, 9]]
NINES = [[9, 0]] * 10
PERFECT = [[10]] * 9 + [[10, 10, 10]]

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBL !== 'undefined' && typeof W_ENGINES !== 'undefined'")
        await pg.evaluate(HELP)

        # ---------- the scope ----------
        s = await pg.evaluate("""(() => ({ api: typeof wBL === 'object' && typeof wBL.newGame === 'function' && typeof wBL.roll === 'function',
          leaks: ['BL_RULES', 'BL_ADJ', 'blNewGame', 'blRoll', 'blScore', 'blIsSplit', 'blUp', 'blBowler', 'blLane', 'blRerack', 'blPinch', 'blMatchText', 'blFrameDone'].filter(n => (0, eval)('typeof ' + n) !== 'undefined'),
          eng: { api: W_ENGINES.lanes.api === wBL, view: W_ENGINES.lanes.view, sport: W_ENGINES.lanes.sport, on: wBL.on }, r: wBL.rules }))()""")
        check(s['api'] and not s['leaks'], 'the Saltmere Lanes build in their own scope (wBL); none of their names reach the page', s)
        check(s['eng'] == {'api': True, 'view': 'lanes', 'sport': 'bowling', 'on': False}, 'W_ENGINES.lanes is bowling, in the lanes view, and off', s['eng'])
        check(s['r'] == {'side': 5, 'frames': 10, 'framesAt': [5, 10], 'pins': 10}, 'five a side, 10 frames by default (5 or 10), ten pins', s['r'])

        # ---------- scoring, pure ----------
        sc = await pg.evaluate("""(sheets => sheets.map(f => wBL.score(f, 10)))""", [PERFECT, SPARES, NINES, GAME167])
        check(sc[0][-1] == 300 and sc[0][0] == 30, 'twelve strikes is 300', sc[0])
        check(sc[1][-1] == 190 and sc[2][-1] == 90, 'all 9-spares is 190, all 9s is 90', [sc[1][-1], sc[2][-1]])
        check(sc[3] == [20, 39, 48, 66, 74, 84, 90, 120, 148, 167], 'a sheet of strikes, spares, misses and a tenth with fills scores 167, frame by frame', sc[3])
        pend = await pg.evaluate("""[wBL.score([[10], [10]], 10), wBL.score([[10], [10], [10]], 10), wBL.score([[7, 3]], 10), wBL.score([[7, 3], [4]], 10), wBL.score([[7, 2], [10], [3]], 10)]""")
        check(pend == [[None, None], [30, None, None], [None], [14, None], [9, None, None]], 'a strike or a spare has no score until its next balls are bowled', pend)
        rng = random.Random(100); games = [rand_game(rng) for _ in range(300)]
        got = await pg.evaluate("""(gs => gs.map(f => wBL.score(f, 10)))""", games)
        bad = [(g, got[i], ref_score(g)) for i, g in enumerate(games) if got[i] != ref_score(g)]
        check(not bad, '300 random sheets score the same as a reference scorer', bad[:2])
        dn = await pg.evaluate("""[wBL.done([10]), wBL.done([3]), wBL.done([3, 4]), wBL.done([10], 1), wBL.done([10, 10], 1), wBL.done([10, 10, 10], 1), wBL.done([7, 3], 1), wBL.done([7, 3, 5], 1), wBL.done([7, 2], 1), wBL.done([10, 7, 3], 1)]""")
        check(dn == [True, False, True, False, False, True, False, True, True, True], 'a frame ends on a strike or two balls; the tenth gives fill balls for a strike or a spare', dn)
        mk = await pg.evaluate("""[[10], [7, 3], [9, 0], [0, 8], [10, 10, 10], [10, 7, 3], [7, 3, 10], [0, 10], [10, 0, 0]].map(f => wBL.frameMarks(f).join(''))""")
        check(mk == ['X', '7/', '9-', '-8', 'XXX', 'X7/', '7/X', '-/', 'X--'], 'the sheet marks strikes X, spares / and misses -', mk)

        # ---------- splits ----------
        sp = await pg.evaluate("""[[7, 10], [4, 6], [2, 7], [3, 10], [5, 7], [4, 6, 7, 10], [2, 3], [4, 5], [7, 8], [2, 4, 5, 8], [1, 7, 10], [10], [], [6, 7, 10]].map(p => wBL.isSplit(p))""")
        check(sp[:6] == [True] * 6, 'splits: the 7-10, the 4-6, the 2-7, the 3-10, the 5-7 and the big four', sp)
        check(sp[6:] == [False, False, False, False, False, False, False, True], 'not splits: the 2-3, the 4-5, the 7-8, the bucket, anything with the headpin, one pin or none; the 6-7-10 is', sp)

        # ---------- a new game, the order and the lanes ----------
        g = await pg.evaluate("""(() => { const G = wBL.newGame(); const d = { frames: G.frames, order: G.order, lead: G.lead, up: wBL.up(), b: [wBL.bowler(0), wBL.bowler(1)], stand: wBL.standing(0), over: G.over, no: wBL.frameNo(0), txt: wBL.matchText(0) };
          const n = [5, 10, 7].map(k => wBL.newGame({ frames: k }).frames);
          const bad = wBL.newGame({ order: [[0, 0, 1, 2, 3], [0, 1, 2, 3, 9]] }).order, big = wBL.newGame({ roster: [7, 3], order: [[6, 5, 4, 3, 2], [4, 3, 2, 1, 0]] });
          return { d, n, bad, big: [big.roster, big.order[0]] }; })()""")
        check(g['d'] == {'frames': 10, 'order': [[0, 1, 2, 3, 4], [0, 1, 2, 3, 4]], 'lead': 0, 'up': 0, 'b': [0, 0], 'stand': list(range(1, 11)), 'over': None, 'no': 1, 'txt': 'Nothing down yet'},
              'a new game: ten frames, each side in roster order, side 0 to lead, ten pins up', g['d'])
        check(g['n'] == [5, 10, 10] and g['bad'] == [[0, 1, 2, 3, 4]] * 2 and g['big'] == [[7, 5], [6, 5, 4, 3, 2]], 'a game is 5 or 10 frames (else 10); an order must be five different bowlers on the roster', g)
        o = await pg.evaluate("""(() => { wBL.newGame({ order: [[4, 3, 2, 1, 0], [1, 2, 3, 4, 0]] }); const ups = [], who = [[], []], lanes = [[], []];
          for (let n = 0; n < 40; n++) { const s = wBL.up(); if (s < 0) break; who[s].push(wBL.bowler(s)); lanes[s].push(wBL.lane(s)); ups.push(s); wBL.roll(s, 3); wBL.roll(s, s ? 5 : 4); if (wBL.G.over) break; }
          wBL.newGame({ frames: 5, lead: 1 }); const five = []; for (let n = 0; n < 20; n++) { const s = wBL.up(); if (s < 0) break; five.push([s, wBL.bowler(s)]); wBL.roll(s, 10); if (wBL.G.over) break; }
          return { ups: ups.join(''), who, lanes, five, over5: wBL.G.over }; })()""")
        check(o['who'][0] == [4, 3, 2, 1, 0, 4, 3, 2, 1, 0] and o['who'][1] == [1, 2, 3, 4, 0, 1, 2, 3, 4, 0], 'the Baker order: five bowlers take the frames in turn, the anchor the 5th and the 10th', o['who'])
        check(o['ups'] == '01' * 10, 'the sides take their frames in turn, the lead side first', o['ups'])
        check(o['lanes'] == [[0, 1] * 5, [1, 0] * 5], 'a pair of lanes: the sides start on opposite lanes and move across every frame', o['lanes'])
        five = o['five']
        check([s for s, _ in five[:8]] == [1, 0] * 4 and [s for s, _ in five[8:14]] == [1, 1, 1, 0, 0, 0] and [b for s, b in five if s == 1][:5] == [0, 1, 2, 3, 4], 'a 5-frame game gives each bowler one frame, the anchor the last; lead 1 starts with side 1', five)

        # ---------- a ball, refused and bowled ----------
        r = await pg.evaluate("""(() => { wBL.newGame(); const out = {};
          const wrong = wBL.roll(1, 3); out.wrong = [wrong.ok, wrong.why]; const many = wBL.roll(0, 11); out.many = [many.ok, many.why]; const odd = wBL.roll(0, [1, 1]); out.odd = [odd.ok, odd.why];
          const none = wBL.roll(0, 'x'); out.none = none.ok; out.after = [JSON.stringify(wBL.G.fr), wBL.standing(0).length];
          const a = wBL.roll(0, [1, 2, 3, 4, 5, 8, 9]); out.a = [a.ok, a.n, a.split, a.done, a.score, wBL.standing(0)];
          const gone = wBL.roll(0, [1]); out.gone = [gone.ok, gone.why]; const b = wBL.roll(0, [7]); out.b = [b.done, b.spare, b.score, wBL.standing(0).length, wBL.up()];
          const c = wBL.roll(1, 10); out.c = [c.strike, c.done, c.score, wBL.up()];
          return out; })()""")
        check(r['wrong'] == [False, "It is the other side's frame."] and r['many'][0] is False and r['odd'][0] is False and r['none'] is False and r['after'] == ['[[],[]]', 10],
              'a ball out of turn, for more pins than stand, or for pins not standing is refused, says why and changes nothing', r)
        check(r['a'] == [True, 7, True, False, None, [6, 7, 10]] and r['gone'][0] is False, 'seven down leaving the 6-7-10 is a split, and the frame goes on with those three; a pin already down can\'t fall again', r)
        check(r['b'] == [True, False, 8, 10, 1], 'the second ball ends the frame: an open 8, scored at once; a fresh rack, and the other side is up', r['b'])
        check(r['c'] == [True, True, None, 0], 'a strike ends the frame at once, with its score waiting on the next two balls', r['c'])

        # ---------- a whole game ----------
        w = await pg.evaluate("""(([a, b]) => { wBL.newGame(); const rolls = window.__bowl(a, b); const G = wBL.G;
          return { n: rolls.length, over: G.over, t: [wBL.total(0), wBL.total(1)], m0: wBL.matchText(0), m1: wBL.matchText(1), up: wBL.up(), more: wBL.roll(0, 1).why,
            marks: wBL.marks(0).game.map(f => f.b.join('') + (f.split ? 'o' : '') + ':' + f.score), json: JSON.stringify(JSON.parse(JSON.stringify(G))) === JSON.stringify(G) }; })""", [FLAT(GAME167), FLAT(NINES)])
        check(w['over'] and w['over']['win'] == 0 and w['over']['tot'] == [167, 90] and w['t'] == [167, 90] and w['up'] == -1 and w['more'] == 'The game is over.', 'a whole game: 167 beats 90, and nothing more can be bowled', w)
        check(w['m0'] == 'Won 167 to 90' and w['m1'] == 'Lost 90 to 167', 'the game in words, from each side', [w['m0'], w['m1']])
        check(w['marks'] == ['X:20', '7/:39', '9-:48', 'X:66', '-8:74', '8/:84', '-6:90', 'X:120', 'X:148', 'X81:167'] and w['json'], 'the sheet: marks and running totals; the game is plain JSON', w['marks'])
        mid = await pg.evaluate("""(() => { wBL.newGame(); window.__bowl([10, 3, 4], [5, 4, 10]); return [wBL.matchText(0), wBL.matchText(1), wBL.total(0), wBL.total(1)]; })()""")
        check(mid == ['Up 15 after 2', 'Down 15 after 2', 24, 9], 'mid-game: up or down by the frames scored so far', mid)

        # ---------- the roll-off ----------
        ro = await pg.evaluate("""(() => { wBL.newGame({ order: [[4, 3, 2, 1, 0], [0, 1, 2, 3, 4]] }); const sp = [], b = []; for (let i = 0; i < 9; i++) sp.push(9, 1); sp.push(9, 1, 9);
          window.__bowl(sp, sp.slice()); const G = wBL.G, out = { ro: G.ro, over: G.over, t: [wBL.total(0), wBL.total(1)], up: wBL.up(), who: [wBL.bowler(0), wBL.bowler(1)], no: wBL.frameNo(0), m: wBL.matchText(0) };
          // a level roll-off (X, then 9 and a spare's fill: 9/ is 20 + 19), then another, won
          window.__bowl([10, 9, 1, 9], [10, 9, 1, 9]); out.ro2 = wBL.G.ro; out.t2 = [wBL.total(0), wBL.total(1)];
          const r1 = window.__bowl([10, 10, 10, 10], [8, 1, 7, 2]); out.end = wBL.G.over; out.m0 = wBL.matchText(0); out.m1 = wBL.matchText(1);
          out.who2 = r1.map(x => [x.side, x.who, x.frame]); out.game = wBL.marks(0).game.length; out.rom = wBL.marks(0).ro.map(f => f.b.join(''));
          return out; })()""")
        check(ro['ro'] == 1 and ro['over'] is None and ro['t'] == [0, 0] and ro['up'] == 0 and ro['no'] == 9, '190 all after the 10th: a roll-off, from the 9th, the lead side first', ro)
        check(ro['who'] == [1, 3], 'the roll-off is bowled by the bowlers of the 9th and the 10th', ro['who'])
        check(ro['ro2'] == 2 and ro['t2'] == [0, 0], 'a level roll-off goes to another', ro)
        check(ro['end'] and ro['end']['win'] == 0 and ro['end']['tot'] == [60, 18] and ro['end']['ro'] == 2 and ro['end']['game'] == [190, 190], 'the second roll-off is won 60 to 18, after 190 all', ro['end'])
        check(ro['m0'] == 'Won 60 to 18 in the roll-off, after 190 all' and ro['m1'] == 'Lost 18 to 60 in the roll-off, after 190 all', 'a roll-off win in words', [ro['m0'], ro['m1']])
        check([x[2] for x in ro['who2'] if x[0] == 0] == [9, 10, 10, 10] and ro['game'] == 10 and ro['rom'] == ['X', 'XXX'], 'the roll-off\'s frames are the 9th and the 10th again, on their own sheet; the game\'s sheet stays as it was', ro)

        # ---------- the re-rack and the pinch bowler ----------
        k = await pg.evaluate("""(() => { wBL.newGame({ roster: [6, 5] }); const out = {};
          const other = wBL.rerack(1); out.other = [other.ok, other.why]; const a = wBL.rerack(0); out.a = [a.ok, a.frame];
          const again = wBL.rerack(0); out.again = [again.ok, again.why];
          wBL.roll(0, 4); const mid = wBL.pinch(0, 3); out.mid = [mid.ok, mid.why]; wBL.roll(0, 4);
          wBL.roll(1, 3); const late = wBL.rerack(1); out.late = [late.ok, late.why]; wBL.roll(1, 3);
          const same = wBL.pinch(0, 1); out.same = [same.ok, same.why]; const far = wBL.pinch(0, 6); out.far = [far.ok, far.why];
          const p = wBL.pinch(0, 5); out.p = [p.ok, p.ri, p.for, wBL.bowler(0)]; const p2 = wBL.pinch(0, 4); out.p2 = [p2.ok, p2.why];
          wBL.roll(0, 10); out.next = [wBL.up(), wBL.bowler(1)]; wBL.roll(1, 10); out.after = wBL.bowler(0); out.pinch = wBL.G.pinch;
          return out; })()""")
        check(k['other'][0] is False and k['a'] == [True, 1] and k['again'] == [False, 'One re-rack a game.'], 'a side calls its re-rack on its own frame, once a game', k)
        check(k['mid'] == [False, "Only before the frame's first ball."] and k['late'] == [False, "Only before the frame's first ball."], 'the re-rack and the pinch bowler only before a frame\'s first ball', k)
        check(k['same'] == [False, 'That bowler is up anyway.'] and k['far'] == [False, 'No such bowler.'], 'a pinch bowler must be someone else on the roster', k)
        check(k['p'] == [True, 5, 1, 5] and k['p2'] == [False, 'One pinch bowler a game.'], 'the pinch bowler bowls the frame, once a game', k)
        check(k['after'] == 2 and k['pinch'] == [None, None], 'after the pinch frame, the order goes on as it was', k)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

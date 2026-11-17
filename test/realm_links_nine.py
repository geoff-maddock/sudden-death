# Realm links (issue #92, phase 1): the course, the shot model and one game, CPU against CPU.
# The course: the standing nine is the same on every load (its own random stream, never the game's), par 36, each hole
# with its tee, a pin on the green, a length for its par, and plain JSON; a wild nine is another seed's (par 36 too).
# The shot, on a flat test hole so the ground can't decide it: a club's carry by the hitter's power and the swing's;
# the driver only off the tee; rough and bog shorter, sand needs the wedge, the trees allow only a punch; a miss curves
# the ball one way or the other by how far off it was; the wind drifts a high ball more than a low one, and a headwind
# costs more than a tailwind gives; the water is a drop back on the line; a ball plugs in the sand. A putt: the read
# holes it on a flat green, too fast lips out or runs past, too slow stops short, a slope bends it, and reading the
# slope (glRead) brings it back to the cup.
# One game: seeded, the same twice; the turn loop says what happened; plain JSON mid-game. And the golf looks like golf
# over 400 games, Knight against Knight: most holes par or bogey, a birdie now and then, a third or so halved, about
# half of even matches settled before the 9th (more when the sides differ), every game won (a playoff when level); a better caddie wins more.
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

# a flat test hole: all fairway (or what fill says), a green round (100, 400) with the pin at its middle, no slope
HELP = r"""
window.__flat = (fill, slope) => { const rows = []; for (let r = 0; r < 100; r++) { let line = ''; for (let c = 0; c < 40; c++) {
    const x = (c + .5) * 5, y = (r + .5) * 5; line += Math.hypot(x - 100, y - 400) < 15 ? 'G' : (fill ? fill(x, y) : 'F'); } rows.push(line); }
  return { seed: 0, par: 4, len: 390, w: 40, h: 100, cell: 5, grid: rows, tee: { x: 100, y: 10 }, green: { x: 100, y: 400, rx: 15, ry: 15 }, pin: { x: 100, y: 400 },
    path: [{ x: 100, y: 10 }, { x: 100, y: 400 }], line: [], slope: slope || { a: 0, g: 0, w: 0, k: 0, p: 0 } }; };
window.__shot = (H, o) => wGL.flight(Object.assign({ hole: H, from: { x: 100, y: 10 }, lie: 'T', club: 'dr', aim: { x: 100, y: 300 }, pow: 1, err: 0, wind: null, spin: 0, rat: { pow: .5, scr: .5 } }, o));
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGL !== 'undefined' && typeof wGL.simGame === 'function'")
        await pg.evaluate(HELP)

        leaks = await pg.evaluate("""['GL_CLUBS', 'GL_LIES', 'GL_SWING', 'GL_STAND', 'GLK', 'glBuildHole', 'glFlight', 'glPutt', 'glRead', 'glPlan', 'glTurn', 'glStart', 'glSimGame', 'glHit', 'glLie']
          .filter(n => (0, eval)('typeof ' + n) !== 'undefined')""")
        check(not leaks, 'the course, the shot and the game stay inside the wGL scope', leaks)

        # ---------- the course ----------
        nine = await pg.evaluate("""(() => { const P = { 3: [135, 200], 4: [325, 425], 5: [470, 545] }, out = [];
          for (let i = 0; i < 9; i++) { const H = wGL.course(i); out.push({ par: H.par, len: H.len, inLen: H.len >= P[H.par][0] && H.len <= P[H.par][1],
            tee: wGL.lie(H, H.tee.x, H.tee.y), pin: wGL.lie(H, H.pin.x, H.pin.y), rows: H.grid.length === H.h && H.grid.every(r => r.length === H.w),
            json: JSON.stringify(JSON.parse(JSON.stringify(H))) === JSON.stringify(H), kinds: [...new Set(H.grid.join(''))].sort().join('') }); }
          return { out, sig: JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => wGL.course(i).grid)).length + ':' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => wGL.course(i).len).join(',') }; })()""")
        o = nine['out']
        check([h['par'] for h in o] == [4, 3, 5, 4, 4, 3, 4, 5, 4], 'the standing nine is par 36: 4 3 5 4 4 3 4 5 4', [h['par'] for h in o])
        check(all(h['inLen'] and h['tee'] == 'T' and h['pin'] == 'G' and h['rows'] and h['json'] for h in o), 'each hole has a tee, a pin on the green, a length for its par, a full grid, and is plain JSON', o)
        allk = set(''.join(h['kinds'] for h in o))
        check({'T', 'F', 'r', 'R', 'S', 'O', 'G'} <= allk and ('W' in allk or 'B' in allk), 'the nine has fairway, rough, deep rough, sand, trees and greens, and water or a moss bog', sorted(allk))
        # the same nine on a fresh page, after the game's own random has been drawn from
        pg2 = await br.new_page(); await pg2.goto(REALM_URL); await pg2.wait_for_function("typeof wGL !== 'undefined' && typeof wGL.simGame === 'function'")
        sig2 = await pg2.evaluate("""(() => { wGL.simGame({ seed: 99 }); Math.random(); return JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => wGL.course(i).grid)).length + ':' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => wGL.course(i).len).join(','); })()""")
        await pg2.close()
        check(sig2 == nine['sig'], 'the standing nine is the same on every load, whatever the game has drawn', [nine['sig'], sig2])
        w = await pg.evaluate("""(() => { const a = wGL.wildPars(12345, 9), b = wGL.wildPars(12345, 9), H1 = wGL.built(4242, 4), H2 = wGL.built(4242, 4), H3 = wGL.built(4243, 4);
          return { sum: a.reduce((x, y) => x + y, 0), same: JSON.stringify(a) === JSON.stringify(b), n18: wGL.wildPars(7, 18).length, hs: JSON.stringify(H1) === JSON.stringify(H2), diff: JSON.stringify(H1.grid) !== JSON.stringify(H3.grid) }; })()""")
        check(w['sum'] == 36 and w['same'] and w['n18'] == 18 and w['hs'] and w['diff'], 'a wild nine is par 36 too; a seed always builds the same hole, another seed another', w)

        # ---------- the shot (a flat hole) ----------
        s = await pg.evaluate("""(() => { const H = __flat(), dr = __shot(H, {}), dr2 = __shot(H, {}), big = __shot(H, { rat: { pow: .9, scr: .5 } }), half = __shot(H, { pow: .5 });
          const fwDr = __shot(H, { lie: 'F' }), we = __shot(H, { club: 'we' });
          const li = l => __shot(H, { lie: l, club: 'li' }).carry, weS = __shot(H, { lie: 'S', club: 'we' }).carry, weF = __shot(H, { lie: 'F', club: 'we' }).carry;
          const punch = __shot(H, { lie: 'O', club: 'mi' });
          return { dr: [dr.carry, dr.end.y - 10 > dr.carry, dr.lie], same: JSON.stringify(dr) === JSON.stringify(dr2), big: big.carry, half: half.carry, fwDr: fwDr.club, we: we.carry,
            li: { F: li('F'), r: li('r'), R: li('R'), B: li('B'), S: li('S') }, weS, weF, punch: [punch.carry, punch.club] }; })()""")
        check(s['dr'][0] == 228 and s['dr'][1] and s['dr'][2] == 'F' and s['same'], 'a full driver from the tee carries 228 yards for an average hitter and runs on; the same swing, the same ball', s)
        check(s['big'] > s['dr'][0] and abs(s['half'] - 114) <= 1 and s['we'] < s['dr'][0], 'a more powerful hitter carries further; half power, half the carry; a wedge is shorter', s)
        check(s['fwDr'] == 'we', 'the driver is only off the tee (from the fairway it is refused for the wedge)', s['fwDr'])
        L = s['li']
        check(L['F'] > L['r'] > L['R'] > L['B'] and L['S'] < L['F'] * 0.35, 'rough, deep rough and bog cost distance; anything but the wedge barely leaves the sand', L)
        check(s['weS'] > s['weF'] * 0.7 and s['punch'][0] <= 65, 'the wedge gets out of the sand; from the trees only a punch (65 yards at most)', s)
        c = await pg.evaluate("""(() => { const H = __flat(), x = o => __shot(H, Object.assign({ club: 'li' }, o)).end.x - 100;
          const tail = __shot(H, { club: 'li', wind: { s: 12, d: Math.PI / 2 } }).carry, head = __shot(H, { club: 'li', wind: { s: 12, d: -Math.PI / 2 } }).carry, calm = __shot(H, { club: 'li' }).carry;
          const drift = (club, lie) => { const a = __shot(H, { club, lie, wind: { s: 12, d: 0 } }), b = __shot(H, { club, lie }); return (a.end.x - b.end.x) / b.carry; };
          return { r: x({ err: 1 }), l: x({ err: -1 }), r2: x({ err: 2 }), tail, head, calm, hi: drift('we', 'F'), lo: drift('li', 'F'), punch: drift('mi', 'O') }; })()""")
        check(c['r'] > 5 and abs(c['r'] + c['l']) < 0.01 and c['r2'] > c['r'] * 1.8, 'a miss curves the ball off line, right for plus and left for minus, by how far off the swing was', c)
        check(c['tail'] > c['calm'] > c['head'] and (c['calm'] - c['head']) > (c['tail'] - c['calm']), 'a tailwind carries it further and a headwind shorter, and the headwind costs more than the tailwind gives', c)
        check(c['hi'] > c['lo'] > c['punch'] > 0, 'the wind drifts a high ball (a wedge) more than a low one, and a punch least', c)
        h = await pg.evaluate("""(() => { const Hw = __flat((x, y) => y > 150 && y < 175 ? 'W' : 'F'), wet = __shot(Hw, { club: 'mi' });
          const Hs = __flat((x, y) => y > 140 && y < 170 ? 'S' : 'F'), sand = __shot(Hs, { club: 'mi' });
          return { wet: [wet.water, wet.drop, wet.lie, Math.round(wet.end.y), wet.end.x], sand: [sand.lie, sand.roll] }; })()""")
        check(h['wet'][0] and h['wet'][1] and h['wet'][2] != 'W' and 140 <= h['wet'][3] <= 150 and abs(h['wet'][4] - 100) < 0.01, 'into the water: a drop on the line, at the last dry ground before it', h['wet'])
        check(h['sand'] == ['S', 0], 'a ball that lands in the sand plugs there', h['sand'])
        pt = await pg.evaluate("""(() => { const H = __flat(), from = { x: 100, y: 392 }, r = wGL.read(H, from), made = wGL.putt({ hole: H, from, a: r.a, v: r.v });
          const fast = wGL.putt({ hole: H, from, a: Math.PI / 2, v: 4.5 }), slow = wGL.putt({ hole: H, from, a: Math.PI / 2, v: 2 });
          const S = __flat(null, { a: 0, g: .02, w: 0, k: 0, p: 0 }), straight = wGL.putt({ hole: S, from, a: Math.PI / 2, v: r.v, noCup: true }), rr = wGL.read(S, from), fixed = wGL.putt({ hole: S, from, a: rr.a, v: rr.v });
          return { made: [made.holed, made.lip], fast: [fast.holed, fast.lip, fast.end.y > 400], slow: [slow.holed, slow.end.y < 400], bend: straight.end.x - 100, fixed: fixed.holed, ra: rr.a > Math.PI / 2 }; })()""")
        check(pt['made'][0], 'a putt read and struck as read drops on a flat green', pt)
        check(pt['fast'] == [False, True, True] and pt['slow'] == [False, True], 'too fast lips out and runs past; too slow never drops', pt)
        check(pt['bend'] > 0.1 and pt['ra'] and pt['fixed'], 'a slope bends a putt downhill, and the read aims above the hole and holes it', pt)

        # (from the review of #93) the caddie plans with the model it hits with: out of sand it takes the wedge, and a
        # scrambler's carry from a bad lie is the one it planned; a par 5 is as long as its card says
        rv = await pg.evaluate("""(() => { const H = __flat((x, y) => y < 60 ? 'S' : 'F');
          wGL.start({ seed: 3 }); const G = wGL.G, Hc = wGL.course(0); G.ball[0] = { x: Hc.pin.x, y: Hc.pin.y - 90, lie: 'S' }; G.hole.st = [1, 1]; const sand = wGL.plan(0).club;
          const rat = { pow: .5, scr: .1 }, want = wGL.reach('mi', 'R', rat, 1).carry, got = wGL.flight({ hole: __flat(), from: { x: 100, y: 10 }, lie: 'R', club: 'mi', aim: { x: 100, y: 300 }, pow: 1, err: 0, rat }).carry;
          let worst = 0; for (let s = 1; s < 400; s++) { const P = wGL.built(s * 7919, 5); let L = 0; for (let i = 0; i < P.path.length - 1; i++) L += Math.hypot(P.path[i + 1].x - P.path[i].x, P.path[i + 1].y - P.path[i].y); worst = Math.max(worst, L - P.len); }
          return { sand, want: Math.round(want), got, worst }; })()""")
        check(rv['sand'] == 'we' and abs(rv['want'] - rv['got']) <= 1 and rv['worst'] < 1, 'the caddie takes the wedge out of sand; a scrambler\'s carry from deep rough is the one planned; a par 5 is as long as its card says', rv)
        wd = await pg.evaluate("""(() => { const H = __flat((x, y) => y > 414 && y < 440 ? 'W' : 'F'), r = __shot(H, { lie: 'F', club: 'si', aim: { x: 100, y: 395 }, from: { x: 100, y: 280 }, pow: 1.02 });
          return { water: r.water, y: Math.round(r.end.y), lie: r.lie }; })()""")
        check(wd['water'] and wd['y'] > 400 and wd['lie'] != 'W', 'a ball that runs across the green into the water is dropped by where it went in, past the green', wd)
        # (from the sixth review of #93) the CPU never gives away the hole; a greenside bunker takes the wedge; a punch
        # from the trees finishes where it was planned
        r6 = await pg.evaluate("""(() => { const out = {}; wGL.start({ seed: 5, skill: [0, 0] }); const G = wGL.G, H = wGL.course(0);
          // you on 3 with a 1-foot putt, a Squire (who gives every short putt it may) on 4 and not holed: giving it hands
          // over the hole, so it is never given; with the Squire on 3 it is
          const once = (stBy) => { wGL.start({ seed: 5, skill: [1, 0] }); const G = wGL.G, H = wGL.course(0); G.hole.st = [3, stBy];
            G.ball[0] = { x: H.pin.x, y: H.pin.y - .4, lie: 'G' }; G.ball[1] = { x: H.pin.x, y: H.pin.y + .2, lie: 'G' }; return wGL.turn().k; };
          out.losing = [0, 1, 2, 3, 4].map(() => once(4)); out.even = once(3);
          wGL.start({ seed: 6 }); const G2 = wGL.G, H2 = wGL.course(0); G2.ball[0] = { x: H2.pin.x, y: H2.pin.y - 20, lie: 'S' }; G2.hole.st = [2, 2]; G2.ball[1] = { x: H2.pin.x, y: H2.pin.y - 60, lie: 'F' };
          out.sand = wGL.plan(0).club;
          const F = __flat((x, y) => y < 30 ? 'O' : 'F'), rat = { pow: .5, scr: .5 }, R = wGL.reach('mi', 'O', rat, .8), f = wGL.flight({ hole: F, from: { x: 100, y: 10 }, lie: 'O', club: 'mi', aim: { x: 100, y: 300 }, pow: .8, err: 0, rat });
          out.punch = { planned: Math.round(R.carry + R.roll), flew: Math.round(f.end.y - 10) };
          return out; })()""")
        check(all(k == 'shot' for k in r6['losing']) and r6['even'] == 'given', 'the CPU never gives the putt that hands over the hole (a Squire gives it when it doesn\'t)', r6)
        check(r6['sand'] == 'we', 'from a greenside bunker 20 yards out the caddie takes the wedge', r6)
        check(abs(r6['punch']['planned'] - r6['punch']['flew']) <= 2, 'a punch from the trees finishes where it was planned (the punch\'s run is in the plan)', r6['punch'])
        kp = await pg.evaluate("""(() => { wGL.start({ seed: 21 }); for (let i = 0; i < 6; i++) wGL.turn(); const before = JSON.stringify(wGL.G);
          const r = wGL.simGame({ seed: 4 }); return { same: before === JSON.stringify(wGL.G), sim: r.played > 0 }; })()""")
        check(kp['same'] and kp['sim'], 'a headless game leaves the game on the course as it was', kp)
        gv = await pg.evaluate("""(() => { let ok = true, n = 0; for (let i = 0; i < 40; i++) { const r = wGL.simGame({ seed: 700 + i });
            for (const s of [0, 1]) { const given = r.log.filter(e => e.k === 'given' && e.side === s).length, putts = r.log.filter(e => e.k === 'shot' && e.side === s && e.club === 'pt').length; n += given; if (r.stat[s].putts !== putts + given) ok = false; } }
          return { ok, n }; })()""")
        check(gv['ok'] and gv['n'] > 0, 'a given putt counts as a putt in the stats', gv)

        # ---------- one game ----------
        g = await pg.evaluate("""(() => { const a = wGL.simGame({ seed: 7 }), b = wGL.simGame({ seed: 7 }), c = wGL.simGame({ seed: 8 });
          const shots = []; wGL.onShot = e => shots.push(e.k); wGL.start({ seed: 11 }); const evs = []; for (let i = 0; i < 12; i++) evs.push(wGL.turn());
          const G = wGL.G, js = JSON.stringify(JSON.parse(JSON.stringify(G))) === JSON.stringify(G); let n = 0; while (wGL.turn() && n < 3000) n++;
          const s = wGL.summary(); wGL.onShot = null;
          return { same: JSON.stringify(a) === JSON.stringify(b), diff: JSON.stringify(a.card) !== JSON.stringify(c.card), heard: shots.length >= 12, ev: evs[0], js, over: !!wGL.G.over, s: [s.win, s.text, s.played, s.card.length] }; })()""")
        check(g['same'] and g['diff'], 'a seeded game plays the same twice; another seed, another game', g)
        e = g['ev']
        check(e['k'] == 'shot' and e['no'] == 1 and e['side'] == 0 and e['lie0'] == 'T' and g['heard'], 'turn plays the next shot (the honour side off the 1st tee) and onShot hears it', e)
        check(g['js'] and g['over'] and g['s'][0] in (0, 1) and g['s'][2] == g['s'][3], 'the game is plain JSON mid-hole, and played on to the end it has a winner and a card for every hole', g)
        st = await pg.evaluate("""(() => { const N = 400, d = {}, o = { holes: 0, n: 0, over: 0, half: 0, early: 0, po: 0, poText: true, putts: 0, won: true };
          for (let i = 0; i < N; i++) { const r = wGL.simGame({ seed: 5000 + i });
            if (!(r.win === 0 || r.win === 1)) o.won = false; if (r.played < 9) o.early++; if (r.played > 9) { o.po++; if (!/^at the \\d+th$/.test(r.text)) o.poText = false; }
            for (const c of r.card) { o.holes++; if (c.res < 0) o.half++; for (const s of [0, 1]) { const n = c.up[s] ? c.par + 4 : c.done[s] ? c.st[s] : c.st[s] + 1, u = n - c.par; o.over += u; o.n++; d[u] = (d[u] || 0) + 1; } }
            o.putts += r.stat[0].putts + r.stat[1].putts; }
          const sk = (a, b) => { let w = 0; for (let i = 0; i < 200; i++) if (wGL.simGame({ seed: 9000 + i, skill: [a, b] }).win === 1) w++; return w / 200; };
          return { overPar: o.over / o.n, par: (d[0] || 0) / o.n, bogey: (d[1] || 0) / o.n, birdie: ((d[-1] || 0) + (d[-2] || 0) + (d[-3] || 0)) / o.n, dbl: Object.keys(d).filter(k => +k >= 2).reduce((a, k) => a + d[k], 0) / o.n,
            half: o.half / o.holes, early: o.early / N, po: o.po / N, poText: o.poText, won: o.won, putts: o.putts / o.n, k_s: sk(0, 1), a_k: sk(1, 2) }; })()""")
        print('     the golf, Knight against Knight over 400 games:', json.dumps({k: round(v, 3) if isinstance(v, float) else v for k, v in st.items()}))
        check(0.05 <= st['overPar'] <= 0.6 and st['par'] + st['bogey'] >= 0.7, 'pars and bogeys: most holes are one or the other, a little over par a hole on average', st)
        check(0.04 <= st['birdie'] <= 0.25 and st['dbl'] < 0.15, 'a birdie now and then, and not many doubles', st)
        check(0.2 <= st['half'] <= 0.5, 'a few holes halved (a fifth to a half of them)', st)
        check(st['early'] >= 0.45 and st['won'] and 0 < st['po'] < 0.3 and st['poText'], 'about half of even matches or more settled before the 9th; every game won, a playoff when level ("at the 10th")', st)
        check(1.2 <= st['putts'] <= 2.2, 'putts a hole, given ones aside, between 1.2 and 2.2', st['putts'])
        check(st['k_s'] > 0.6 and st['a_k'] > 0.55, 'a better caddie wins more: Knight over Squire, Archmage over Knight', st)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

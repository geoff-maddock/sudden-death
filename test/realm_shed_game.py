# Realm shed (issue #102, phase 1): the stone, the ice and one game, CPU against CPU.
# The stone model: a stone slows on the ice and curls toward its handle side (out-turn left, in-turn right: a throw
# straight down the middle at draw weight comes to rest left of it, about three to five feet over); sweeping carries it
# further and straighter; worn pebble and a keen day run further, a heavy day shorter. The aim brings a draw to rest on
# its call, either handle, and sends a takeout through its stone: hit square, the stone hit leaves and the thrower stays.
# The hog line: a thrown stone that doesn't pass it is removed; a stone already in play knocked back short of it stays.
# A fast stone never passes through another. One game, CPU against CPU: Knights make most of their draws and most of
# their takeouts, ends score like curling (mostly one point or a blank, a big end rare), and every game has a winner.
# The skills: an Archmage beats a Knight, a Knight beats a Squire. simGame leaves the game on the ice and its seeded
# stream alone, and the same seed plays the same game. Asserts; exits nonzero on failure.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wCR !== 'undefined'")

        # ---------- the stone ----------
        m = await pg.evaluate("""(() => { const one = (th, o) => wCR.run([], Object.assign({ id: 't', s: 0, x0: 0 }, th), o || {}).stop;
          const out = { left: one({ ang: 0, v: 141.7, h: 1 }), right: one({ ang: 0, v: 141.7, h: -1 }), swept: one({ ang: 0, v: 132, h: 1 }, { sweep: () => 1 }), plain: one({ ang: 0, v: 132, h: 1 }) };
          const worn = wCR.iceNew().map(() => wCR.iceRules.min); out.worn = one({ ang: 0, v: 132, h: 1 }, { ice: worn }); out.keen = one({ ang: 0, v: 132, h: 1 }, { cold: 'keen' }); out.heavy = one({ ang: 0, v: 132, h: 1 }, { cold: 'heavy' });
          return out; })()""")
        check(36 <= m['left']['x'] <= 60 and -60 <= m['right']['x'] <= -36, 'out-turn curls left and in-turn right: three to five feet on a draw', m)
        check(m['swept']['y'] > m['plain']['y'] + 60 and abs(m['swept']['x']) < abs(m['plain']['x']), 'sweeping carries a stone further and straighter', m)
        check(m['worn']['y'] > m['plain']['y'] + 15 and m['keen']['y'] > m['plain']['y'] and m['heavy']['y'] < m['plain']['y'], 'worn pebble and a keen day run further, a heavy day shorter', m)

        a = await pg.evaluate("""(() => { const S = wCR.sheet, out = {};
          for (const h of [1, -1]) { const d = wCR.solveDraw(30, -20, h, null, 'mid'), r = wCR.alone({ x0: 0, ang: d.ang, v: d.v, h }, null, 'mid'); out['draw' + h] = [r.x, r.y]; }
          const hit = wCR.solveHit(0, -S.stoneR * 1.6, 205, 1, null, 'mid'), r = wCR.run([{ id: '1:0', s: 1, x: 0, y: 0 }], { id: 't', s: 0, x0: 0, ang: hit.ang, v: hit.v, h: 1 }, {});
          out.take = { out: r.out, stay: r.stones.map(x => x.s), hits: r.hits };
          // a takeout at full weight past a guard sitting right on its line: it must hit the guard, not pass through it
          const g = wCR.run([{ id: '1:0', s: 1, x: 0, y: -150 }], { id: 't', s: 0, x0: 0, ang: 0, v: 260, h: 0 }, { plan: true }); out.tunnel = g.hits;
          // the hog line: a weak throw short of it is out; a stone knocked back short of it stays (the rules' call)
          wCR.newGame({}); const weak = wCR.run([], { id: 't', s: 0, x0: 0, ang: 0, v: 110, h: 1 }, {}); out.weak = [weak.stop, weak.out];
          wCR.newGame({}); wCR.throw(0, [{ id: 'g', s: 0, x: 0, y: -200 }]); const back = wCR.throw(1, [{ id: '0:0', s: 0, x: 0, y: -S.hog - 20 }, { id: 'n', s: 1, x: 0, y: -100 }], { hit: true }); out.back = wCR.G.stones.map(x => x.id);
          return out; })()""")
        check(all(abs(a['draw' + h][0] - 30) < 2 and abs(a['draw' + h][1] + 20) < 2 for h in ['1', '-1']), 'the aim brings a draw to rest on its call, with either handle', a)
        check(a['take']['out'] == ['1:0'] and a['take']['stay'] == [0] and a['take']['hits'] == 1, 'a takeout hit square: the stone hit leaves, the thrower stays', a['take'])
        check(a['tunnel'] >= 1, 'a stone at full weight hits the guard on its line, it never passes through it', a)
        check(a['weak'][0] is None and a['weak'][1] == ['t'] and a['back'] == ['0:0', '1:0'], 'a throw short of the hog line is out; a stone in play knocked back short of it stays', a)

        # ---------- found in review ----------
        rv = await pg.evaluate("""(() => { const out = {};
          // the free guard zone: no peel of their guard before the fifth stone, and a stone the rule takes back isn't made
          wCR.start({ seed: 3, skill: [2, 2] }); const G = wCR.G; G.stones = [{ id: '0:0', s: 0, x: 0, y: -180 }, { id: '0:1', s: 0, x: 10, y: 20 }]; G.k = 3; G.hammer = 1;
          const P = wCR.plan(1); out.peel = P.shot === 'peel' && P.target === '0:0';
          // a peel weight stone wears every row of pebble it crosses
          const r = wCR.run([], { id: 't', s: 0, x0: 0, ang: 0, v: 250, h: 0 }, {}), ice = wCR.wear(wCR.iceNew(), r.path), C = wCR.iceRules;
          const rows = new Set(); ice.forEach((v, i) => { if (v < 1) rows.add(Math.floor(i / C.cols)); }); out.rows = [rows.size, C.rows];
          // a stone out of turn changes nothing
          wCR.start({ seed: 1, skill: [1, 1] }); const ice0 = JSON.stringify(wCR.G.ice), n0 = wCR.G.n, bad = wCR.throwStone(1 - wCR.up(), { shot: 'draw', x: 0, y: 0, h: 1 }, { ang: 0, v: 140, h: 1 }, null);
          out.refused = [bad.rule.ok, JSON.stringify(wCR.G.ice) === ice0, wCR.G.n === n0, wCR.G.st[0].stones + wCR.G.st[1].stones];
          // a throw refused mid-run (the game moved on) settles nothing, and only one throw runs at a time
          wCR.start({ seed: 2, skill: [1, 1] }); out.overlap = [wCR.throwStone(wCR.up(), { shot: 'draw', x: 0, y: 0, h: 1 }, { ang: -2.3, v: 141.9, h: 1 }, null).rule.ok];
          // a draw to the back of the house on keen worn ice still solves (a throw out the back is lighter next time)
          const worn = wCR.iceNew().map(() => wCR.iceRules.min); out.back = !!wCR.solveDraw(0, 40, 1, worn, 'keen');
          // value with no skill given is a Knight's
          out.value = typeof wCR.value([], 0, 5, 1) === 'number';
          return out; })()""")
        check(not rv['peel'], 'before the fifth stone the skip never calls a peel of their guard (the free guard zone would undo it)', rv)
        check(rv['rows'][0] >= rv['rows'][1] - 2 and rv['value'], 'a fast stone wears every row it crosses; value works without a skill', rv)
        check(rv['refused'] == [False, True, True, 0] and rv['back'], 'a stone out of turn changes nothing (no wear, no box score); a draw to the back of the house solves on keen, worn ice', rv)
        fz = await pg.evaluate("""(() => { let taken = 0, made = 0;
          for (let i = 0; i < 6; i++) { wCR.start({ seed: 40 + i, skill: [1, 1] }); const H = wCR.G; H.stones = [{ id: '0:0', s: 0, x: 0, y: -180 }]; H.k = 1; H.hammer = 1;
            const aim = wCR.solveHit(0, -180 - 9, 250, 1, null, 'mid'), ev = wCR.throwStone(1, { shot: 'peel', x: 0, y: -180, h: 1, target: '0:0', s: 1 }, aim, null);
            if (ev.rule.fgz) { taken++; if (ev.made) made++; } }
          return { taken, made }; })()""")
        check(fz['taken'] >= 4 and fz['made'] == 0, 'a peel the free guard zone takes back is never counted as made', fz)
        # ---------- a game ----------
        g = await pg.evaluate("""(() => { const sum = (n, sk, s0) => { const o = { n, w: [0, 0], ends: {}, e: 0, tried: {}, made: {}, over: 0 };
            for (let i = 0; i < n; i++) { const r = wCR.simGame({ seed: s0 + i, skill: sk, ends: 6 }); if (r.over) o.over++; o.w[r.win]++;
              for (const e of r.log) { const k = e.s < 0 ? 'blank' : e.n >= 3 ? 'big' : String(e.n); o.ends[k] = (o.ends[k] || 0) + 1; o.e++; }
              for (const s of [0, 1]) for (const k in r.st[s].shots) { o.tried[k] = (o.tried[k] || 0) + r.st[s].shots[k]; o.made[k] = (o.made[k] || 0) + (r.st[s].madeBy[k] || 0); } }
            o.draw = o.made.draw / o.tried.draw; o.take = ((o.made.takeout || 0) + (o.made.peel || 0)) / ((o.tried.takeout || 0) + (o.tried.peel || 0) || 1);
            for (const k in o.ends) o.ends[k] = +(o.ends[k] / o.e).toFixed(3); return o; };
          return { kk: sum(16, [1, 1], 200), ak: sum(16, [2, 1], 300), ks: sum(16, [1, 0], 400) }; })()""")
        kk = g['kk']
        check(kk['over'] == kk['n'] and .6 <= kk['draw'] <= .9 and .6 <= kk['take'] <= .88, 'Knight against Knight: every game decided, most draws and most takeouts made (a takeout is missed now and then)', kk)
        check(kk['ends'].get('1', 0) >= .3 and .02 <= kk['ends'].get('blank', 0) <= .5 and kk['ends'].get('big', 0) <= .12, 'ends score like curling: mostly one point or a blank, a big end rare', kk['ends'])
        check(g['ak']['w'][0] > g['ak']['w'][1] and g['ks']['w'][0] > g['ks']['w'][1], 'an Archmage beats a Knight, and a Knight beats a Squire', [g['ak']['w'], g['ks']['w']])

        # ---------- the sim leaves the game alone ----------
        d = await pg.evaluate("""(() => { wCR.start({ seed: 9, skill: [1, 1] }); for (let i = 0; i < 3; i++) wCR.turn(); const want = JSON.stringify(wCR.G);
          const a = wCR.simGame({ seed: 77 }), b = wCR.simGame({ seed: 77 }); wCR.simGame({});
          const same = JSON.stringify(wCR.G) === want; const s1 = (() => { wCR.start({ seed: 31, skill: [1, 1] }); for (let i = 0; i < 6; i++) wCR.turn(); return JSON.stringify(wCR.G.stones); })();
          const s2 = (() => { wCR.start({ seed: 31, skill: [1, 1] }); for (let i = 0; i < 3; i++) wCR.turn(); wCR.simGame({}); for (let i = 0; i < 3; i++) wCR.turn(); return JSON.stringify(wCR.G.stones); })();
          return { same, repeat: JSON.stringify(a.log) === JSON.stringify(b.log), stream: s1 === s2, json: want === JSON.stringify(JSON.parse(want)) }; })()""")
        check(d == {'same': True, 'repeat': True, 'stream': True, 'json': True}, 'simGame leaves the game on the ice and its seeded stream alone; the same seed plays the same game; the game is plain JSON', d)

        # ---------- the lab's switches (phase 10) ----------
        lb = await pg.evaluate("""(() => { const T = k => ({ name: k, short: 'T', roster: [0, 1, 2, 3].map(i => ({ n: k + i, kind: 'dwarf' })) });
          const held = wCR.simGame({ seed: 41, ends: 4, teams: [T('a'), T('b')], fixShot: ['guard', null] }), S = held.st[0].shots, all = Object.values(S).reduce((a, b) => a + b, 0);
          wCR.start({ seed: 42, ends: 4, teams: [T('a'), T('b')], wear: false }); const ice0 = JSON.stringify(wCR.G.ice); let n = 0; while (!wCR.G.over && n++ < 200) wCR.turn(); const fresh = JSON.stringify(wCR.G.ice) === ice0 && !!wCR.G.over && wCR.G.n >= 32;
          wCR.start({ seed: 43, ends: 4, teams: [T('a'), T('b')], noSweep: [true, false] }); n = 0; let swept0 = 0, swept1 = 0; while (!wCR.G.over && n++ < 200) { const s = wCR.up(); wCR.turn(); if (s === 0 && wCR.G.legs[0] < 1) swept0++; if (s === 1 && wCR.G.legs[1] < 1) swept1++; } const over = !!wCR.G.over;
          const sum = wCR.simGame({ seed: 44, ends: 4, powers: true, teams: [T('a'), T('b')] });
          return { guards: S.guard || 0, all, fresh, swept0, swept1: swept1 > 0 && over, arrays: Array.isArray(sum.casts) && Array.isArray(sum.pots) }; })()""")
        check(lb['guards'] >= lb['all'] * .7, 'the lab\'s fixShot: a side held to the guard throws guards', lb)
        check(lb['fresh'], 'the lab\'s wear: false: a game played out (every stone) leaves the pebble fresh', lb)
        check(lb['swept0'] == 0 and lb['swept1'], 'the lab\'s noSweep: that side spends no legs, the other side still sweeps', lb)
        check(lb['arrays'], 'a summary carries the casts and the potions', lb)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

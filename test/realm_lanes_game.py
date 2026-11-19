# Realm lanes (issue #100, phase 1): the lane, the ball, the pins and one game, CPU against CPU.
# The ball model: a right-hander's strike ball skids, then hooks left into the pocket; a left-hander's is its mirror;
# more revs hook more and a faster ball less; the spare ball barely turns; a ball off the lane is in the gutter; at
# high tide the ball skids further. aimAt finds the angle that reaches a point at the pins. The oil: a fresh house
# pattern is heavier in the middle and dry past 40 feet; a ball takes oil from its track and carries some down
# (wear never changes the grid it is given). The pins: the same seed gives the same pins; a pocket hit at a good
# angle strikes most of the time, a nose hit never does; only standing pins fall; a ball that misses them knocks none.
# One game: turn() bowls a ball and the sheet follows; simGame is the same for the same seed and leaves the game on
# the lanes alone. And the bowling looks like bowling: Knight against Knight averages about 190 with 35 to 48%
# strikes, makes most single-pin spares and no 7-10s, the 10-pin is the most common single-pin leave; Knights beat
# Squires and Archmages beat Knights. Asserts; exits nonzero on failure.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBL !== 'undefined' && typeof wBL.simGame === 'function'")

        # ---------- the oil ----------
        o = await pg.evaluate("""(() => { const H = wBL.house(), L = wBL.geo, at = (b, ft) => wBL.oilAt(H, wBL.boardX(b), ft * 12 + 6);
          const path = []; for (let y = 0; y <= 720; y += 12) path.push([wBL.boardX(10), y]);
          const before = JSON.stringify(H), W = wBL.wear(H, path), atW = (b, ft) => wBL.oilAt(W, wBL.boardX(b), ft * 12 + 6);
          return { mid: at(20, 10), out: at(3, 10), dry: at(20, 50), cells: H.length, track: [at(10, 20), atW(10, 20)], far: [at(10, 30), atW(10, 30)], back: [at(10, 52), atW(10, 52)], same: JSON.stringify(H) === before,
            mu: [wBL.mu(H, 0, 120, 'mid'), wBL.mu(H, 0, 600, 'mid'), wBL.mu(H, 0, 120, 'high'), wBL.mu(H, 0, 120, 'low')] }; })()""")
        check(o['cells'] == 39 * 60 and o['mid'] > o['out'] > 0 and o['dry'] == 0, 'a fresh house pattern: 39 boards by 60 feet, heavier in the middle than outside, dry past 40 feet', o)
        check(o['track'][1] < o['track'][0] and o['back'][1] > o['back'][0] == 0 and o['same'], 'a ball takes oil from its track and carries some past the pattern; wear leaves the grid it was given alone', o)
        check(o['mu'][0] < o['mu'][1] and o['mu'][2] <= o['mu'][0] <= o['mu'][3], 'oiled boards slide and dry ones grip; the tide weighs the oil (high slicker, low grippier)', o['mu'])

        # ---------- the ball ----------
        b = await pg.evaluate("""(() => { const H = wBL.house(), x0 = wBL.boardX(18), f = (o) => wBL.ball(Object.assign({ x0, ang: -1.4, mph: 17, rpm: 350, hand: 1, ball: 'strike' }, o), H, o.tide || 'mid');
          const R = f({}), Lh = f({ x0: -x0, ang: 1.4, hand: -1 }), hi = f({ rpm: 450 }), lo = f({ rpm: 250 }), fast = f({ mph: 19 }), slow = f({ mph: 15 }), spare = f({ ball: 'spare', ang: 0 }), off = f({ ang: -5 });
          const high = f({ tide: 'high' }), low = f({ tide: 'low' });
          let bp = 99; for (const [x] of R.path) bp = Math.min(bp, wBL.xBoard(x));
          const a = wBL.aimAt({ x0, mph: 17, rpm: 350, hand: 1, ball: 'strike' }, wBL.pocket, H, 'mid'), A = a === null ? null : wBL.ball({ x0, ang: a, mph: 17, rpm: 350, hand: 1, ball: 'strike' }, H, 'mid');
          return { R: [wBL.xBoard(R.x), R.entry, R.gutter, R.skid], bp, mirror: [wBL.xBoard(Lh.x), Lh.entry], revs: [lo.entry, R.entry, hi.entry], speed: [slow.entry, R.entry, fast.entry], spare: spare.entry, off: off.gutter,
            skid: [low.skid, R.skid, high.skid], aim: A && [A.x, A.entry, wBL.pocket] }; })()""")
        check(b['R'][2] is None and b['R'][1] > 2 and b['bp'] < 14 and b['R'][0] > b['bp'], 'a right-hander\'s strike ball goes out to its breakpoint, then hooks back left at the pins', b)
        check(abs(b['mirror'][0] + b['R'][0] - 40) < .01 and abs(b['mirror'][1] - b['R'][1]) < .01, 'a left-hander\'s ball is a right-hander\'s mirrored', b['mirror'])
        check(b['revs'][0] < b['revs'][1] < b['revs'][2] and b['speed'][0] > b['speed'][1] > b['speed'][2], 'more revs hook more; a faster ball hooks less', b)
        check(abs(b['spare']) < 1 and b['off'] is not None, 'the spare ball barely turns; a ball thrown off the lane is in the gutter', b)
        check(b['skid'][0] <= b['skid'][1] <= b['skid'][2] and b['skid'][0] < b['skid'][2], 'the ball skids further at high tide than at low', b['skid'])
        check(b['aim'] and abs(b['aim'][0] - b['aim'][2]) < 1 and 3 < b['aim'][1] < 7.5, 'aimAt finds the angle into the pocket, at a good entry angle', b['aim'])

        # ---------- the pins ----------
        d = await pg.evaluate("""(() => { const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], m = Math.tan(5 * Math.PI / 180), v = 16.5 * 17.6, run = (x, n, st) => { const out = []; for (let s = 0; s < n; s++) out.push(wBL.deck(st || all, { x, m, v, spin: .4, hand: 1 }, s * 7919 + 13).down); return out; };
          const a = wBL.deck(all, { x: wBL.pocket, m, v, spin: .4, hand: 1 }, 42), b = wBL.deck(all, { x: wBL.pocket, m, v, spin: .4, hand: 1 }, 42);
          const pocket = run(wBL.pocket, 50), nose = run(0.3, 50), sub = run(wBL.boardX(17.5), 20, [3, 6, 9, 10]), miss = run(-19, 10, [7]), ten = run(-18, 20, [10]);
          return { same: JSON.stringify(a.down) === JSON.stringify(b.down) && a.trace.length > 5, pocket: pocket.filter(x => x.length === 10).length, nose: nose.filter(x => x.length === 10).length,
            sub: sub.every(x => x.every(p => [3, 6, 9, 10].includes(p))), miss: miss.every(x => !x.length), ten: ten.filter(x => x.length === 1).length }; })()""")
        check(d['same'], 'the same throw and seed give the same pins, with a trace to draw', d)
        check(d['pocket'] >= 35 and d['nose'] == 0, 'a pocket hit at 5 degrees strikes most of the time; a nose hit never', d)
        check(d['sub'] and d['miss'] and d['ten'] >= 18, 'only standing pins fall; a ball that misses them knocks none; a ball through the 10 takes it', d)
        g = await pg.evaluate("""[wBL.groups([7, 10]), wBL.groups([3, 6, 10]), wBL.groups([2, 4, 5, 8]), wBL.groups([4, 6, 7, 10]).length, wBL.spareTarget([10]), wBL.spareTarget([3, 6, 10])]""")
        check(g[0] == [[7], [10]] and g[1] == [[3, 6, 10]] and g[2] == [[2, 4, 5, 8]] and g[3] == 2, 'the groups of standing pins: the 7-10 is two, the 3-6-10 and the bucket one, the big four two (the 4-7 and the 6-10)', g)
        check(g[4]['key'] == 10 and g[5]['key'] == 3 and g[5]['x'] > -6, 'a spare ball goes at the front pin, on the side that drives it into the rest', g[4:])

        # ---------- one game ----------
        t = await pg.evaluate("""(() => { wBL.start({ seed: 7, skill: [1, 1] }); const first = wBL.turn(), out = { keys: Object.keys(first).sort(), side: first.side, frame: first.frame, pl: first.plan.ball, fr: JSON.stringify(wBL.G.fr[0]) };
          let n = 1; while (wBL.turn()) n++; const S = wBL.summary(); out.n = n; out.over = !!wBL.G.over; out.tot = S.tot; out.balls = S.balls; out.json = JSON.stringify(JSON.parse(JSON.stringify(wBL.G))) === JSON.stringify(wBL.G);
          out.after = wBL.turn(); return out; })()""")
        check(t['keys'] == ['ball', 'down', 'frame', 'plan', 'release', 'ri', 'roll', 'said', 'side', 'tide'] and t['side'] == 0 and t['frame'] == 1 and t['pl'] == 'strike' and t['fr'] != '[]', 'turn() bowls the next ball: the plan, the release, the ball, the pins, and the sheet follows', t)
        check(t['over'] and t['after'] is None and t['balls'] == t['n'] and 20 <= t['n'] <= 60 and t['json'], 'turn() plays the game to its end, then nothing; the game (oil and all) is plain JSON', t)
        s = await pg.evaluate("""(() => { wBL.newGame(); const keep = JSON.stringify(wBL.G); const a = wBL.simGame({ seed: 11 }), b = wBL.simGame({ seed: 11 }), c = wBL.simGame({ seed: 12 });
          return { same: JSON.stringify(a.tot) === JSON.stringify(b.tot) && JSON.stringify(a.marks) === JSON.stringify(b.marks), other: JSON.stringify(a.marks) !== JSON.stringify(c.marks), kept: JSON.stringify(wBL.G) === keep }; })()""")
        check(s['same'] and s['other'] and s['kept'], 'simGame plays the same game for the same seed, another for another, and leaves the game on the lanes alone', s)

        # ---------- it looks like bowling ----------
        lab = await pg.evaluate("""(() => { const sum = (sk, n, s0) => { const A = [], st = { strikes: 0, firsts: 0, singles: 0, singleTries: 0, sevenTen: 0, sevenTenMade: 0, ro: 0 }, leaves = {}, wins = [0, 0];
            for (let i = 0; i < n; i++) { const g = wBL.simGame({ seed: s0 + i, skill: sk }); wins[g.win]++; if (g.ro) st.ro++; for (const k of [0, 1]) { A.push(g.game[k]); for (const f in st) if (g.st[k][f] != null) st[f] += g.st[k][f]; for (const l in g.st[k].leaves) leaves[l] = (leaves[l] || 0) + g.st[k].leaves[l]; } }
            const singles = Object.entries(leaves).filter(([k]) => !k.includes('-')).sort((a, b) => b[1] - a[1]);
            return { avg: A.reduce((a, b) => a + b, 0) / A.length, strike: st.strikes / st.firsts, single: st.singles / st.singleTries, sevenTen: [st.sevenTenMade, st.sevenTen], top: singles[0] && singles[0][0], wins, ro: st.ro }; };
          return { kk: sum([1, 1], 100, 3000), sk: sum([0, 1], 50, 4000), ka: sum([1, 2], 50, 5000) }; })()""")
        kk = lab['kk']
        check(180 <= kk['avg'] <= 210 and .35 <= kk['strike'] <= .48, 'Knight against Knight: games of about 190, with 35 to 48% strikes', kk)
        check(kk['single'] >= .85 and kk['sevenTen'][0] <= max(1, kk['sevenTen'][1] // 50) and kk['top'] == '10', 'most single-pin spares are made, the 7-10 almost never, and the 10-pin is the most common single-pin leave', kk)
        check(lab['sk']['wins'][1] >= 38 and lab['ka']['wins'][1] >= 32, 'Knights beat Squires, and Archmages beat Knights', [lab['sk']['wins'], lab['ka']['wins']])

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

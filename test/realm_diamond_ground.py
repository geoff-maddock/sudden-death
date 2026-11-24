# Realm diamond (issue #115, phase 4): Graftonbury Ballpark's own ways, the mound grass and the flickering floodlight.
# Off (the bare engine, its tests, the labs), nothing acts and nothing is drawn from the random stream: a seeded game is
# the same game, and a ground with both parts switched off plays it too. The mound grass: every pitch of a half-inning
# adds to it (whoever throws it: a pitching change mid-inning keeps it), and every pitch's scatter grows with it; Dusty
# rakes it between half-innings. The CPU pulls a tiring pitcher sooner in a long inning by its skill (a Squire never),
# with its reason. The floodlight: a night game draws a dim patch from the seeded random (the same seed, the same patch;
# a different place each game; none in a day game); a fly ball into it is read later (every fielder stands still a
# little longer, and plans for it) and a catch in the air there bobbles more; the CPU's batters aim at it by skill.
# Both are drawn (the patch darker, under a lamp; the grass on the mound; the conditions list), kept in the save point,
# and on in the Realm's ball games (night from the clock), off in a lab and in the Umbral. Dusty Marl has a word for
# each, the game card says what the Ballpark is like now, and How to play explains it. Asserts; exits nonzero on failure.
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

# Brimstone Diamond's draws are Math.random as the page loaded it, so the seed goes in before the page
SEED = """window.__rs = 1; Math.random = function () { let t = (window.__rs = (window.__rs + 0x6D2B79F5) | 0); t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };"""
HELP = r"""
window.__club = (id, mod) => { const d = wBD.club(id, 3); if (mod) mod(d); return d; };
window.__to = (f, max) => { let n = 0; while (!f() && n++ < (max || 60000)) wBD.step(1); return !!f(); };
window.__sel = () => wBD.G.phase === 'plate' && wBD.G.P && wBD.G.P.stage === 'select';
window.__thrown = () => wBD.G.phase === 'play' || (wBD.G.phase === 'plate' && !!wBD.G.P && !!wBD.G.P.pitch);
window.__game = o => { wBD.start(Object.assign({ innings: 3, diff: 1 }, o, { rules: Object.assign({}, W_BALL.rules, o.rules || {}) })); wBD.pause(false); };
window.__sim = (seed, ground, diff) => { window.__rs = seed; wBD.sim({ defs: [__club('ironmaw'), __club('mirewood')], innings: 3, diff: diff == null ? 1 : diff, rules: Object.assign({}, W_BALL.rules, ground === undefined ? {} : { ground }) });
  const G = wBD.G; return { R: [G.teams[0].R, G.teams[1].R], log: G.full.map(l => l.text || l).join('|'), gd: wBD.gd }; };
window.__night = { on: true, night: true };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.add_init_script(SEED)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBD !== 'undefined' && typeof wStartBall === 'function' && typeof wBparkNext === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- off: the same game ----------
        off = await pg.evaluate(r"""(() => { LAB = true; const strip = g => Object.assign(g, { log: g.log.split('|').filter(t => !/\(\d+\) at .*\(\d+\)/.test(t)).join('|') }); const a = strip(__sim(7)), b = strip(__sim(7)), c = strip(__sim(7, { on: true, night: false, grass: false, dim: false })), d = strip(__sim(7, { on: false }));
          const n = strip(__sim(7, __night));
          return { same: a.log === b.log, gdOff: a.gd, passive: c.log === a.log && !!c.gd, offRule: d.log === a.log && d.gd === null, night: n.log !== a.log, R: [a.R, n.R] }; })()""")
        check(off['same'] and off['gdOff'] is None, 'off (a lab game): no ground in the game, and a seeded game plays the same twice', off)
        check(off['passive'] and off['offRule'], 'a ground with the grass and the lights off (and ground off) is the same game: nothing drawn from the random stream', off)
        check(off['night'], 'a night game with the ground on plays differently from the same seed off', off['R'])

        # ---------- on in the Realm, off in a lab and in the Umbral ----------
        rl = await pg.evaluate("""(() => { const o = { rules: W_BALL.rules }; LAB = true; const lab = wBparkNext(o).rules.ground;
          W_BPARK.lab = { on: true, night: true }; const lab2 = wBparkNext(o).rules.ground; W_BPARK.lab = null; LAB = false;
          W_BPARK.night = null; const clock = wBparkNext(o).rules.ground;
          W_BPARK.night = true; const n = wBparkNext(o).rules.ground; W_BPARK.night = false; const d = wBparkNext(o).rules.ground; W_BPARK.night = null;
          const umb = wBparkNext({ rules: Object.assign({}, W_BALL.rules, { hexes: ['chill'], hexBy: 1 }) }).rules.ground, own = wBparkNext({ rules: { ground: { on: true, night: false } } }).rules.ground;
          return { lab: lab === undefined, lab2, clock: !!clock && clock.on && typeof clock.night === 'boolean', n, d, umb: umb === undefined, own }; })()""")
        check(rl['lab'] and rl['lab2'] == {'on': True, 'night': True}, 'in LAB mode the ground is off (the lab sets W_BPARK.lab to play it)', rl)
        check(rl['clock'] and rl['n'] == {'on': True, 'night': True} and rl['d'] == {'on': True, 'night': False}, 'on in a Realm game, night or day from the clock', rl)
        check(rl['umb'] and rl['own'] == {'on': True, 'night': False}, 'not in the Umbral (the Bone Diamond), and a game that says its own ground keeps it', rl)

        # ---------- the mound grass ----------
        gr = await pg.evaluate("""(() => { LAB = true; const out = {};
          __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood')], humanSide: 0, rules: { ground: { on: true, night: false } } }); const G = wBD.G, D = wBD.gd; __to(__sel);
          out.day = { dim: D.dim, n: D.n, grass: wBD.groundProbe.grass() };
          G.P.stage = 'windup'; G.P.t = 0; __to(__thrown); out.first = [G.P.pitch.gdGrass, G.P.pitch.gdCtrl, D.n];
          __to(__sel); D.n = 15; G.P.stage = 'windup'; G.P.t = 0; __to(__thrown); out.mid = [G.P.pitch.gdGrass, G.P.pitch.gdCtrl, D.n];
          __to(__sel); D.n = 45; G.P.stage = 'windup'; G.P.t = 0; __to(__thrown); out.full = [G.P.pitch.gdGrass, G.P.pitch.gdCtrl, D.n];
          // the half ends: Dusty rakes
          __to(__sel); D.n = 20; const h0 = G.half; G.outs = 2; G.strikes = 2; G.P.stage = 'windup'; G.P.t = 0; let n = 0; while (G.half === h0 && n++ < 40) { __to(__sel, 4000); if (G.half !== h0) break; G.strikes = 2; G.P.stage = 'windup'; G.P.t = 0; __to(__thrown, 4000); }
          out.rake = [G.half !== h0, D.n, D.tally.rakes, G.full.map(l => l.text || l).some(t => /rakes the mound/.test(t))];
          return out; })()""")
        check(gr['day']['dim'] is None and gr['day']['n'] == 0 and gr['day']['grass'] == 0, 'a day game: no dim patch (the lights are off), and the mound starts raked', gr['day'])
        check(gr['first'][0] is None and gr['first'][2] == 1, 'the first pitch of a half: no grass yet; it adds to it', gr['first'])
        check(gr['mid'] == [0.5, 1.25, 16] and gr['full'] == [1, 1.5, 46], 'fifteen pitches in: the grass half over the mound and the pitch scattering a quarter more; thirty or more: half again', gr)
        check(gr['rake'][0] and gr['rake'][1] <= 1 and gr['rake'][2] >= 1 and gr['rake'][3], 'between half-innings Dusty rakes the mound (the play-by-play says so after a long half)', gr['rake'])

        pull = await pg.evaluate("""(() => { LAB = true; const out = {};
          for (const diff of [2, 0]) {
            __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood', d => { d.diff = diff; })], humanSide: 0, rules: { ground: { on: true, night: false } } }); const G = wBD.G, D = wBD.gd; __to(__sel);
            const pt = G.teams[1].def.roster.find(p => p.pos === 'P'); pt.stam = pt.maxStam * .3; D.n = 25; G.balls = 0; G.strikes = 0;
            G.P.stage = 'windup'; G.P.t = 0; __to(__thrown); __to(() => __sel() || G.half !== 0, 4000);
            const now = G.teams[1].def.roster.find(p => p.pos === 'P');
            out[diff] = { changed: now !== pt, n: D.n, pulls: D.tally.pulls, why: G.full.map(l => l.text || l).filter(t => /go to the bullpen/.test(t)) };
          }
          return out; })()""")
        a, s = pull['2'], pull['0']
        check(a['changed'] and a['pulls'] == 1 and a['n'] >= 25 and a['why'] and 'grass' in a['why'][0], 'an Archmage pulls a tiring pitcher in a long inning, with its reason; the grass stays (the mound\'s, not the arm\'s)', a)
        check(not s['changed'] and s['pulls'] == 0, 'a Squire doesn\'t read it: the same pitcher stays', s)

        # ---------- the floodlight: the dim patch ----------
        dm = await pg.evaluate("""(() => { LAB = true; const seeds = [3, 4, 5, 6, 7], dims = seeds.map(s => __sim(s, __night).gd.dim), again = __sim(3, __night).gd.dim, day = __sim(3, { on: true, night: false }).gd.dim;
          const G = wBD.ground, ok = dims.every(d => d && Math.abs(d.a) <= G.dimA && Math.hypot(d.x, d.y) >= G.dimD[0] - .01 && Math.hypot(d.x, d.y) <= G.dimD[1] + .01 && d.r === G.dimR);
          return { distinct: new Set(dims.map(d => d.x + ',' + d.y)).size, same: JSON.stringify(again) === JSON.stringify(dims[0]), day, ok }; })()""")
        check(dm['ok'] and dm['distinct'] >= 4, 'a night game draws a dim patch out in the outfield, a different place each game', dm)
        check(dm['same'] and dm['day'] is None, 'the same seed draws the same patch; a day game none', dm)
        rd = await pg.evaluate("""(() => { LAB = true; __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood')], humanSide: 0, rules: { ground: __night } }); const D = wBD.gd, d = D.dim, P = wBD.groundProbe, Gd = wBD.ground; __to(__sel);
          const inn = P.read(true, .6, d.x, d.y), plain = P.read(false, .6, d.x, d.y), late = P.read(true, .5 + Gd.react + .05, d.x, d.y);
          const bob = [P.bob(d.x, d.y), P.bob(0, 120)];
          // a fly that lands in the patch (aimed at it), a ground ball the same way, and one hit out
          const A = Math.atan2(d.x, d.y), dist = Math.hypot(d.x, d.y); let fly = null;
          for (let v = 60; v < 170 && !fly; v += 1) { const th = 32 * Math.PI / 180, h = v * Math.cos(th); if (P.fly(h * Math.sin(A), h * Math.cos(A), v * Math.sin(th))) fly = v; }
          const ground = P.fly(90 * Math.sin(A), 90 * Math.cos(A), -5), hr = P.fly(170 * Math.cos(.5) * Math.sin(A), 170 * Math.cos(.5) * Math.cos(A), 170 * Math.sin(.5));
          return { inn, plain, late, bob, fly, ground, hr, react: Gd.react, bobK: Gd.bob }; })()""")
        check(rd['inn']['spd'] == 0 and abs(rd['inn']['react'] - rd['react']) < 1e-9 and rd['plain']['spd'] > 0 and rd['plain']['react'] == 0 and rd['late']['spd'] > 0,
              'a fly into the patch: every fielder reads it later (stands still a third of a second longer, and plans for it)', rd)
        check(abs(rd['bob'][0] / rd['bob'][1] - rd['bobK']) < 1e-9, 'a catch in the air in the patch bobbles almost twice as often (the same one roll)', rd['bob'])
        check(rd['fly'] is not None and rd['ground'] is False and rd['hr'] is False, 'only a fly ball that would land in the patch counts (not a ground ball, not one hit out)', rd)
        tl = await pg.evaluate("""(() => { LAB = true; const t = { fly: 0, flyOut: 0, catches: 0, aims: 0 }, day = { fly: 0, aims: 0 }; const lines = [];
          for (let i = 0; i < 30; i++) { const g = __sim(100 + i, __night, 1 + i % 2); for (const k in t) t[k] += g.gd.tally[k]; if (/loses it under the flickering light/.test(g.log)) lines.push(i); }
          for (let i = 0; i < 10; i++) { const g = __sim(100 + i, { on: true, night: false }, 2); day.fly += g.gd.tally.fly; day.aims += g.gd.tally.aims; }
          const sq = __sim(100, __night, 0).gd.tally.aims;
          return { t, day, sq, lines: lines.length }; })()""")
        check(tl['t']['fly'] > 0 and tl['t']['catches'] > 0 and tl['t']['flyOut'] <= tl['t']['fly'], 'in night games fly balls go into the patch and are caught there (or not)', tl)
        check(tl['t']['aims'] > 0 and tl['sq'] == 0 and tl['day'] == {'fly': 0, 'aims': 0}, 'the CPU\'s batters aim at the patch (a Knight and up; a Squire never), and nobody does in a day game', tl)
        aim = await pg.evaluate("""(() => { LAB = true; const out = {};
          for (const diff of [2, 0]) {
            __game({ mode: '1p', defs: [__club('ironmaw', d => { d.diff = diff; }), __club('mirewood')], humanSide: 1, rules: { ground: __night } }); const G = wBD.G, D = wBD.gd;
            D.dim = { x: 150, y: 210, r: 55, a: 35.5 }; let seen = null, n = 0;
            while (!seen && n++ < 40) { __to(__sel, 4000); G.balls = 0; G.strikes = 0; G.P.stage = 'windup'; G.P.t = 0; __to(__thrown, 4000); const c = G.P && G.P.cpu; if (c && c.swing) seen = { aim: c.gdAim, hand: wBD.G.teams[0].def.roster[G.teams[0].idx].hand }; }
            out[diff] = seen;
          }
          return out; })()""")
        k = aim['2']
        check(k and k['aim'] is not None and abs(k['aim']) > 0, 'an Archmage batter times the swing toward the patch', aim)
        check(aim['0'] and aim['0']['aim'] is None, 'a Squire batter doesn\'t', aim)

        # ---------- drawn on the field ----------
        dr = await pg.evaluate("""(() => { LAB = true; __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood')], humanSide: 0, rules: { ground: __night } }); __to(__sel); const D = wBD.gd;
          D.n = 0; const a = wBD.groundProbe.paint(); D.n = 24; const b = wBD.groundProbe.paint();
          __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood')], humanSide: 0, rules: { ground: { on: true, night: false } } }); __to(__sel); wBD.gd.n = 24; const day = wBD.groundProbe.paint();
          __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood')], humanSide: 0 }); __to(__sel); const off = wBD.groundProbe.paint();
          return { a, b, day, off }; })()""")
        check(dr['a']['field'] > 0 and dr['a']['plate'] > 0 and dr['a']['dimAt'] > 0 and dr['a']['offAt'] == 0 and dr['a']['hud'] > 0, 'a night game: the dim patch is drawn darker (and its lamp) in both views, and named in the conditions list', dr['a'])
        check(dr['b']['field'] > dr['a']['field'] and dr['b']['plate'] > dr['a']['plate'], 'the grass is drawn creeping over the mound as the half goes on', [dr['a'], dr['b']])
        check(dr['day']['field'] > 0 and dr['day']['dimAt'] == 0 and dr['off'] == {'field': 0, 'plate': 0, 'hud': 0, 'dimAt': 0, 'offAt': 0}, 'a day game draws only the grass; a game without the ground draws nothing', [dr['day'], dr['off']])

        # ---------- a Realm game: night from the clock, Dusty's word, the save point ----------
        await pg.evaluate("""(() => { LAB = false; wStart(null, { club: CLUB_IDS[0] });
          for (const kind of ['harpy', 'witch', 'golem', 'dwarf', 'elf']) wRecruit({ kind, lvl: 3 }, 'tavern');
          WG.nine = null; wNineSync(); wDrain(); W_BPARK.night = true; })()""")
        await pg.evaluate("wOpenBallCard()"); await pg.wait_for_selector('#wBallGround')
        card = await pg.evaluate("document.getElementById('wBallGround').textContent")
        check('night game' in card and 'flicker' in card and 'mound grass' in card, 'the game card says what the Ballpark is like now', card)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
        await pg.evaluate("(() => { wBall().met = {}; return wStartBall({ club: 'local', how: 'play' }); })()")
        await pg.wait_for_function("UI.view === 'diamond' && wBD.live && !!wBD.gd")
        await pg.evaluate("wBD.pause(true)")
        live = await pg.evaluate("""(() => { __to(__sel); const D = wBD.gd; D.n = 7; wBD.snapNow(); const sn = WG.ball.live.snap;
          return { night: D.night, dim: D.dim, rule: wBD.G.rules.ground, snap: sn && sn.gd, said: wBD.G.full.map(l => l.text || l).filter(t => /^Dusty Marl:/.test(t)) }; })()""")
        check(live['rule'] == {'on': True, 'night': True} and live['night'] and live['dim'], 'a ball game you play at night has the ground and the dim patch', live)
        check(live['said'] and 'floodlight' in live['said'][0] and 'mound' in live['said'][0], 'Dusty Marl says his piece before the first pitch', live['said'])
        check(live['snap'] and live['snap']['n'] == 7 and live['snap']['dim'] == live['dim'], 'the save point keeps the mound grass and the dim patch', live['snap'])
        await pg.evaluate("wBallLeave()"); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate("W_BPARK.night = false; wResumeBall()")
        await pg.wait_for_function("UI.view === 'diamond' && wBD.live && !!wBD.gd")
        back = await pg.evaluate("({ n: wBD.gd.n, dim: wBD.gd.dim, night: wBD.gd.night })")
        check(back['n'] == 7 and back['dim'] == live['dim'] and back['night'], 'Save and leave, then Resume (by day now): the grass and the patch come back as they were', back)
        await pg.evaluate("wBallConcede()"); await pg.wait_for_selector('#cfYes'); await pg.click('#cfYes')
        await pg.wait_for_function("!wBallLive()")

        # ---------- Dusty Marl, How to play ----------
        dusty = await pg.evaluate("""(() => { const K = DB.chars.gk_ballpark, T = K.topics; return { job: T.job.t, mound: T.mound && T.mound.t, lights: T.lights && T.lights.t,
          caps: Object.values(T).flatMap(t => (t.t.match(/\\b[A-Z]{3,}\\b/g) || [])).filter(w => !T[w.toLowerCase()]) }; })()""")
        check('MOUND' in dusty['job'] and 'LIGHTS' in dusty['job'] and dusty['mound'] and 'rake' in dusty['mound'] and dusty['lights'] and 'flicker' in dusty['lights'], 'Dusty Marl has a word for the MOUND and the LIGHTS', dusty)
        check(not dusty['caps'], 'every ALL-CAPS word Dusty says is one of his topics', dusty['caps'])
        hp = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpBallGround'), p = document.getElementById('wHelpBallPow'); return { t: e ? e.textContent : '', after: !!(e && p && p.nextElementSibling === e) }; })()")
        check('mound grass' in hp['t'] and 'floodlight' in hp['t'] and 'night' in hp['t'] and 'day game' in hp['t'] and hp['after'], 'How to play explains the Ballpark\'s ways, after the powers', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILED: %d' % len(FAILS) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

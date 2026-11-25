# Realm lists (issue #117, phase 8): the Tilting Lists' ways, the churned sand and the pennant wind.
# The engine: a match has no ground unless asked, and with it off a seeded match rides exactly the same and keeps no
# state; on, the same seed rides the same match twice (and not the match without it); it starts raked smooth with a
# wind drawn and Sir Ruddock's line; each course cuts each lane's rut by its pace (half beside the rut), and the lists are
# raked at a heat's end; a line's sway and speed follow the rut's depth (the rut steadier and slower, beside it jolted at
# full pace, the same on smooth sand); the wind pushes the two riders' tips opposite ways on their targets, more at a
# gallop, and its gusts add sway; a CPU ride gets the line's speed and the wind's push less what its hands aim into it
# (a Squire none, a Knight most); the wind comes and goes within its bounds, drawn before each course; the CPU picks a
# line by skill (a Squire on a whim, a Knight and an Archmage on the model) and says so with the wind in its reason, an
# Archmage choosing how far to aim into the wind; your squire's word picks your line and says where to hold the tip; on
# Play your line is yours (select) and your tip drifts with the wind as the gap closes; their line stays hidden until the
# course is committed; the snapshot keeps it all; the tilting yard never has it; on and off over a few hundred seeded
# matches it leaves an even match even.
# The Realm: every match at the Lists has the ground (the exhibition, matches from the world and Simulate), the yard
# doesn't, LAB leaves it out unless W_JTGND.lab asks, and a match that says ground: false has none; the Line row before
# your course picks your line (and L swaps it); the course log names each course's wind and lines; Sir Ruddock has the
# SAND and the WIND; How to play explains both. Asserts; exits nonzero on failure. Screenshot: /tmp/realm-lists-ground.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:900]))
    if not ok: FAILS.append(what)
    return ok

N_MEASURE = 200    # seeded matches a side of the on and off measure
HELP = r"""
window.__T = (ks, j) => ({ name: 'T' + (j || 0) + ks.join(''), short: ks[0].slice(0, 3), roster: ks.map((k, i) => ({ n: k + i + (j || 0), kind: k })) });
window.__to = (f, max) => { let n = 0; while (!f() && n++ < (max || 20000)) wJT.tick(0.05); return !!f(); };
window.__rng = n => { let a = n >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
window.__K = () => { const k = Object.keys(wJT.kinds).filter(x => x !== '_'); return (i, j) => __T([0, 1, 2, 3].map(m => k[(i * 5 + m * 3 + j * 7) % k.length]), j); };
0"""
A = "['werewolf', 'elf', 'gorgon', 'spider']"
B = "['minotaur', 'golem', 'harpy', 'ogre']"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined' && typeof W_JTGND === 'object'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)
        RU = await pg.evaluate("wJT.groundRules")

        # ---------- off and on ----------
        e = await pg.evaluate(f"""(() => {{ const T = [__T({A}), __T({B}, 1)], k = s => JSON.stringify([s.log, s.st, s.tot]), out = {{}};
          const a = wJT.simMatch({{ seed: 21, skill: [1, 1], teams: T }}), b = wJT.simMatch({{ seed: 21, skill: [1, 1], teams: T, ground: false }});
          const c = wJT.simMatch({{ seed: 21, skill: [1, 1], teams: T, ground: true }}), d = wJT.simMatch({{ seed: 21, skill: [1, 1], teams: T, ground: true }});
          out.same = [k(a) === k(b), a.ground === undefined, k(c) === k(d), k(c) !== k(a), !!c.ground];
          wJT.start({{ seed: 22, teams: T }}); wJT.pause(true); out.bare = [wJT.G.ground === undefined, wJT.ground === null, wJT.gndPush(0, 'gallop'), JSON.stringify(wJT.lineK(0, 'rut')), (wJT.plan(0) || {{}}).line === undefined];
          wJT.start({{ seed: 22, teams: T, ground: true, mode: 'watch' }}); wJT.pause(true); const g = wJT.ground;
          out.on = {{ rut: g.rut, k: g.wind.k, dir: g.wind.dir, said: g.said, n: g.n, tally: g.tally }};
          return out; }})()""")
        check(e['same'][:2] == [True, True], 'off (left out or false), a seeded match rides exactly the same and keeps no ground', e['same'])
        check(e['same'][2:] == [True, True, True], 'on, the same seed rides the same match twice, and not the match without it', e['same'])
        check(e['bare'] == [True, True, 0, '{"sway":1,"speed":1}', True], 'the bare engine has no ground: no push, no line, a plan with no line', e['bare'])
        o = e['on']
        check(o['rut'] == [0, 0] and RU['wind']['lo'] <= o['k'] <= RU['wind']['hi'] and o['dir'] in (1, -1) and 'Sir Ruddock' in o['said'] and 'Raked smooth' in o['said'] and o['n'] == 0,
              'start({ ground: true }): the sand raked smooth, a wind drawn within its bounds, Sir Ruddock\'s line', o)

        # ---------- the churned sand ----------
        r = await pg.evaluate(f"""(() => {{ const out = {{}}; wJT.start({{ seed: 23, courses: 3, teams: [__T({A}), __T({B}, 1)], ground: true, lineBy: ['rut', 'side'], cornerBy: ['none', 'none'],
            fix: [{{ aim: 'shield', guard: 'square', pace: 'gallop' }}, {{ aim: 'shield', guard: 'square', pace: 'gallop' }}] }}); wJT.pause(true); const G = wJT.G;
          const ev = wJT.turn(); out.one = G.ground.rut.slice(); out.lines = ev.rides.map(x => x.gnd && x.gnd.line); out.log = G.ground.log[0];
          // a canter cuts less
          wJT.start({{ seed: 23, courses: 3, teams: [__T({A}), __T({B}, 1)], ground: true, lineBy: ['rut', 'rut'], cornerBy: ['none', 'none'],
            fix: [{{ aim: 'shield', guard: 'square', pace: 'canter' }}, {{ aim: 'shield', guard: 'square', pace: 'gallop' }}] }}); wJT.pause(true);
          wJT.turn(); out.canter = wJT.G.ground.rut.slice();
          // to the heat's end: raked
          let n = 0, heat = wJT.G.heat, raked = null, before = null; while (wJT.G.heat === heat && !wJT.G.over && n++ < 10) {{ before = wJT.G.ground.rut.slice(); const ev2 = wJT.turn(); if (ev2.rule.heatOver) raked = [wJT.G.ground.rut.slice(), ev2.gnd && ev2.gnd.rake, wJT.G.ground.said]; }}
          out.raked = raked; out.before = before; out.rakes = wJT.G.ground.tally.rakes;
          return out; }})()""")
        cut = RU['cut']
        check(r['one'] == [cut['gallop'], round(cut['gallop'] * RU['side'], 3)] and r['lines'] == ['rut', 'side'], 'a gallop cuts the lane\'s rut, half as much ridden beside it', r)
        check(r['canter'] == [cut['canter'], cut['gallop']] and cut['canter'] < cut['gallop'], 'a canter cuts it less than a gallop', r['canter'])
        check(r['log'] and r['log']['rut'] == [0, 0] and r['log']['line'] == ['rut', 'side'] and r['log']['wind'], 'each course is logged with the ruts it was ridden on, the lines and the wind', r['log'])
        check(r['raked'] and r['raked'][0] == [0, 0] and r['raked'][1] is True and 'rakes' in r['raked'][2] and max(r['before']) > 0 and r['rakes'] == 1, 'Sir Ruddock rakes the lists at the heat\'s end: the next heat starts smooth', r)
        lk = await pg.evaluate(f"""(() => {{ wJT.start({{ seed: 24, teams: [__T({A}), __T({B}, 1)], ground: true }}); wJT.pause(true); const G = wJT.G, out = {{}};
          out.smooth = [wJT.lineK(0, 'rut'), wJT.lineK(0, 'side')]; G.ground.rut[0] = .5; out.half = [wJT.lineK(0, 'rut'), wJT.lineK(0, 'side'), wJT.lineK(1, 'rut')];
          return out; }})()""")
        R2, J2 = RU['rut'], RU['jolt']
        check(lk['smooth'][0] == {'sway': 1, 'speed': 1} and lk['smooth'][1] == {'sway': 1, 'speed': 1}, 'on smooth sand the two lines are the same', lk['smooth'])
        h = lk['half']
        check(abs(h[0]['sway'] - (1 - R2['sway'] * .5)) < 1e-9 and abs(h[0]['speed'] - (1 - R2['speed'] * .5)) < 1e-9 and abs(h[1]['sway'] - (1 + J2['sway'] * .5)) < 1e-9 and h[1]['speed'] == 1 and h[2] == {'sway': 1, 'speed': 1},
              'in a half-deep rut the tip is steadier and the mount slower; beside it the mount keeps its pace and the aim jolts; the other lane is its own', h)

        # ---------- the pennant wind ----------
        w = await pg.evaluate(f"""(() => {{ wJT.start({{ seed: 25, teams: [__T({A}), __T({B}, 1)], ground: true }}); wJT.pause(true); const G = wJT.G, out = {{}};
          G.ground.wind = {{ k: .5, dir: 1 }}; out.p = [wJT.gndPush(0, 'canter'), wJT.gndPush(1, 'canter'), wJT.gndPush(0, 'gallop')];
          G.ground.wind = {{ k: .5, dir: -1 }}; out.q = [wJT.gndPush(0, 'canter'), wJT.gndPush(1, 'canter')];
          out.words = [wJT.windWords({{ k: .1, dir: 1 }}), wJT.windWords({{ k: .9, dir: -1 }})];
          // a CPU ride: its line's speed, the wind's push less what its hands aim into it (the same stream with and without)
          const plan = {{ aim: 'body', guard: 'square', pace: 'gallop' }}, o = {{ plan, rs: wJT.rs(''), mount: 'destrier', wind: 1, hands: {{ aim: 1, couch: .3 }} }};
          const g = {{ line: 'rut', sway: 1, speed: .9, push: 3, into: 1 }}, x0 = wJT.charge(o, __rng(9)), x1 = wJT.charge(Object.assign({{ gnd: g }}, o), __rng(9));
          out.ride = [+(x1.speed / x0.speed).toFixed(9), +(x1.tip.x - x0.tip.x).toFixed(9), +(x1.tip.y - x0.tip.y).toFixed(9), x1.gnd];
          // its sway goes through the hands' spread: twice the sway, twice the miss
          const g2 = {{ line: 'side', sway: 2, speed: 1, push: 0, into: 0 }}, x2 = wJT.charge(Object.assign({{ gnd: g2 }}, o), __rng(9)), A = wJT.planRules.aim.body;
          out.sway = +((x2.tip.x - A.x) / (x0.tip.x - A.x)).toFixed(6);
          // the wind comes and goes: drawn before each course, within its bounds, and it turns now and then
          G.ground.wind = {{ k: .5, dir: 1 }}; const seen = []; let n = 0; while (!G.over && n++ < 30) {{ wJT.turn(); if (!G.over) seen.push([G.ground.wind.k, G.ground.wind.dir, G.ground.n === G.n]); }}
          out.seen = {{ ok: seen.every(v => v[0] >= {RU['wind']['lo']} && v[0] <= {RU['wind']['hi']} && v[2]), ks: new Set(seen.map(v => v[0])).size, n: seen.length }};
          // the Knight aims into it, the Squire doesn't
          wJT.start({{ seed: 26, skill: [0, 1], teams: [__T({A}), __T({B}, 1)], ground: true, fix: [plan, plan] }}); wJT.pause(true); wJT.G.ground.wind = {{ k: .8, dir: 1 }};
          const ev = wJT.turn(); out.into = ev.rides.map(x => x.gnd); out.full = [wJT.groundRules.wind.push * .8 * wJT.groundRules.wind.gallop];
          // its gusts throw the tip about too: more the harder it blows, more at a gallop; nothing with the wind left out
          wJT.start({{ seed: 27, teams: [__T({A}), __T({B}, 1)], ground: true }}); wJT.pause(true); wJT.G.ground.wind = {{ k: .8, dir: 1 }};
          out.gust = [wJT.gustK('canter'), wJT.gustK('gallop')]; wJT.G.ground.wind.k = .05; out.gust.push(wJT.gustK('gallop'));
          wJT.start({{ seed: 27, teams: [__T({A}), __T({B}, 1)], ground: {{ wind: false }} }}); wJT.pause(true); wJT.G.ground.wind = {{ k: .8, dir: 1 }}; out.gust.push(wJT.gustK('gallop'), wJT.gndPush(0, 'gallop'));
          return out; }})()""")
        P6 = RU['wind']['push'] * .5
        check(abs(w['p'][0] + P6) < 1e-9 and abs(w['p'][1] - P6) < 1e-9 and abs(w['p'][2] + P6 * RU['wind']['gallop']) < 1e-9 and w['q'] == [P6, -P6],
              'the wind pushes the two tips opposite ways on their targets (from the gallery: yours toward their shield, theirs toward your body), more at a gallop, and turns with the wind', w)
        check('breath' in w['words'][0] and 'from the gallery' in w['words'][0] and 'stiff' in w['words'][1] and 'toward the gallery' in w['words'][1], 'the wind in words: how hard and which way', w['words'])
        check(w['ride'][0] == .9 and w['ride'][1] == 2 and w['ride'][2] == 0 and w['ride'][3]['line'] == 'rut', 'a ride on the ground: the line\'s speed, and the wind\'s push less what the hands aim into it, on the same stream', w['ride'])
        check(w['sway'] == 2, 'a line\'s sway goes through the hands\' spread', w['sway'])
        check(w['seen']['ok'] and w['seen']['ks'] >= 3 and w['seen']['n'] >= 4, 'the wind is drawn before each course, within its bounds, and comes and goes', w['seen'])
        sq, kn = w['into']
        check(sq['into'] == 0 and abs(abs(sq['push']) - w['full'][0]) < 1e-3 and abs(kn['into'] - kn['push'] * RU['into'][1]) < 2e-3 and kn['into'] != 0, 'a Squire doesn\'t mind the wind; a Knight aims most of it back', w['into'])
        gs, WR = w['gust'], RU['wind']
        check(abs(gs[0] - (1 + WR['gust'] * .8)) < 1e-9 and abs(gs[1] - (1 + WR['gust'] * .8 * WR['gallop'])) < 1e-9 and gs[2] < gs[1] and gs[3] == 1 and gs[4] == 0,
              'the wind\'s gusts add sway, more the harder it blows and at a gallop; with the wind left out (a lab), no gusts and no push', gs)

        # ---------- the CPU's line by skill, your squire's word ----------
        c = await pg.evaluate(f"""(() => {{ const out = {{ sq: {{}}, kn: {{}}, am: {{}} }};
          for (const [key, sk] of [['sq', 0], ['kn', 1], ['am', 2]]) for (let i = 0; i < 6; i++) {{
            wJT.start({{ seed: 40 + i, courses: 5, skill: [sk, sk], teams: [__T({A}), __T({B}, 1)], ground: true }}); wJT.pause(true); const G = wJT.G;
            const P0 = wJT.plan(0); out[key].smooth = (out[key].smooth || 0) + (P0.line === 'rut' && /the sand smooth/.test(P0.why) ? 1 : 0);
            wJT.turn(); wJT.turn(); G.ground.rut = [.5, .5]; G.ground.wind = {{ k: .8, dir: i % 2 ? 1 : -1 }}; const P = wJT.plan(0);
            out[key][P.line] = (out[key][P.line] || 0) + 1; out[key].why = P.why; out[key].into = (out[key].into || []).concat([P.into === undefined ? null : P.into]);
          }}
          wJT.start({{ seed: 50, courses: 5, mode: 'play', teams: [__T({A}), __T({B}, 1)], ground: true }}); __to(() => wJT.phase === 'plan'); wJT.pause(true);
          out.word0 = wJT.view.sel; wJT.G.ground.rut[0] = .6; wJT.G.ground.wind = {{ k: .9, dir: 1 }}; wJT.select({{ suggest: true }}); out.word = wJT.view.sel;
          return out; }})()""")
        check(c['sq']['smooth'] == 6 and c['kn']['smooth'] == 6 and c['am']['smooth'] == 6, 'on smooth sand every skill rides the rut, and says the sand is smooth', c)
        check(c['sq'].get('rut', 0) > 0 and c['sq'].get('side', 0) > 0 and 'on a whim' in c['sq']['why'] and 'not minding' in c['sq']['why'], 'a Squire picks a line on a whim and doesn\'t mind the wind', c['sq'])
        check(('% deep' in c['kn']['why']) and 'into a' in c['kn']['why'] and all(x is None for x in c['kn']['into']), 'a Knight works out the line on the model and aims into the wind as far as its hands can, and says so', c['kn'])
        check(('% deep' in c['am']['why']) and all(x in (0, .45, .9) for x in c['am']['into']) and ('into a' in c['am']['why'] or 'carry the tip' in c['am']['why']), 'an Archmage works out the line and how far to aim into the wind (none, half or all), and says so', c['am'])
        wd = c['word']
        check(wd['line'] in ('rut', 'side') and ('ride the rut' in wd['why'] or 'ride beside the rut' in wd['why']) and ('of your mark' in wd['why'] or 'let it carry your tip' in wd['why']) and 'ride the rut (the sand is smooth)' in c['word0']['why'],
              'your squire\'s word picks your line and says where to hold your tip in the wind', c['word'])

        # ---------- on Play: your line, your tip in the wind, their line hidden ----------
        pl = await pg.evaluate(f"""(() => {{ wJT.start({{ seed: 51, mode: 'play', teams: [__T({A}), __T({B}, 1)], ground: true }}); __to(() => wJT.phase === 'plan'); wJT.pause(true); const out = {{}};
          out.sel = [wJT.select({{ line: 'side' }}), wJT.view.sel.line, wJT.select({{ line: 'nowhere' }}) !== '', wJT.select({{ line: 'rut', aim: 'body' }}), wJT.view.sel.line, wJT.view.sel.aim];
          out.hidden = [wJT.view.ground.line[1], wJT.view.ground.push[1], wJT.view.ground.line[0]];
          wJT.G.ground.wind = {{ k: .8, dir: 1 }}; wJT.press(); const C = () => wJT.view.charge;
          __to(() => C().p > wJT.playRules.spur.until + .02); wJT.couch(true); __to(() => C().p > .8);
          const t1 = C().tip.x; wJT.G.ground.wind.dir = -1; wJT.tick(0); const t2 = C().tip.x, p = C().p;
          const cl = Math.min(1, Math.max(0, (p - wJT.groundRules.wind.close) / (1 - wJT.groundRules.wind.close)));
          out.drift = [+(t2 - t1).toFixed(6), +(2 * Math.abs(wJT.gndPush(0, wJT.view.plans[0].pace)) * cl).toFixed(6), cl > 0, wJT.view.plans[0].pace];
          out.shown = [wJT.view.ground.line[1] !== null, wJT.view.ground.push[1] !== null];
          wJT.couch(false); __to(() => wJT.phase === 'after' || wJT.phase === 'over' || wJT.phase === 'seat'); if (wJT.phase === 'seat') __to(() => wJT.phase === 'after' || wJT.phase === 'over');
          const L = wJT.G.ground.log[0]; out.ridden = L && L.line[0];
          return out; }})()""")
        check(pl['sel'][0] == '' and pl['sel'][1] == 'side' and pl['sel'][2] and pl['sel'][3] == '' and pl['sel'][4] == 'rut' and pl['sel'][5] == 'body', 'on Play your line is yours to pick (with the rest of the plan, or alone)', pl['sel'])
        check(pl['hidden'][0] is None and pl['hidden'][1] is None and pl['hidden'][2] == 'rut', 'their line and pace (the push on their tip) stay hidden until the course is committed', pl['hidden'])
        check(abs(pl['drift'][0] - pl['drift'][1]) < 1e-6 and pl['drift'][2], 'your tip drifts with the wind as the gap closes (the wind turned, it drifts the other way)', pl['drift'])
        check(pl['shown'] == [True, True] and pl['ridden'] == 'rut', 'once committed their line shows; the course is ridden on your line', pl)

        # ---------- kept, the yard ----------
        sn = await pg.evaluate(f"""(() => {{ wJT.start({{ seed: 52, mode: 'manage', teams: [__T({A}), __T({B}, 1)], ground: true }}); __to(() => wJT.phase === 'plan'); wJT.pause(true);
          wJT.press(); __to(() => wJT.phase === 'plan'); wJT.pause(true); const g0 = JSON.stringify(wJT.ground), sn = JSON.parse(JSON.stringify(wJT.snapshot()));
          wJT.start({{ seed: 1, teams: [__T({A}), __T({B}, 1)] }}); wJT.resume(sn); wJT.pause(true); const g1 = JSON.stringify(wJT.ground);
          const n0 = wJT.G.ground.log.length; let n = 0; while (wJT.G.ground.log.length <= n0 && !wJT.G.over && n++ < 40000) {{ if (wJT.phase === 'plan') wJT.press(); wJT.tick(.05); }}
          const out = [g0 === g1, !!sn.G.ground, wJT.G.ground.log.length > n0];
          wJT.start({{ seed: 53, yard: {{ runs: 2 }}, teams: [__T({A})], ground: true, mode: 'play' }}); wJT.pause(true); out.push(wJT.G.ground === undefined, wJT.view.ground === null);
          return out; }})()""")
        check(sn[:3] == [True, True, True], 'a snapshot keeps the ground (the ruts, the wind, the log), and a resumed match plays on with it', sn)
        check(sn[3:] == [True, True], 'the tilting yard never has the ground', sn)

        # ---------- on and off, measured ----------
        ms = await pg.evaluate(f"""(() => {{ const T = __K(), out = {{}};
          for (const [label, o] of [['off', {{}}], ['on', {{ ground: true }}]]) {{ const S = {{ w0: 0, pts: 0, courses: 0, breaks: 0, unh: 0, side: 0, lines: 0 }};
            for (let i = 0; i < {N_MEASURE}; i++) {{ const s = wJT.simMatch(Object.assign({{ seed: 900 + i, skill: [1, 1], teams: [T(i, 0), T(i, 1)] }}, o));
              if (s.win === 0) S.w0++; S.pts += s.tot[0] + s.tot[1]; S.courses += s.courses; for (const b of s.st) {{ S.breaks += b.breaks; S.unh += b.unhorse; }}
              if (s.ground) {{ S.side += s.ground.tally.side[0] + s.ground.tally.side[1]; S.lines += s.ground.tally.side[0] + s.ground.tally.side[1] + s.ground.tally.rut[0] + s.ground.tally.rut[1]; }} }}
            out[label] = {{ win0: +(100 * S.w0 / {N_MEASURE}).toFixed(1), pts: +(S.pts / {N_MEASURE}).toFixed(2), brk: +(S.breaks / S.courses / 2).toFixed(3), unh: +(S.unh / {N_MEASURE}).toFixed(3), side: S.lines ? +(S.side / S.lines).toFixed(2) : null }}; }}
          return out; }})()""")
        print('   measured (Knights, %d seeded matches each): %s' % (N_MEASURE, json.dumps(ms)))
        check(abs(ms['on']['win0'] - 50) < 9 and abs(ms['off']['win0'] - 50) < 9, 'an even match stays even with the ground on', ms)
        check(.4 < ms['on']['brk'] < .65 and abs(ms['on']['brk'] - ms['off']['brk']) < .06 and .15 < ms['on']['side'] < .6, 'lances break at jousting\'s rate with the ground on, and Knights ride both lines', ms)

        # ---------- the Realm ----------

        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); (() => { for (const kind of ['elf', 'spider', 'gorgon']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); })()")
        rl = await pg.evaluate("""(() => { const out = {}, T = [__T(['elf', 'elf', 'elf', 'elf']), __T(['ogre', 'ogre', 'ogre', 'ogre'], 1)];
          wListsGame({ seed: 60, mode: 'watch' }); wJT.pause(true); out.joust = !!wJT.G.ground;
          wListsGame({ seed: 60, mode: 'watch', ground: false }); wJT.pause(true); out.no = wJT.G.ground === undefined;
          LAB = true; wListsGame({ seed: 61, mode: 'watch' }); wJT.pause(true); out.lab = wJT.G.ground === undefined; W_JTGND.lab = true; wListsGame({ seed: 61, mode: 'watch' }); wJT.pause(true); out.labOn = !!wJT.G.ground; W_JTGND.lab = false; LAB = false;
          out.bare = wJT.simMatch({ seed: 62, teams: T }).ground === undefined;
          return out; })()""")
        check(rl['joust'] and rl['no'], 'the exhibition at the Lists has the ground; a match that says ground: false has none', rl)
        check(rl['lab'] and rl['labOn'], 'LAB mode leaves it out unless W_JTGND.lab asks', rl)
        check(rl['bare'], 'the engine called bare (as its tests are) has none', rl)
        wr = await pg.evaluate("""(() => { const out = {}; out.opts = wListsOpts(wListsMine(), wListsOpp('local', 1), 1).ground === true;
          wListsYard(); out.yard = wJT.G.ground === undefined && $('wListsRowLine').hidden; wJT.pause(true); wLeaveLists();
          const why = wStartLists({ club: 'local', how: 'manage' }); out.match = [why, !!wJT.G.ground, UI.view]; wJT.pause(true);
          return out; })()""")
        check(wr['opts'] and wr['yard'] and wr['match'] == ['', True, 'lists'], 'matches from the world (and Simulate) have the ground; the yard doesn\'t', wr)
        ui = await pg.evaluate("""(() => { const out = {}; __to(() => wJT.phase === 'plan'); wJT.pause(true); wListsRows(); const row = $('wListsRowLine');
          out.row = [!row.hidden, row.querySelectorAll('[data-jf="line"]').length, /Your lane/.test(row.textContent)];
          const b = row.querySelector('[data-jv="side"]'); b.click(); out.click = wJT.view.sel.line;
          wJT.pause(false); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true })); out.key = wJT.view.sel.line; wJT.pause(true);
          out.on = !!$('wListsRowLine').querySelector('[data-jv="rut"].on');
          let n = 0; while (wJT.G.log.length < 2 && !wJT.G.over && n++ < 40000) { if (wJT.phase === 'plan') wJT.press(); wJT.tick(.05); }
          wListsBoard(); out.log = document.querySelectorAll('#wListsLog .wjtgnd').length; out.logText = (document.querySelector('#wListsLog .wjtgnd') || {}).textContent || '';
          return out; })()""")
        check(ui['row'] == [True, 2, True] and ui['click'] == 'side' and ui['key'] == 'rut' and ui['on'], 'before your course the Line row picks your line, and L swaps it', ui)
        check(ui['log'] >= 2 and 'wind' in ui['logText'] and ('rut' in ui['logText'] or 'smooth sand' in ui['logText']), 'the course log names each course\'s wind and lines', ui)
        await pg.screenshot(path='/tmp/realm-lists-ground.png')
        dl = await pg.evaluate("""(() => { const K = DB.chars.gk_lists.topics; return { job: /SAND/.test(K.job.t) && /WIND/.test(K.job.t), sand: /rut/.test((K.sand || {}).t || '') && /rake/.test(K.sand.t), wind: /pennants/.test((K.wind || {}).t || '') }; })()""")
        check(dl == {'job': True, 'sand': True, 'wind': True}, 'Sir Ruddock has a line for the SAND and the WIND', dl)
        await pg.evaluate("wJT.pause(true); showPage('help')")
        hp = await pg.evaluate("({ help: !!$('wHelpListsGround') && /rut/.test($('wHelpListsGround').textContent) && /pennants/.test($('wHelpListsGround').textContent), how: ['churned sand', 'pennant wind', 'in the rut', 'beside it', 'rakes', 'gusts', 'Archmage'].every(w => ($('wListsHowGround') || {}).textContent.includes(w)) })")
        check(hp == {'help': True, 'how': True}, 'How to play explains the churned sand and the pennant wind', hp)

        # a reload in the balance moment rides the course out the same, and brings the same wind for the next course
        rw = await pg.evaluate("""(() => { const res = () => JSON.stringify([wJT.G.log[wJT.G.log.length - 1].at, wJT.G.n, wJT.G.ground.wind, wJT.G.ground.rut]);
          for (let sd = 0; sd < 60; sd++) {
            wJT.start({ seed: 3000 + sd, mode: 'play', skill: [1, 1], teams: [__T(['elf', 'golem', 'spider', 'kobold']), __T(['ogre', 'ogre', 'ogre', 'ogre'], 1)], ground: true }); wJT.pause(true);
            __to(() => wJT.phase === 'plan'); wJT.press(); let m = 0;
            while (wJT.phase === 'charge' && m++ < 800) { const C = wJT.view.charge; if (C && C.mine && C.p >= wJT.playRules.couch.ideal && !C.down) wJT.couch(true); wJT.tick(.01); }
            if (wJT.phase !== 'seat') continue;
            const S = JSON.parse(JSON.stringify(wJT.snapshot())), r = new Set();
            for (let i = 0; i < 8; i++) { wJT.resume(JSON.parse(JSON.stringify(S))); wJT.pause(true); r.add(res()); }
            return { seed: 3000 + sd, n: r.size };
          } return { seed: null, n: 0 }; })()""")
        check(rw['seed'] is not None and rw['n'] == 1, 'a reload in the balance moment rides the course out the same, and the next course\'s wind is the same', rw)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

# Realm lists (issue #117, phase 6): powers at the Tilting Lists.
# The engine: a match has no powers unless asked, and with them on and nothing cast a seeded match rides exactly as with
# them off; each side starts with mana, and a lance broken, a seat kept after a rocking hit and a clean course fill it;
# a rider's lance and shield power come from their kind and pick (a rider who brings none brings the pair their name
# picks, the same every time); a cast costs mana, one everyday power a course, and works on that course only; the model
# reads each effect (a steadier tip, a faster charge, a lance that breaks more, a wraith's lance through an angled
# shield, a lance that breaks on any touch, a helm break that unhorses, a seat that can't be lost, a firmer seat, a
# lance that glances more, a softer hit, a charge that costs no wind, a late couch); a harpy's gust lands on the other
# rider this course; a curse lands on the other rider for the rest of the heat, not on one already cursed, and ends with
# the heat; while cursed, the squires may lift it in place of a job (a Knight's corner does, for a bad one), and a lift
# clears it; the ultimate takes the cheer, once a match, and marks one course for its side and against the other; the
# cheer fills on breaks and unhorsings; the situation powers fit only their moments; powers for one side leave the other
# with none; the CPU casts in a match, both sides, each cast with its reason; a snapshot keeps the powers and Auto powers.
# The Realm: every match at the Lists has powers (not the tilting yard), and so do matches from the world and Simulate;
# the Lists tab picks each player's lance and shield power and the match brings the pick; the other clubs' riders bring
# the pair their names pick; before your course the Powers row shows the mana and the cheer, and P casts your lance
# power; Manage has Auto powers, and your squire casts under it; while your rider is cursed each squire's jobs gain
# Lift, and Lift lifts it; the herald's card shows their powers; the course log shows the casts; a match with powers off
# fails the parity row's live checks; How to play explains powers. Asserts; exits nonzero on failure.
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

HELP = r"""
window.__T = (ks, pw) => ({ name: ks.join(''), short: ks[0].slice(0, 3), roster: ks.map((k, i) => Object.assign({ n: k + i, kind: k }, pw ? { pw } : {})) });
window.__to = (f, max) => { let n = 0; while (!f() && n++ < (max || 20000)) wJT.tick(0.05); return !!f(); };
window.__rng = n => { let a = n >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
window.__go = () => { wJT.press(); let m = 0; while (wJT.phase === 'charge' && m++ < 800) { const C = wJT.view.charge; if (C && C.mine && C.p >= wJT.playRules.couch.ideal && !C.down) wJT.couch(true); wJT.tick(.01); }
  m = 0; while (wJT.phase === 'seat' && m++ < 400) wJT.tick(.02); };
window.__ride = (fx, o) => Object.assign({ aim: 'shield', guard: 'square', pace: 'gallop', mount: 'destrier', rs: wJT.rs(''), speed: 12, couch: 0, tip: { x: -4, y: 4 } }, o || {}, fx ? { fx: Object.assign({}, wJT.fx0, fx) } : {});
0"""
A = "['goblin', 'harpy', 'gorgon', 'spider']"
B = "['ogre', 'wraith', 'lich', 'golem']"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- off, on with nothing cast, the picks ----------
        e = await pg.evaluate(f"""(() => {{ const T = [__T({A}), __T({B})], out = {{}};
          wJT.start({{ seed: 1, teams: T }}); wJT.pause(true); out.off = [wJT.G.powers === undefined, JSON.stringify(wJT.fxFor(0)) === JSON.stringify(wJT.fx0), wJT.powWhy(0, 'lance')];
          const a = wJT.simMatch({{ seed: 21, skill: [1, 1], teams: T }}), b = wJT.simMatch({{ seed: 21, skill: [1, 1], teams: T, powers: false }}), c = wJT.simMatch({{ seed: 21, skill: [1, 1], teams: T, powers: true, powOnly: ['none', 'none'] }});
          out.same = [JSON.stringify(a.log) === JSON.stringify(b.log), JSON.stringify(a.log) === JSON.stringify(c.log), JSON.stringify(a.st) === JSON.stringify(c.st), c.powers.casts.length];
          out.byName = [JSON.stringify(wJT.pwByName('Grisk')) === JSON.stringify(wJT.pwByName('Grisk')), new Set(['a', 'bb', 'ccc', 'dddd', 'Grisk', 'Mora', 'Tollo', 'Vex'].map(n => JSON.stringify(wJT.pwByName(n)))).size > 1];
          wJT.start({{ seed: 2, teams: [__T({A}, {{ lance: 1, shield: 0 }}), __T({B})], powers: true }}); wJT.pause(true);
          out.mine = [wJT.powNow(0, 'lance').id, wJT.powNow(0, 'shield').id]; out.theirs = [wJT.powNow(1, 'lance').id, wJT.powOf('ogre', 'lance', wJT.pwByName('ogre0').lance === 1).id];
          out.mana = wJT.G.mana.slice(); return out; }})()""")
        check(e['off'][0] and e['off'][1] and e['off'][2] != '', 'a match has no powers unless asked', e['off'])
        check(e['same'][:3] == [True, True, True] and e['same'][3] == 0, 'powers off, or on with nothing cast, a seeded match rides exactly the same', e['same'])
        check(e['byName'] == [True, True], 'a rider who brings no pick brings the pair their name picks, the same every time (and names differ)', e['byName'])
        check(e['mine'] == ['pebble', 'duck'] and e['theirs'][0] == e['theirs'][1] and e['mana'] == [2, 2], 'a rider\'s powers come from their kind and pick; each side starts with 2 mana', e)

        # ---------- a cast, one a course, this course only ----------
        c = await pg.evaluate(f"""(() => {{ wJT.start({{ seed: 3, teams: [__T({A}), __T({B})], powers: true }}); wJT.pause(true); const G = wJT.G, out = {{}};
          out.r = wJT.cast(0, 'lance', 'a test'); out.mana = G.mana[0]; out.brk = wJT.fxFor(0).brk; out.again = wJT.cast(0, 'shield'); out.log = G.casts[0];
          const ev = wJT.turn(); out.after = [wJT.fxFor(0).brk, ev.rides[0].fx && ev.rides[0].fx.brk];
          G.mana[0] = 6; out.next = wJT.cast(0, 'shield');
          // the harpy's gust lands on the other rider, this course
          wJT.start({{ seed: 3, teams: [__T(['harpy', 'harpy', 'harpy', 'harpy'], {{ lance: 0, shield: 0 }}), __T({B})], powers: true }}); wJT.pause(true);
          out.gust = [wJT.cast(0, 'shield'), wJT.fxFor(1).sway, wJT.fxFor(0).sway];
          return out; }})()""")
        check(c['r'] == '' and c['mana'] == 0 and c['brk'] > 1 and c['again'] != '' and c['log']['why'] == 'a test', 'a cast costs mana, works on the course, one everyday power a course, and is logged with its reason', c)
        check(c['after'][0] == 1 and c['after'][1] > 1 and c['next'] == '', 'the power rides with that course only, and the next course can cast again', c)
        check(c['gust'][0] == '' and c['gust'][1] > 1.2 and c['gust'][2] == 1, 'a harpy\'s gust throws the other rider\'s tip about, this course', c['gust'])

        # ---------- the model reads each effect ----------
        m = await pg.evaluate("""(() => { const d = (fx, g) => __ride(fx, { guard: g || 'square' }), pb = (a, dd) => wJT.strike(a, dd, () => .5).pb, out = {};
          out.pierce = [pb(__ride(null), d(null, 'angled')), pb(__ride({ pierce: 1 }), d(null, 'angled')), pb(__ride(null), d(null, 'square'))];
          out.splinter = [pb(__ride(null, { tip: { x: 6, y: 13 } }), d(null)), pb(__ride({ splinter: 1 }, { tip: { x: 6, y: 13 } }), d(null))];
          out.brkTurn = [pb(__ride({ brk: 1.2 }), d(null)) > pb(__ride(null), d(null)), pb(__ride(null), d({ turn: .8 })) < pb(__ride(null), d(null))];
          const st = (a, dd) => wJT.strike(a, dd, () => 0), hit = st(__ride({ rock: 1.25 }, { tip: { x: 6.5, y: 2 } }), d(null)), soft = st(__ride(null, { tip: { x: 6.5, y: 2 } }), d({ soak: .7 })), plain = st(__ride(null, { tip: { x: 6.5, y: 2 } }), d(null));
          out.rock = [hit.rock > plain.rock, soft.rock < plain.rock];
          const big = { broke: true, rock: 5, zone: 'body' }, se = (dd) => wJT.seat(big, dd, .5, () => .5);
          out.stay = [se(d(null)).unhorse, se(d({ stay: 1 })).unhorse];
          out.hold = [wJT.seat({ broke: true, rock: 1 }, d({ hold: .1 }), .5, () => .5).hold - wJT.seat({ broke: true, rock: 1 }, d(null), .5, () => .5).hold];
          const helm = wJT.strike(__ride({ helmUn: 1 }, { tip: { x: 0, y: 20 } }), d(null), () => 0); out.helm = [helm.zone, helm.broke, !!helm.helmUn, wJT.seat(helm, d(null), 1, () => .5).unhorse, wJT.seat(helm, d({ stay: 1 }), 1, () => .5).unhorse];
          const o = { pace: 'gallop', mount: 'destrier', rs: wJT.rs(''), wind: 1, couch: 0, hands: 1 }, oc = Object.assign({}, o, { hands: { aim: 1, couch: .3 } });
          out.sway = [wJT.sway(Object.assign({ fx: Object.assign({}, wJT.fx0, { sway: .75 }) }, o)).sigma / wJT.sway(o).sigma, wJT.rideSpeed(Object.assign({ fx: Object.assign({}, wJT.fx0, { speed: 1.1 }) }, o)) / wJT.rideSpeed(o)];
          let late = 0, plainC = 0; const r1 = __rng(4), r2 = __rng(4);
          for (let i = 0; i < 200; i++) { late += wJT.charge(Object.assign({ plan: { aim: 'body', guard: 'square', pace: 'canter' }, fx: Object.assign({}, wJT.fx0, { late: .3 }) }, oc), r1).couch; plainC += wJT.charge(Object.assign({ plan: { aim: 'body', guard: 'square', pace: 'canter' } }, oc), r2).couch; }
          out.late = (late - plainC) / 200;
          return out; })()""")
        check(abs(m['pierce'][1] - 2 * m['pierce'][0]) < 1e-9 and m['pierce'][1] < m['pierce'][2], 'a wraith\'s Ghost Lance breaks on an angled shield at a square one\'s rate (twice as often; the angled shield is still the smaller mark)', m['pierce'])
        check(m['splinter'][1] >= .98 > m['splinter'][0], 'a Splintering Lance breaks on any fair touch', m['splinter'])
        check(m['brkTurn'] == [True, True] and m['rock'] == [True, True], 'a power can make your lance break more or theirs glance more, and rock them harder or you softer', m)
        check(m['stay'] == [True, False] and abs(m['hold'][0] - .1) < 1e-9, 'a rider who can\'t be unhorsed this course isn\'t, and a seat power holds them on', m)
        check(m['helm'][:4] == ['helm', True, True, True] and m['helm'][4] is False, 'under a Grave Charge a lance broken on the helm unhorses (but not a rider who can\'t be unhorsed)', m['helm'])
        check(abs(m['sway'][0] - .75) < 1e-9 and abs(m['sway'][1] - 1.1) < 1e-9 and abs(m['late'] - .3) < .02, 'the model reads the sway, the speed and a late couch', m)
        w = await pg.evaluate(f"""(() => {{ const run = cast => {{ wJT.start({{ seed: 5, teams: [__T(['minotaur', 'minotaur', 'minotaur', 'minotaur'], {{ lance: 0, shield: 0 }}), __T({B})], powers: true, fix: [{{ aim: 'body', guard: 'square', pace: 'gallop' }}, null] }}); wJT.pause(true);
            if (cast) wJT.cast(0, 'lance'); wJT.G.wind[0] = .5; const w0 = wJT.G.wind[0]; wJT.turn(); return +(w0 - wJT.G.wind[0]).toFixed(3); }};
          return [run(false), run(true)]; }})()""")
        check(w[0] > 0 and w[1] < 0, 'a minotaur\'s Bull Charge costs the mount no wind (it gets wind back between courses)', w)

        # ---------- curses and the squire's lift ----------
        k = await pg.evaluate(f"""(() => {{ const out = {{}}; wJT.start({{ seed: 6, courses: 3, teams: [__T(['gorgon', 'gorgon', 'gorgon', 'gorgon'], {{ lance: 0, shield: 0 }}), __T({B})], powers: true, cornerBy: ['none', 'none'] }}); wJT.pause(true); const G = wJT.G;
          out.r = wJT.cast(0, 'lance'); out.curse = G.curse[1] && G.curse[1].n; out.late = wJT.fxFor(1).late; out.mine = wJT.fxFor(0).late;
          G.mana[0] = 6; G.powCourse[0] = -1; out.twice = wJT.cast(0, 'lance');
          out.jobs = wJT.jobsFor(1); out.jobs0 = wJT.jobsFor(0);
          let n = 0; while (G.heat === 0 && n++ < 10) {{ wJT.turn(); if (G.heat === 0) out.held = !!G.curse[1]; }}
          out.ended = G.curse[1];
          return out; }})()""")
        check(k['r'] == '' and k['curse'] == 'Stare' and k['late'] > .2 and k['mine'] == 0, 'a gorgon\'s Stare lays a curse on the other rider (a late couch), not on her own', k)
        check(k['twice'] != '', 'a rider already cursed can\'t be cursed again', k)
        check('lift' in k['jobs'] and 'lift' not in k['jobs0'], 'while a rider is cursed, their squires may lift it in place of a job', k)
        check(k.get('held') is True and k['ended'] is None, 'a curse lasts the rest of the heat, and ends with it', k)
        l = await pg.evaluate(f"""(() => {{ wJT.start({{ seed: 7, courses: 5, skill: [1, 1], teams: [__T({A}), __T({B})], powers: true, cornerBy: ['none', 'none'] }}); wJT.pause(true); const G = wJT.G;
          wJT.turn(); G.curse[0] = {{ id: 'test', n: 'Test Curse', fx: {{ late: .7, sway: 1.6 }}, by: 'x', side: 1, heat: 0 }}; G.lab.cornerBy = null;
          const P = wJT.cornerPlan(0, 1), why = P.why, bad = wJT.cornerDo(0, ['lift', 'lift']), r = wJT.cornerDo(0, P.jobs);
          const C = G.corners[0][G.corners[0].length - 1]; return {{ jobs: P.jobs, why, bad, r, curse: G.curse[0], did: C.did }}; }})()""")
        check('lift' in l['jobs'] and 'Test Curse' in l['why'], 'a Knight\'s corner lifts a bad curse, and says so', l)
        check(l['bad'] != '' and l['r'] == '' and l['curse'] is None and l['did'].get('lift') == 'Test Curse', 'a lift clears the curse (and two squires can\'t both lift)', l)

        # ---------- the ultimate, the cheer, situations ----------
        u = await pg.evaluate(f"""(() => {{ wJT.start({{ seed: 8, teams: [__T(['ogre', 'ogre', 'ogre', 'ogre']), __T({B})], powers: true }}); wJT.pause(true); const G = wJT.G, out = {{}};
          out.poor = wJT.powWhy(0, 'ult'); G.cheer[0] = 60; out.r = wJT.cast(0, 'ult'); out.mark = G.marks[0] && G.marks[0].id; out.own = wJT.fxFor(0).splinter; out.riv = wJT.fxFor(1).splinter; out.cheer = G.cheer[0];
          const ev = wJT.turn(); out.after = [G.marks[0], wJT.fxFor(0).splinter]; G.cheer[0] = 100; out.again = wJT.powWhy(0, 'ult');
          return out; }})()""")
        check(u['poor'] != '' and u['r'] == '' and u['mark'] == 'splinterlance' and u['own'] == 1 and u['riv'] == 0 and u['cheer'] == 10, 'the ultimate takes the cheer and marks the course for its side', u)
        check(u['after'] == [None, 0] and u['again'] != '', 'the mark ends with its course; the ultimate is once a match', u)
        f = await pg.evaluate(f"""(() => {{ wJT.start({{ seed: 9, skill: [1, 1], teams: [__T({A}), __T({B})], powers: true, powOnly: ['none', 'none'] }}); wJT.pause(true); const G = wJT.G; let bad = [], n = 0, sad = 0, saddleOk = true;
          while (!G.over && n++ < 60) {{ const m0 = G.mana.slice(), c0 = G.cheer.slice(), ev = wJT.turn(); if (!ev) break;
            for (const s of [0, 1]) {{ const o = 1 - s, st = ev.imp.st[s], se = ev.imp.seat[s], kept = se.rocked && !se.unhorse;
              const wantM = Math.min(6, m0[s] + (st.broke ? 1 : 0) + (st.broke && !ev.imp.st[o].broke ? 1 : 0) + (kept ? 1 : 0));
              const wantC = Math.min(100, c0[s] + (st.broke ? 10 : 0) + (st.broke && st.zone === 'helm' ? 10 : 0) + (ev.imp.res[s].unhorse ? 30 : 0) + (kept ? 15 : 0));
              if (G.mana[s] !== wantM || G.cheer[s] !== wantC) bad.push([s, m0[s], G.mana[s], wantM, c0[s], G.cheer[s], wantC]);
              const fits = wJT.sitFits(s, 'saddle'); if (fits) sad++; if (fits !== (kept && !ev.rule.heatOver && !ev.rule.tiltNow && !G.over)) saddleOk = false; }} }}
          return {{ bad: bad.slice(0, 4), cheer: G.cheer.slice(), sad, saddleOk }}; }})()""")
        check(f['bad'] == [] and max(f['cheer']) > 0, 'mana fills on a lance broken, a seat kept and a clean course; the cheer on breaks, helm breaks, unhorsings and seats kept', f)
        check(f['saddleOk'], 'Back in the Saddle fits only the course after keeping your seat from a rocking hit', f)
        s_ = await pg.evaluate(f"""(() => {{ wJT.start({{ seed: 10, teams: [__T({A}), __T({B})], powers: true }}); wJT.pause(true); const G = wJT.G, out = {{}};
          out.early = [wJT.sitFits(0, 'last'), wJT.sitFits(0, 'crown'), wJT.powWhy(0, 'crown')];
          G.course = G.courses - 1; G.sc[1][0][0] = 1; out.last = [wJT.sitFits(0, 'last'), wJT.sitFits(1, 'last')];
          out.r = wJT.cast(0, 'last'); out.fx = [wJT.fxFor(0).nerve, wJT.fxFor(0).sway]; out.one = wJT.powWhy(0, 'saddle');
          G.heat = 2; G.crown = [0, 0]; out.crown = wJT.sitFits(0, 'crown');
          return out; }})()""")
        check(s_['early'][:2] == [False, False] and s_['early'][2] != '', 'The Last Course and For the Crown don\'t fit the first course', s_)
        check(s_['last'] == [True, False] and s_['r'] == '' and s_['fx'] == [1, .8], 'The Last Course fits only the side behind in a heat\'s last course, and takes the pressure off', s_)
        check(s_['crown'] is True, 'For the Crown fits the tilt for the crown', s_)

        # ---------- one side, the CPU, the snapshot ----------
        cp = await pg.evaluate(f"""(() => {{ const T = [__T({A}), __T({B})], out = {{}};
          const one = wJT.simMatch({{ seed: 11, skill: [2, 2], teams: T, powers: [true, false] }}), both = [];
          for (let i = 0; i < 6; i++) both.push(wJT.simMatch({{ seed: 30 + i, skill: [1 + (i % 2), 1 + (i % 2)], teams: T, powers: true }}));
          const all = both.flatMap(s => s.powers.casts);
          out.one = [one.powers.casts.filter(c => c.side === 0).length, one.powers.casts.filter(c => c.side === 1).length];
          out.both = [all.filter(c => c.side === 0).length, all.filter(c => c.side === 1).length, all.every(c => c.why && c.n)];
          out.kinds = [...new Set(all.map(c => c.k))];
          return out; }})()""")
        check(cp['one'][0] >= 1 and cp['one'][1] == 0, 'powers for one side only: the other casts none', cp['one'])
        check(min(cp['both'][:2]) >= 6 and cp['both'][2] and {'lance', 'shield', 'ult'} <= set(cp['kinds']), 'the CPU casts in a match, both sides (everyday powers and the ultimate), each cast with its reason', cp)
        sn = await pg.evaluate(f"""(() => {{ wJT.start({{ seed: 12, mode: 'manage', teams: [__T({A}), __T({B})], powers: true }}); wJT.pause(true); __to(() => wJT.phase === 'plan');
          const G = wJT.G; G.mana[0] = 5; G.cheer[1] = 33; wJT.cast(1, 'lance'); wJT.autoPow = true; const sn = wJT.snapshot(); const j = JSON.parse(JSON.stringify(sn));
          wJT.start({{ seed: 1, teams: [__T({A}), __T({B})] }}); wJT.resume(j); wJT.pause(true);
          return [wJT.G.powers, wJT.G.mana[0], wJT.G.cheer[1], wJT.G.casts.length, wJT.autoPow, !!sn.autoPow]; }})()""")
        check(sn == [True, 5, 33, 1, True, True], 'a snapshot keeps the powers (mana, cheer, casts) and Auto powers', sn)

        # ---------- phase 6's review ----------
        # a cursed rider's corner may lift the curse, and the match goes on (it froze at 'next'); in Play and Manage, and
        # after a resume with the curse on
        fz = await pg.evaluate("""(() => { const out = { after: 0, stuck: [], errors: [], resumed: null };
          const G4 = () => __T(['gorgon', 'gorgon', 'gorgon', 'gorgon'], { lance: 0, shield: 0 });
          for (let sd = 0; sd < 8; sd++) { const mgr = sd % 2 === 1;
            try { wJT.start({ seed: 1000 + sd, mode: mgr ? 'manage' : 'play', skill: [1, 1], courses: 5, teams: [__T(['elf', 'golem', 'spider', 'kobold']), G4()], powers: true }); wJT.pause(true);
              let k = 0; while (!wJT.G.over && k++ < 8) { if (!__to(() => wJT.phase === 'plan' || !!wJT.G.over, 4000)) { out.stuck.push([sd, wJT.phase, wJT.G.n]); break; } if (wJT.G.over) break;
                if (wJT.G.curse[0]) out.after++;
                if (!out.resumed && wJT.G.curse[0] && wJT.view.jobs) { const S = JSON.parse(JSON.stringify(wJT.snapshot())); wJT.resume(S); wJT.pause(true); out.resumed = __to(() => wJT.phase === 'plan', 4000); }
                wJT.G.mana[1] = 6; wJT.cast(1, 'lance', 'a test'); if (mgr) { wJT.press(); __to(() => !['charge', 'seat'].includes(wJT.phase)); } else __go(); } }
            catch (e) { out.errors.push(String(e).slice(0, 160)); } }
          return out; })()""")
        check(fz['after'] >= 6 and not fz['stuck'] and not fz['errors'] and fz['resumed'] is True, 'with a curse on your rider, Play and Manage go on to the next plan beat (your corner may lift it), and so does a resume', fz)
        # a reload during a course never changes its result: resumed from a snapshot taken in the charge, or in the
        # balance moment after the impact, it comes out the same every time
        rr = await pg.evaluate("""(() => { const out = { charge: null, seat: null };
          const res = () => { const L = wJT.G.log[wJT.G.log.length - 1]; return JSON.stringify([L.at, L.unhorse, wJT.G.n]); };
          for (let sd = 0; sd < 60 && !(out.charge && out.seat); sd++) {
            wJT.start({ seed: 2000 + sd, mode: 'play', skill: [1, 1], teams: [__T(['elf', 'golem', 'spider', 'kobold']), __T(['ogre', 'ogre', 'ogre', 'ogre'])], powers: true }); wJT.pause(true);
            __to(() => wJT.phase === 'plan'); wJT.press(); for (let i = 0; i < 20; i++) wJT.tick(.05); const S1 = JSON.parse(JSON.stringify(wJT.snapshot()));
            let m = 0; while (wJT.phase === 'charge' && m++ < 800) { const C = wJT.view.charge; if (C && C.mine && C.p >= wJT.playRules.couch.ideal && !C.down) wJT.couch(true); wJT.tick(.01); }
            const S2 = wJT.phase === 'seat' ? JSON.parse(JSON.stringify(wJT.snapshot())) : null;
            if (!out.charge) { const r = new Set(); for (let i = 0; i < 12; i++) { wJT.resume(JSON.parse(JSON.stringify(S1))); wJT.pause(true); r.add(res()); } out.charge = r.size; }
            if (S2 && !out.seat) { const r = new Set(); for (let i = 0; i < 12; i++) { wJT.resume(JSON.parse(JSON.stringify(S2))); wJT.pause(true); r.add(res()); } out.seat = r.size; out.st = S2.riding && !!S2.riding.P; } }
          return out; })()""")
        check(rr['charge'] == 1 and rr['seat'] == 1, 'a reload during a course never changes its result (in the charge, or in the balance moment after the impact)', rr)
        # both sides may cast their ultimate before the same course: the first to cast doesn't shut the other out
        ul = await pg.evaluate("""(() => { wJT.start({ seed: 3, teams: [__T(['ogre', 'ogre', 'ogre', 'ogre']), __T(['gorgon', 'gorgon', 'gorgon', 'gorgon'])], powers: true }); wJT.pause(true); const G = wJT.G;
          G.cheer = [60, 60]; const a = wJT.cast(0, 'ult'), b = wJT.cast(1, 'ult'), f0 = wJT.fxFor(0), f1 = wJT.fxFor(1);
          return { a, b, own0: f0.splinter, riv0: f0.late, own1: f1.splinter, cheer: G.cheer.slice() }; })()""")
        check(ul['a'] == '' and ul['b'] == '' and ul['own0'] == 1 and ul['riv0'] > .4 and ul['own1'] == 0 and ul['cheer'] == [10, 10], 'both sides can mark the same course with their ultimates: whoever casts first doesn\'t shut the other out', ul)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); (() => { for (const kind of ['elf', 'spider', 'gorgon']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); })()")
        await pg.evaluate("wOpenCamp('lists')")
        await pg.wait_for_selector('#wCampBody [data-jtpw]')
        tb = await pg.evaluate("""(() => { const s = document.querySelector('#wCampBody [data-jtpw="lance"]'), id = +s.closest('[data-cid]').dataset.cid; s.value = '1'; s.dispatchEvent(new Event('change'));
          const p = wPlayer(id); return { n: document.querySelectorAll('#wCampBody [data-jtpw]').length, pick: p.jtPw, brought: wListsPlayer(p).pw, hint: /lance power/.test($('wCampBody').textContent) }; })()""")
        check(tb['n'] >= 8 and tb['pick'] == {'lance': 1, 'shield': 0} and tb['brought'] == {'lance': 1, 'shield': 0} and tb['hint'], 'the Lists tab picks each player\'s lance and shield power, and the match brings the pick', tb)
        await pg.evaluate("WCAMP.close && WCAMP.close()")
        rw = await pg.evaluate("""(() => { const out = {}; const opp = wListsOpp('local', 1);
          out.opp = opp.roster.every(m => JSON.stringify(m.pw) === JSON.stringify(wJT.pwByName(m.n)));
          out.opts = wListsOpts(wListsMine(), opp, 1).powers === true;
          wListsYard(); out.yard = !wJT.G.powers && $('wListsPowRow').hidden; wJT.pause(true);
          W_LISTS_MODE = 'play'; wListsGame({ seed: 13, mode: 'play' }); wJT.pause(true); __to(() => wJT.phase === 'plan'); wListsRows();
          const G = wJT.G, row = $('wListsPowRow'); out.on = [!!G.powers, !row.hidden, /Mana/.test(row.textContent), /Cheer/.test(row.textContent), !!row.querySelector('[data-jtpow="lance"]')];
          G.mana[0] = 6; const cost = wJT.powNow(0, 'lance').cost; wJT.pause(false);
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true })); wJT.pause(true);
          out.key = [6 - G.mana[0], cost, G.casts.length && G.casts[G.casts.length - 1].side];
          out.card = /Their powers/.test($('wListsCard').textContent);
          return out; })()""")
        check(rw['opp'] and rw['opts'], 'the other clubs\' riders bring the pair their names pick, and matches from the world (and Simulate) have powers', rw)
        check(rw['yard'], 'the tilting yard has no powers', rw)
        check(all(rw['on']), 'every match at the Lists has powers; before your course the Powers row shows the mana, the cheer and your rider\'s powers', rw['on'])
        check(rw['key'][0] == rw['key'][1] and rw['key'][1] in (2, 3) and rw['key'][2] == 0, 'P casts your rider\'s lance power, for its mana', rw['key'])
        check(rw['card'], 'the herald\'s card shows their powers', rw)
        mg = await pg.evaluate("""(() => { const out = {}; W_LISTS_MODE = 'manage'; wListsGame({ seed: 14, mode: 'manage' }); wJT.pause(true); wListsRows();
          const b = document.querySelector('[data-jtauto]'); out.btn = !!b; if (b) b.click(); out.auto = wJT.autoPow;
          const G = wJT.G; G.mana[0] = 6; let n = 0;
          while (!G.casts.some(c => c.side === 0) && !G.over && n++ < 30000) { if (wJT.phase === 'plan') wJT.press(); wJT.tick(.05); }
          const c = G.casts.find(x => x.side === 0); out.cast = !!c && !!c.why && c.why !== 'your call';
          // between courses, your rider cursed: Lift
          wListsGame({ seed: 15, mode: 'manage' }); wJT.pause(true); wJT.autoPow = false; n = 0;
          while (!(wJT.phase === 'plan' && wJT.view.jobs) && n++ < 30000) { if (wJT.phase === 'plan') wJT.press(); wJT.tick(.05); }
          wJT.G.curse[0] = { id: 'stare', n: 'Stare', fx: { late: .28 }, by: 'Someone', side: 1, heat: wJT.G.heat }; wListsRows();
          const lift = document.querySelector('#wListsSq [data-jjob="lift"]'); out.liftBtn = !!lift; if (lift) lift.click();
          out.jobs = wJT.view.jobs; out.row = /Stare on your rider/.test($('wListsPow').textContent); wJT.press();
          out.lifted = wJT.G.curse[0]; n = 0; __to(() => wJT.phase === 'after' || wJT.phase === 'over'); wListsBoard();
          out.log = /lifts the Stare/.test($('wListsLog').textContent) || null;
          W_LISTS_MODE = 'play'; return out; })()""")
        check(mg['btn'] and mg['auto'] is True, 'Manage has Auto powers', mg)
        check(mg['cast'], 'under Auto powers your squire casts for your side, with its reason', mg)
        check(mg['liftBtn'] and 'lift' in (mg['jobs'] or []) and mg['row'], 'while your rider is cursed, each squire\'s jobs gain Lift, and the Powers row says so', mg)
        check(mg['lifted'] is None and mg['log'] is True, 'Lift lifts the curse, and the course log says so', mg)
        lg = await pg.evaluate("""(() => { wListsGame({ seed: 16, mode: 'watch', skill: [2, 2] }); wJT.pause(true); let n = 0; while (!wJT.G.over && n++ < 60000) wJT.tick(.05); wListsBoard();
          return { casts: wJT.G.casts.length, log: (document.getElementById('wListsLog').textContent.match(/✦/g) || []).length }; })()""")
        check(lg['casts'] > 0 and lg['log'] == lg['casts'], 'the course log shows every cast', lg)
        # the parity row's live checks fail with powers off
        pf = await pg.evaluate("""(() => { W_LISTS_MODE = 'manage'; wListsGame({ seed: 17, mode: 'manage', powers: false }); wJT.pause(true); wListsRows(); const T = x => { try { return !!x(); } catch (e) { return false; } };
          const r = [T(() => wJT.G.powers === true && wJT.G.powSides.every(Boolean) && wJT.G.mana.length === 2), T(() => wJT.G.powers === true && wJT.G.cheer.length === 2), T(() => wJT.G.powers === true && wJT.G.ultUsed.every(u => u === false)),
            T(() => wJT.G.powers === true && wJT.G.sitUsed.length === 2), T(() => { const b = document.querySelector('[data-jtauto]'); return !!b && !$('wListsPowRow').hidden; })];
          W_LISTS_MODE = 'play'; return r; })()""")
        check(pf == [False] * 5, 'with powers off, the parity row\'s live checks fail (resource, meter, ultimate, situations, auto)', pf)
        # (phase 6's review) through the Realm too: a curse on your rider, and the match goes on
        rc = await pg.evaluate("""(() => { wJtg().met = {}; W_LISTS_MODE = 'play'; const why = wStartLists({ club: 'local', how: 'play' }); wJT.pause(true); __to(() => wJT.phase === 'plan');
          wJT.G.curse[0] = { id: 'stare', n: 'Stare', fx: { late: .28 }, by: 'them', side: 1, heat: 0 }; let ok = true;
          try { for (let i = 0; i < 3 && !wJT.G.over; i++) { __go(); ok = __to(() => wJT.phase === 'plan' || !!wJT.G.over, 4000) && ok; } } catch (e) { ok = String(e); }
          const r = { why, ok, n: wJT.G.n }; if (wListsLive()) { const s = wJT.summary() || {}; s.win = 1; s.text = 'conceded'; wListsSettle(s); WJT = null; wListsModeBack(); wW150LeaveLists(); } W_LISTS_MODE = 'play'; return r; })()""")
        check(rc['why'] == '' and rc['ok'] is True and rc['n'] >= 2, 'through the Realm: a curse on your rider, and the match goes on', rc)
        await pg.evaluate("wJT.pause(true); showPage('help')")
        hp = await pg.evaluate("({ help: !!$('wHelpListsPowers') && /pick/.test($('wHelpListsPowers').textContent), how: ['Powers.', 'Curses.', 'cheer', 'ultimate', 'Situation powers', 'Auto powers', 'lift'].every(w => ($('wListsHowPow') || {}).textContent.includes(w)) })")
        check(hp == {'help': True, 'how': True}, 'How to play explains powers', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

"""Realm curling balance bot (issue #102, phase 10): headless curling matches and Brass Brooms in dist/realm.html.

  python3 test/realm_shed_lab.py 120            120 games for every cell, and 120 cups
  python3 test/realm_shed_lab.py 120 'W_SHG.oppBonus = { 1: 0, 2: 2, 3: 4 }'    a tuning override, run in the page first
  python3 test/realm_shed_lab.py 200 '' tiers,gaps    only some parts (tiers, gaps, skills, powers, shots, sweep, hammer,
                                                      pebble, deep, kits, cups, single, umbral)
  python3 test/realm_shed_lab.py 100 '' umbral        only the Umbral (issue #99, phase 4h)
  python3 test/realm_shed_lab.py 100 '' umbral nadir,rime    only those rows of it (to run rows in several processes)
  python3 test/realm_shed_lab.py 300 '' deep knights          only that row of the deep (knights, knightSquire, knightArchmage, archmageKnight)

Every game is the curling engine played to a result, headless (wCR.simGame), as Simulate plays it: 6 ends, the Shed's
ways on, powers on, your four curling as a Knight would, the other rink at the skill of the tier (Squire, Knight,
Archmage). No game ends level (the extra end). Your four: a fresh journey with players at level 3, in the order their
ratings suggest. The hammer goes to each side in turn.
- tiers: against a rival's four as the world sets them (their level is yours plus the tier, less one, with the tier's
  rating bonus, W_SHG.oppBonus, and skill): the games you really curl. Round every club, a game each.
- gaps: their level yours plus a gap (-1 to +3), no bonus, both Knights, their four your own kinds (so level is all that
  differs; the same for skills, powers, shots, sweep, hammer and pebble).
- skills: even level, their skip a Squire, a Knight, an Archmage; and their own ladder (Archmage against Knight, Knight
  against Squire, the same four on both sides).
- powers: even level, powers for both, neither, yours only and theirs only.
- shots: your side held to one shot all game where it can (fixShot: draw, guard, freeze, takeout, peel, hit and roll).
- sweep: your sweepers on and off (noSweep).
- hammer: the hammer's worth, with the hammer in the first end against without; and the ends (singles, twos, big ends,
  blanks and steals a game).
- pebble: the pebble's wear on and off (wear), and the Shed's ways on and off.
- deep (issue #108): Old Grey under the ice, on and off on the same games (game i the same seed and the same fours both
  ways), for even Knights, your Knight against a Squire and against an Archmage, and an Archmage against a Knight: side
  0's win % each way, and with the deep, the stones he bumps a game and the bumps that changed an end's score (swings).
- kits: by tier, plain; their bag only (as Simulate plays it); both bags; and the full kit (both bags, and your four in
  gear, a piece each).
- cups: Simulate every round: how far it gets, how often it wins.
- single: each thing on its own, even level, both Knights, against the same game without it. Powers: for every kind, a
  four of that kind, with only that one power castable by your side (powOnly; the other side has none), against the four
  with no powers; each draw power, hit power, second power and ultimate, with how often it was cast a game; and the
  situation powers and Steady with your own four. Gear: each piece on every one of your four. Potions: a bag of two of
  that one, given as a Knight would.
- umbral (issue #99, phase 4h): your four at level 3 against level 3 (level parity), as Simulate plays the Sunken
  Shed's champion (your four curl as a Knight). The Lich against the Archmage (no bonus, no bags: archmage, lich); tier
  3 as the world sets it (tier3) and tier U on your own kinds (tierU: W_SHG.oppBonus[4], the Lich, a full bag) for
  reference; the Nadir four (the champion's game: nadir) with no hexes, without the champion's own ultimate (noUlt),
  each hex alone (rime, lead, drift, hoar), as many drawn as the champion draws (every draw in turn: drawn) and two (the
  finale's round: two). Every row plays game i with the same seed and the same fours (Math.random seeded per game), so a
  hex's swing is measured on the same games as the row without it.
Every game reports side 0's win %, its points a game and its shots made %. Writes /tmp/realm_shed_lab.json."""
import asyncio, json, sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 120
OVR = sys.argv[2] if len(sys.argv) > 2 else ''
PARTS = set((sys.argv[3] if len(sys.argv) > 3 else 'tiers,gaps,skills,powers,shots,sweep,hammer,pebble,deep,kits,cups,single,umbral').split(','))
ROWS = sys.argv[4].split(',') if len(sys.argv) > 4 and sys.argv[4] else None
OUT = os.environ.get('SHED_LAB_OUT', '/tmp/realm_shed_lab.json')

SETUP = r"""
window.__lab = {};
// a four of kinds at a level (with the tier's rating bonus), as the engine takes them. Every game draws its fours afresh
// (a player's ratings are rolled a point either way, so one draw is luck)
__lab.kinds = null;
__lab.four = (lvl, bonus, kinds) => { kinds = kinds || __lab.kinds;
  const roster = kinds.map(kind => wShedPlayer(wMakePlayer({ kind, lvl }, 'opp')));
  if (bonus) roster.forEach((p, j) => { for (let i = 0; i < bonus; i++) { const s = wCR.stats[(i * 5 + j) % 6]; p.r[s] = Math.min(wCR.cap, p.r[s] + 1); } });
  return { name: 'Them', short: 'THM', roster }; };
__lab.mine = () => Object.assign(__lab.four(3, 0), { name: 'Us', short: 'US' });
// a rival as the world sets it at a tier, its kept four drawn again each game
__lab.opp = (club, t) => { delete wShg().opp[club]; return wShedOpp(club, t); };
__lab.base = { ends: 6, hall: true, powers: true };
__lab.seed0 = 1000;
// (each cell its own run of seeds: the same seeds in every cell would carry one run's luck into all of them)
__lab.cell = () => { __lab.seed0 += 100003; return __lab.seed0; };
__lab.one = (i, o, s0) => wCR.simGame(Object.assign({ seed: s0 + i, hammer: i % 2 }, __lab.base, o));
// play n games; o(i) gives the options; { win, pts (side 0's points a game), made (side 0's shots made %), xe (extra ends %) }
__lab.play = (n, o) => { let w = 0, pts = 0, m = 0, st = 0, xe = 0; const s0 = __lab.cell();
  for (let i = 0; i < n; i++) { const r = __lab.one(i, o(i), s0); if (r.win === 0) w++; pts += r.tot[0]; m += r.st[0].made; st += r.st[0].stones; if (r.extra) xe++; }
  return { win: +(100 * w / n).toFixed(1), pts: +(pts / n).toFixed(2), made: +(100 * m / Math.max(1, st)).toFixed(1), xe: +(100 * xe / n).toFixed(1) }; };
// play n games and count side 0's casts of one power id: { win, casts (a game) }
__lab.playCast = (n, o, id) => { let w = 0, c = 0; const s0 = __lab.cell();
  for (let i = 0; i < n; i++) { const r = __lab.one(i, o(i), s0); if (r.win === 0) w++; c += ((r.casts || []).filter(x => x.side === 0 && x.id === id)).length; }
  return { win: +(100 * w / n).toFixed(1), casts: +(c / n).toFixed(2) }; };
// the ends of n games: side 0 with the hammer in the first end, or without; and the end types a game
__lab.ends = (n, ham) => { let w = 0, pts = 0; const E = { single: 0, two: 0, big: 0, blank: 0, steal: 0 }; const s0 = __lab.cell();
  for (let i = 0; i < n; i++) { const r = wCR.simGame(Object.assign({ seed: s0 + i, hammer: ham }, __lab.base, { teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1] }));
    if (r.win === 0) w++; pts += r.tot[0] - r.tot[1];
    for (const e of r.log || []) { if (e.s < 0) E.blank++; else if (e.n >= 3) E.big++; else if (e.n === 2) E.two++; else E.single++; }
    E.steal += r.st[0].ends.stolen + r.st[1].ends.stolen; }
  for (const k in E) E[k] = +(E[k] / n).toFixed(2);
  return { win: +(100 * w / n).toFixed(1), margin: +(pts / n).toFixed(2), ends: E }; };
// the frozen deep on and off on the same games: { off, on, bumps, swings (a game), margin (side 0's points less theirs, a
// game, each way) }
__lab.deep = (n, o) => { const s0 = __lab.cell(), A = { off: 0, on: 0, bumps: 0, swings: 0, mOff: 0, mOn: 0 };
  for (let i = 0; i < n; i++) { const opts = o(i), a = __lab.one(i, Object.assign({}, opts, { deep: false }), s0), b = __lab.one(i, Object.assign({}, opts, { deep: true }), s0);
    if (a.win === 0) A.off++; if (b.win === 0) A.on++; A.bumps += b.deep.bumps; A.swings += b.deep.swings; A.mOff += a.tot[0] - a.tot[1]; A.mOn += b.tot[0] - b.tot[1]; }
  return { off: +(100 * A.off / n).toFixed(1), on: +(100 * A.on / n).toFixed(1), bumps: +(A.bumps / n).toFixed(2), swings: +(A.swings / n).toFixed(2), margin: [+(A.mOff / n).toFixed(2), +(A.mOn / n).toFixed(2)] }; };
// a four of one kind at level 3 (pw: { draw, hit } 1 for a curler's second power)
__lab.fourOf = (kind, pw) => ({ name: 'Us', short: 'US', roster: [0, 1, 2, 3].map(() => Object.assign(wShedPlayer(wMakePlayer({ kind, lvl: 3 }, 'opp')), pw ? { pw } : {})) });
__lab.geared = id => { const T = __lab.mine(), G = Object.assign({ id }, W_GEAR[id]); T.roster = T.roster.map(m => Object.assign({}, m, { r: wGearRate(m.r, G, wCR.cap), gear: wGearTag(G) })); return T; };
0"""

async def main():
    t0 = time.time(); out = {}
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page()
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['elf', 'spider', 'gorgon', 'dwarf']; let i = 0; while (wRoster().length < 4) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 3 }, 'tavern')); for (const q of wRoster()) { q.lvl = 3; wCrOf(q); } WG.shed = null; wFourSyncCr(); LAB = true; })()")
        await pg.evaluate(SETUP)
        await pg.evaluate("__lab.kinds = wFourMineCr().roster.map(m => m.kind); __lab.clubs = wBallClubs()")
        if OVR: await pg.evaluate(OVR)
        print('your four:', await pg.evaluate("__lab.kinds.join(', ')"))

        if 'tiers' in PARTS:
            out['tiers'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const t of [1, 2, 3]) o[t] = __lab.play({N}, i => ({{ teams: [__lab.mine(), __lab.opp(__lab.clubs[i % __lab.clubs.length], t)], skill: wShedSkillOf(t) }})); return o; }})()""")
            print('Tiers, as the world sets them:', json.dumps(out['tiers']))
        if 'gaps' in PARTS:
            out['gaps'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const g of [-1, 0, 1, 2, 3]) o[g] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3 + g, 0)], skill: [1, 1] }})); return o; }})()""")
            print('Level gap:', json.dumps(out['gaps']))
        if 'skills' in PARTS:
            out['skills'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const k of [0, 1, 2]) o[['Squire', 'Knight', 'Archmage'][k]] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, k] }}));
              o.ladder = {{ archmageKnight: __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [2, 1] }})).win, knightSquire: __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 0] }})).win }}; return o; }})()""")
            print('Their skill:', json.dumps(out['skills']))
        if 'powers' in PARTS:
            out['powers'] = await pg.evaluate(f"""(() => {{ const go = pw => __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], powers: pw }}));
              return {{ both: go(true), neither: go(false), mine: go([true, false]), theirs: go([false, true]) }}; }})()""")
            print('Powers:', json.dumps(out['powers']))
        if 'shots' in PARTS:
            out['shots'] = await pg.evaluate(f"""(() => {{ const o = {{ auto: __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1] }})) }};
              for (const sh of ['draw', 'guard', 'freeze', 'takeout', 'peel', 'hitroll']) o[sh] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], fixShot: [sh, null] }})); return o; }})()""")
            print('Your shot, held where it can be:', json.dumps(out['shots']))
        if 'sweep' in PARTS:
            out['sweep'] = await pg.evaluate(f"""(() => ({{ on: __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1] }})), off: __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], noSweep: [true, false] }})) }}))()""")
            print('Your sweepers:', json.dumps(out['sweep']))
        if 'hammer' in PARTS:
            out['hammer'] = await pg.evaluate(f"""(() => ({{ first: __lab.ends({N}, 0), not: __lab.ends({N}, 1) }}))()""")
            print('The hammer in the first end (and the ends a game):', json.dumps(out['hammer']))
        if 'pebble' in PARTS:
            out['pebble'] = await pg.evaluate(f"""(() => {{ const go = x => __lab.play({N}, () => Object.assign({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [2, 1] }}, x));
              return {{ wear: go({{}}), noWear: go({{ wear: false }}), shed: go({{}}), noShed: go({{ hall: false }}) }}; }})()""")
            print('The pebble and the Shed (an Archmage against a Knight):', json.dumps(out['pebble']))
        if 'deep' in PARTS:
            out['deep'] = await pg.evaluate(f"""(() => {{ const go = sk => __lab.deep({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: sk }}));
              const rows = {{ knights: [1, 1], knightSquire: [1, 0], knightArchmage: [1, 2], archmageKnight: [2, 1] }}, want = {json.dumps(ROWS)}, o = {{}};
              for (const k in rows) if (!want || want.includes(k)) o[k] = go(rows[k]); return o; }})()""")
            print('The frozen deep, off and on (the same games):', json.dumps(out['deep']))
        if 'kits' in PARTS:
            out['kits'] = await pg.evaluate(f"""(() => {{ const o = {{}}, mineBag = {{ draught: 2, crwarm: 1, crsalt: 1, crpebble: 1 }}, gearOf = ['cr_broom', 'cr_slider', 'cr_polish', 'cr_charm'];
              const geared = () => {{ const T = __lab.mine(); T.roster = T.roster.map((m, i) => {{ const G = Object.assign({{ id: gearOf[i] }}, W_GEAR[gearOf[i]]); return Object.assign({{}}, m, {{ r: wGearRate(m.r, G, wCR.cap), gear: wGearTag(G) }}); }}); return T; }};
              for (const t of [1, 2, 3]) {{ const opp = i => __lab.opp(__lab.clubs[i % __lab.clubs.length], t), sk = wShedSkillOf(t), theirs = W_SHED_KIT.opp[t];
                o[t] = {{ plain: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk }})), theirs: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk, bags: [null, theirs] }})),
                  both: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk, bags: [mineBag, theirs] }})), full: __lab.play({N}, i => ({{ teams: [geared(), opp(i)], skill: sk, bags: [mineBag, theirs] }})) }}; }}
              return o; }})()""")
            print('Gear and potions:', json.dumps(out['kits']))
        if 'cups' in PARTS:
            out['cups'] = await pg.evaluate(f"""(() => {{ const far = [0, 0, 0, 0];
              for (let i = 0; i < {N}; i++) {{ let r = 0; const club = __lab.clubs[i % __lab.clubs.length];
                for (const t of W_BROOM.tiers) {{ const s = wCR.simGame(Object.assign({{ seed: 9000 + i * 11 + r * 3, hammer: (i + r) % 2 }}, __lab.base, {{ teams: [__lab.mine(), __lab.opp(club, t)], skill: wShedSkillOf(t), bags: [null, W_SHED_KIT.opp[t]] }}));
                  if (s.win !== 0) break; r++; }}
                far[r]++; }}
              return {{ out_qf: far[0], out_sf: far[1], out_final: far[2], won: far[3], win: +(100 * far[3] / {N}).toFixed(1) }}; }})()""")
            print('Brass Brooms:', json.dumps(out['cups']))
        if 'single' in PARTS:
            out['single'] = await pg.evaluate(f"""(() => {{ const pw = {{}}, gear = {{}}, pots = {{}}, sit = {{}};
              for (const kind of Object.keys(wCR.pow).filter(k => !W_STARS.some(s => s.kind === k))) {{
                const opp = () => __lab.four(3, 0), base = __lab.play({N}, () => ({{ teams: [__lab.fourOf(kind), opp()], skill: [1, 1], powers: false }})).win, row = {{ base }};
                const one = (id, alt) => __lab.playCast({N}, () => ({{ teams: [__lab.fourOf(kind, alt ? {{ draw: 1, hit: 1 }} : null), opp()], skill: [1, 1], powers: [true, false], powOnly: [id, null] }}), id);
                const P = wCR.pow[kind], P2 = wCR.pow2[kind], U = wCR.ult[kind];
                row[P[0].id] = one(P[0].id); row[P[1].id] = one(P[1].id); row[P2[0].id] = one(P2[0].id, true); row[P2[1].id] = one(P2[1].id, true); row[U.id] = one(U.id);
                pw[kind] = row; }}
              sit.base = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], powers: false }})).win;
              for (const id of [...Object.keys(wCR.sit), 'steady']) sit[id] = __lab.playCast({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], powers: [true, false], powOnly: [id, null] }}), id);
              gear.base = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1] }})).win;
              for (const id of Object.keys(W_SHED_GEAR)) gear[id] = __lab.play({N}, () => ({{ teams: [__lab.geared(id), __lab.four(3, 0)], skill: [1, 1] }})).win;
              pots.base = gear.base;
              for (const id of Object.keys(wCR.potions)) pots[id] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], bags: [{{ [id]: 2 }}, null] }})).win;
              return {{ powers: pw, situation: sit, gear, potions: pots }}; }})()""")
            S = out['single']
            print('One power at a time (your side only; win against the same four with none):')
            for kind, row in S['powers'].items():
                print(f"  {kind} (none {row['base']}%): " + ', '.join(f"{k} {v['win']}% ({v['casts']}/game)" for k, v in row.items() if k != 'base'))
            print('Situation powers and Steady (none ' + str(S['situation']['base']) + '%):', ', '.join(f"{k} {v['win']}% ({v['casts']})" for k, v in S['situation'].items() if k != 'base'))
            print('One piece of gear on all four (none ' + str(S['gear']['base']) + '%):', ', '.join(f"{k} {v}%" for k, v in S['gear'].items() if k != 'base'))
            print('One potion, two in the bag (none ' + str(S['potions']['base']) + '%):', ', '.join(f"{k} {v}%" for k, v in S['potions'].items() if k != 'base'))
        if 'umbral' in PARTS:
            # (every row plays game i on the same seed with the same two fours: Math.random is seeded per game while the fours
            # are drawn, so a hex's swing is measured on the same games as the row without it)
            out['umbral'] = await pg.evaluate(f"""(() => {{ const o = {{}}, rows = {json.dumps(ROWS)}, bag = W_SHED_KIT.opp[4], sk = wShedSkillOf(4), hx = Object.keys(wCR.hexes), MR = Math.random;
              const same = (i, f) => {{ let q = Math.imul(i + 1, 7919) >>> 0; Math.random = () => {{ q = (Math.imul(q, 1103515245) + 12345) >>> 0; return (q >>> 8) / 16777216; }}; try {{ return f(); }} finally {{ Math.random = MR; }} }};
              const play = (n, f) => {{ let w = 0, pts = 0, opp = 0, m = 0, st = 0; for (let i = 0; i < n; i++) {{ const r = wCR.simGame(Object.assign({{ seed: 31000 + i, hammer: i % 2 }}, __lab.base, same(i, () => f(i))));
                if (r.win === 0) w++; pts += r.tot[0]; opp += r.tot[1]; m += r.st[0].made; st += r.st[0].stones; }}
                return {{ win: +(100 * w / n).toFixed(1), pts: +(pts / n).toFixed(2), opp: +(opp / n).toFixed(2), made: +(100 * m / Math.max(1, st)).toFixed(1) }}; }};
              const want = k => !rows || rows.includes(k);
              const nadir = x => play({N}, i => Object.assign({{ teams: [__lab.mine(), wUmbCrFour(3)], skill: sk, bags: [null, bag] }}, x(i)));
              if (want('archmage')) o.archmage = play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 2] }}));
              if (want('lich')) o.lich = play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 3] }}));
              if (want('tier3')) o.tier3 = play({N}, i => ({{ teams: [__lab.mine(), __lab.opp(__lab.clubs[i % __lab.clubs.length], 3)], skill: wShedSkillOf(3), bags: [null, W_SHED_KIT.opp[3]] }}));
              if (want('tierU')) o.tierU = play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, W_SHG.oppBonus[4])], skill: sk, bags: [null, bag] }}));
              if (want('nadir')) o.nadir = nadir(() => ({{}}));
              // (the champion without their own ultimate: what The Sunken Stone is worth)
              if (want('noUlt')) o.noUlt = play({N}, () => {{ const T = wUmbCrFour(3); T.roster.forEach(m => delete m.ult); return {{ teams: [__lab.mine(), T], skill: sk, bags: [null, bag] }}; }});
              for (const h of hx) if (want(h)) o[h] = nadir(() => ({{ hexes: [h] }}));
              // (as the champion draws them: W_NADIR.shed.hexes of them, every such draw in turn; the finale draws two)
              const draws = n => n <= 1 ? hx.map(h => [h]) : hx.flatMap((a, j) => hx.slice(j + 1).map(b => [a, b])), dr = draws(W_NADIR.shed.hexes), two = draws(2);
              if (want('drawn')) o.drawn = nadir(i => ({{ hexes: dr[i % dr.length] }}));
              if (want('two') && W_NADIR.shed.hexes !== 2) o.two = nadir(i => ({{ hexes: two[i % two.length] }}));
              return o; }})()""")
            U = out['umbral']
            print('Umbral (level parity):', ', '.join(f"{k} {v['win']}% ({v['pts']}-{v['opp']}, made {v['made']}%)" for k, v in U.items()))
        await br.close()
    out['n'] = N; out['secs'] = round(time.time() - t0)
    json.dump(out, open(OUT, 'w'), indent=1)
    print(f"{out['secs']}s, {OUT}")

asyncio.run(main())

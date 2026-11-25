"""Realm jousting balance bot (issue #117, phase 12): headless jousting matches and Gilded Lances in dist/realm.html.

  python3 test/realm_lists_lab.py 400            400 matches for every cell, and 400 cups
  python3 test/realm_lists_lab.py 400 'W_JTG.oppBonus = { 1: 0, 2: 1, 3: 2 }'    a tuning override, run in the page first (the CPU's odds cleared after it)
  python3 test/realm_lists_lab.py 600 '' tiers,gaps    only some parts (tiers, gaps, skills, sides, powers, plans, mounts,
                                                       squires, ground, kits, cups, single, umbral)
  python3 test/realm_lists_lab.py 400 '' umbral nadir,mist    only those rows of the Umbral (to run rows in several processes)
  python3 test/realm_lists_lab.py 400 '' single elf,sit,gear  only those rows of single (kinds, sit, gear, pots)

Every match is the jousting engine ridden to a result, headless (wJT.simMatch), as Simulate rides it: two heats of three
courses, the Lists' ways on (the churned sand and the pennant wind), powers on, your four riding as a Knight would, the
other four at the skill of the tier (Squire, Knight, Archmage). No match ends level (the tilt for the crown). Your four:
a fresh journey with players at level 3, the captain's pick of riders, squires and mounts. Every match draws both fours
afresh (a player's ratings are rolled a point either way, so one draw is luck), each rider bringing the pair of powers
their name picks, and each cell has its own run of seeds. About 150 ms a match (every
rider is new, so the CPU works out its odds afresh), so a cell of 400 takes a minute and is good to about 2.5 points
either way (one standard error); 1,000 to about 1.6. Run parts in several processes (the parts and rows arguments).
- tiers: against a rival's four as the world sets them (their level is yours plus the tier, less one, with the tier's
  rating bonus, W_JTG.oppBonus, and skill), no bags (the kits part adds them): round every club, a match each.
- gaps: their level yours plus a gap (-1 to +3), no bonus, both Knights, their four your own kinds (so level is all that
  differs; the same for skills, powers, plans, mounts, squires and ground).
- skills: even level, their side a Squire, a Knight, an Archmage; and their own ladder (Archmage against Knight, Knight
  against Squire, the same kinds on both sides). Each row also gives jousting's rates: lances broken a course (both
  sides), helm breaks a course, the matches with an unhorsing, and the tilt for the crown.
- sides: the same four on both sides (one draw, copied), Knight against Knight: side 0's win %, bare (no powers, no
  ground) and as Simulate rides it, to tell a side's edge from the noise.
- powers: even level, powers for both, neither, yours only and theirs only.
- plans: your side held to one plan all match (fix: an aim, a guard and a pace; 12 of them), against a Knight (who rides
  the mix no plan always ridden beats) and against an Archmage (who reads what you ride).
- mounts: both your riders on one mount (Charger, Destrier, Courser), against the captain's pick for each; three courses
  a heat and five.
- squires: your corner as a Knight works it (the captain's), none at all (no jobs), each job left out, and a Squire's
  corner (two jobs on a whim).
- ground: the Lists' ways on and off, the sand alone and the wind alone, your side held to the rut or beside it; and a
  Knight against a Squire, ways on and off.
- kits: by tier, plain; their bag only (as Simulate rides it); both bags; and the full kit (both bags, and your four in
  gear, a piece each).
- cups: the Gilded Lance, Simulate every round (W_LANCE.tiers, their bags in): how far it gets, how often it wins.
- single: each thing on its own, even level, both Knights, against the same match without it. Powers: for every kind, a
  four of that kind with only that one power castable by your side (powOnly; the other side has none), against the
  four with no powers; each lance power, shield power (the first and the second pick) and ultimate, with how often it
  was cast a match; and the situation powers with your own four. Gear: each piece on every one of your four. Potions:
  a bag of two of that one, given as a Knight would.
- umbral (#117, phase 11): your four at level 3 against level 3 (level parity), as Simulate rides the Hollow Lists'
  champion (three courses a heat, the Lists' ways off, your four riding as a Knight). The Archmage and the Lich (no
  bonus, no bags: archmage, lich); tier 3 as the world sets it (tier3) and tier U on your own kinds (tierU: W_JTG.oppBonus[4],
  the Lich, a full bag) for reference; the Nadir four (the champion's match: nadir) with no hexes, without the champion's
  own ultimate (noUlt), each hex alone (mist, nag, cold, shroud), as many drawn as the champion draws (every draw in
  turn: drawn) and two (the finale's round: two). Every row plays match i with the same seed and the same fours
  (Math.random seeded per match), so a hex's swing is measured on the same matches as the row without it.
Every cell reports side 0's win %, its points a match (and theirs), its lances broken a course and its potions given a
match where it has a bag. Writes /tmp/realm_lists_lab.json."""
import asyncio, json, sys, os, time, functools
print = functools.partial(print, flush=True)
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 400
OVR = sys.argv[2] if len(sys.argv) > 2 else ''
ALL = 'tiers,gaps,skills,sides,powers,plans,mounts,squires,ground,kits,cups,single,umbral'
PARTS = set((sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else ALL).split(','))
ROWS = sys.argv[4].split(',') if len(sys.argv) > 4 and sys.argv[4] else None
OUT = os.environ.get('LISTS_LAB_OUT', '/tmp/realm_lists_lab.json')

SETUP = r"""
window.__lab = {};
__lab.kinds = null;
// a four's side as the engine takes it, the captain's pick (wListsOpp's: the two best riders, each on the mount that
// suits them, the two best squires, the best rider for the tilt)
__lab.side = (roster, name, courses) => { const A = wJT.autoSquad(roster);
  return { name, short: name.slice(0, 3).toUpperCase(), roster, riders: A.riders, squires: A.squires, mounts: A.riders.map(i => wJT.mountFor(wJtRsOfR(roster[i].r), courses || 3).m), best: wJT.bestOf(roster, A.riders) }; };
// a four of kinds at a level (with the tier's rating bonus spread as wListsOpp spreads it), each rider bringing the pair
// of powers their name picks
__lab.four = (lvl, bonus, kinds, name, courses) => { kinds = kinds || __lab.kinds;
  const roster = kinds.map(kind => { const m = wListsPlayer(wMakePlayer({ kind, lvl }, 'opp')); m.pw = wJT.pwByName(m.n); return m; });
  if (bonus) roster.forEach((p, j) => { for (let i = 0; i < bonus; i++) { const s = wJT.stats[(i * 3 + j) % wJT.stats.length]; p.r[s] = Math.min(wJT.cap, p.r[s] + 1); } });
  return __lab.side(roster, name || 'Them', courses); };
__lab.mine = courses => __lab.four(3, 0, null, 'Us', courses);
// a rival as the world sets it at a tier, its kept four drawn again each match
__lab.opp = (club, t) => { delete wJtg().opp[club]; return wListsOpp(club, t); };
__lab.base = { courses: 3, powers: true, ground: true };
__lab.seed0 = 1000;
// (each cell its own run of seeds: the same seeds in every cell would carry one run's luck into all of them)
__lab.cell = () => { __lab.seed0 += 100003; return __lab.seed0; };
// the match's options: o(i) gives { teams: [A, B], skill, ... }; the sides' riders, squires, mounts and best from the teams
__lab.opts = (o, s0, i) => { const T = o.teams, x = Object.assign({ seed: s0 + i }, __lab.base, o);
  for (const k of ['riders', 'squires', 'mounts', 'best']) if (x[k] === undefined) x[k] = [T[0][k], T[1][k]];
  return x; };
__lab.one = (i, o, s0) => wJT.simMatch(__lab.opts(o, s0, i));
// n matches: { win, pts, opp (points a match each side), brk (side 0's lances broken a course), rates: { brk (both
// sides, a course), helm (a course), unh (matches with an unhorsing), tilt (matches to the tilt) }, pots (side 0's
// potions a match), casts (side 0's casts of id a match, when asked) }
__lab.play = (n, o, id) => { let w = 0, pts = 0, opp = 0, b0 = 0, c0 = 0, brk = 0, helm = 0, crs = 0, unh = 0, tilt = 0, pots = 0, casts = 0; const s0 = __lab.cell();
  for (let i = 0; i < n; i++) { const r = __lab.one(i, o(i), s0); if (r.win === 0) w++; pts += r.tot[0]; opp += r.tot[1];
    b0 += r.st[0].breaks; c0 += r.st[0].courses; brk += r.st[0].breaks + r.st[1].breaks; helm += r.st[0].helms + r.st[1].helms; crs += r.st[0].courses + r.st[1].courses;
    if (r.st[0].unhorse + r.st[1].unhorse) unh++; if (r.tilt) tilt++;
    pots += (r.pots || []).filter(x => x.side === 0).length;
    if (id) casts += ((r.powers && r.powers.casts) || []).filter(x => x.side === 0 && x.id === id).length; }
  const out = { win: +(100 * w / n).toFixed(1), pts: +(pts / n).toFixed(2), opp: +(opp / n).toFixed(2), brk: +(b0 / Math.max(1, c0)).toFixed(3),
    rates: { brk: +(brk / Math.max(1, crs)).toFixed(3), helm: +(helm / Math.max(1, crs)).toFixed(3), unh: +(100 * unh / n).toFixed(1), tilt: +(100 * tilt / n).toFixed(1) } };
  if (pots) out.pots = +(pots / n).toFixed(2);
  if (id) out.casts = +(casts / n).toFixed(2);
  return out; };
// a four of one kind at level 3 (alt: the second pick of each pair)
__lab.fourOf = (kind, alt) => { const T = __lab.four(3, 0, [kind, kind, kind, kind], 'Us'); T.roster.forEach(m => { m.pw = { lance: alt ? 1 : 0, shield: alt ? 1 : 0 }; }); return T; };
__lab.gearOn = (T, ids) => { T.roster = T.roster.map((m, i) => { const id = Array.isArray(ids) ? ids[i % ids.length] : ids, G = Object.assign({ id }, W_GEAR[id]);
  return Object.assign({}, m, { r: wGearRate(m.r, G, wJT.cap), gear: wGearTag(G) }); }); return T; };
__lab.geared = id => __lab.gearOn(__lab.mine(), id);
0"""

async def main():
    t0 = time.time(); out = {}
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page()
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['elf', 'spider', 'gorgon', 'dwarf']; let i = 0; while (wRoster().length < 4) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 3 }, 'tavern')); for (const q of wRoster()) { q.lvl = 3; delete q.jt; wJtOf(q); } WG.lists = null; wListsSync(); LAB = true; })()")
        await pg.evaluate(SETUP)
        await pg.evaluate("__lab.kinds = wListsMine().roster.map(m => m.kind); __lab.clubs = wBallClubs()")
        if OVR: await pg.evaluate(OVR); await pg.evaluate('wJT.model.reset()')
        print('your four:', await pg.evaluate("__lab.kinds.join(', ')"), f'({N} a cell)')
        fmt = lambda v: f"{v['win']}% ({v['pts']}-{v['opp']}, brk {v['brk']})"

        if 'tiers' in PARTS:
            out['tiers'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const t of [1, 2, 3]) o[t] = __lab.play({N}, i => ({{ teams: [__lab.mine(), __lab.opp(__lab.clubs[i % __lab.clubs.length], t)], skill: wListsSkillOf(t) }})); return o; }})()""")
            print('Tiers, as the world sets them:', ', '.join(f"{k} {fmt(v)} unhorsing in {v['rates']['unh']}%" for k, v in out['tiers'].items()))
        if 'gaps' in PARTS:
            out['gaps'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const g of [-1, 0, 1, 2, 3]) o[g] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3 + g, 0)], skill: [1, 1] }})); return o; }})()""")
            print('Level gap:', ', '.join(f'{k} {fmt(v)}' for k, v in out['gaps'].items()))
        if 'skills' in PARTS:
            out['skills'] = await pg.evaluate(f"""(() => {{ const o = {{}}, go = sk => __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: sk }}));
              for (const k of [0, 1, 2]) o[['Squire', 'Knight', 'Archmage'][k]] = go([1, k]);
              o.archmageKnight = go([2, 1]); o.knightSquire = go([1, 0]); o.archmageArchmage = go([2, 2]); o.squireSquire = go([0, 0]); return o; }})()""")
            print('Skills:', ', '.join(f"{k} {fmt(v)}" for k, v in out['skills'].items()))
            print('  rates (both sides: breaks a course, helm breaks a course, matches with an unhorsing %, to the tilt %):', ', '.join(f"{k} {v['rates']}" for k, v in out['skills'].items()))
        if 'sides' in PARTS:
            out['sides'] = await pg.evaluate(f"""(() => {{ const same = () => {{ const A = __lab.mine(), B = JSON.parse(JSON.stringify(A)); B.name = 'Them'; B.short = 'THM'; return [A, B]; }};
              const keep = __lab.base, o = {{}};
              o.full = __lab.play({4 * N}, () => ({{ teams: same(), skill: [1, 1] }}));
              __lab.base = {{ courses: 3 }}; try {{ o.bare = __lab.play({4 * N}, () => ({{ teams: same(), skill: [1, 1] }})); o.plain = __lab.play({4 * N}, () => ({{ skill: [1, 1], teams: [{{ name: 'Us' }}, {{ name: 'Them' }}], riders: [[0, 1], [0, 1]], squires: [[2, 3], [2, 3]], mounts: [null, null], best: [null, null] }})); }} finally {{ __lab.base = keep; }}
              return o; }})()""")
            print(f'Sides, the same four both sides ({4 * N} each):', ', '.join(f'{k} {fmt(v)}' for k, v in out['sides'].items()))
        if 'powers' in PARTS:
            out['powers'] = await pg.evaluate(f"""(() => {{ const go = pw => __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], powers: pw }}));
              return {{ both: go(true), neither: go(false), mine: go([true, false]), theirs: go([false, true]) }}; }})()""")
            print('Powers:', ', '.join(f'{k} {fmt(v)}' for k, v in out['powers'].items()))
        if 'plans' in PARTS:
            out['plans'] = await pg.evaluate(f"""(() => {{ const o = {{}};
              for (const them of [1, 2]) {{ const row = {{ auto: __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, them] }})) }};
                for (const aim of ['shield', 'body', 'helm']) for (const guard of ['angled', 'square']) for (const pace of ['canter', 'gallop'])
                  row[`${{aim}}/${{guard}}/${{pace}}`] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, them], fix: [{{ aim, guard, pace }}, null] }}));
                o[them === 1 ? 'knight' : 'archmage'] = row; }}
              return o; }})()""")
            for k0, row in out['plans'].items(): print(f"Your plan, held all match, against {'an Archmage' if k0 == 'archmage' else 'a Knight'}:", ', '.join(f"{k} {v['win']}%" for k, v in row.items()))
        if 'mounts' in PARTS:
            out['mounts'] = await pg.evaluate(f"""(() => {{ const o = {{}};
              for (const c of [3, 5]) {{ const row = {{}}, go = m => __lab.play({N}, () => {{ const A = __lab.mine(c), B = __lab.four(3, 0, null, 'Them', c); return {{ teams: [A, B], skill: [1, 1], courses: c, mounts: [m ? [m, m] : A.mounts, B.mounts] }}; }});
                row.captain = go(null); for (const m of ['charger', 'destrier', 'courser']) row[m] = go(m); o[c] = row; }}
              return o; }})()""")
            for c, row in out['mounts'].items(): print(f'Your mounts, {c} courses a heat (win, matches with an unhorsing):', ', '.join(f"{k} {v['win']}% ({v['rates']['unh']}%)" for k, v in row.items()))
        if 'squires' in PARTS:
            out['squires'] = await pg.evaluate(f"""(() => {{ const go = cb => __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], cornerBy: [cb, null] }}));
              return {{ captain: go(null), none: go('none'), noTend: go('no-tend'), noSteady: go('no-steady'), noGirth: go('no-girth'), whim: go(0) }}; }})()""")
            print('Your squires:', ', '.join(f"{k} {v['win']}%" for k, v in out['squires'].items()))
        if 'ground' in PARTS:
            out['ground'] = await pg.evaluate(f"""(() => {{ const go = (x, sk) => __lab.play({N}, () => Object.assign({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: sk || [1, 1] }}, x));
              return {{ on: go({{}}), off: go({{ ground: false }}), sand: go({{ ground: {{ wind: false }} }}), wind: go({{ ground: {{ sand: false }} }}), rut: go({{ lineBy: ['rut', null] }}), side: go({{ lineBy: ['side', null] }}),
                squireOn: go({{}}, [0, 1]), squireOff: go({{ ground: false }}, [0, 1]) }}; }})()""")
            print('The Lists\' ways (squireOn/Off: your Squire against a Knight):', ', '.join(f"{k} {v['win']}%" for k, v in out['ground'].items()))
        if 'kits' in PARTS:
            out['kits'] = await pg.evaluate(f"""(() => {{ const o = {{}}, mineBag = {{ draught: 2, jtliniment: 1, jttonic: 1, jtoil: 1 }}, gearOf = ['jt_ironwood', 'jt_saddle', 'jt_helm', 'jt_favour'];
              for (const t of [1, 2, 3]) {{ const opp = i => __lab.opp(__lab.clubs[i % __lab.clubs.length], t), sk = wListsSkillOf(t), theirs = W_LISTS_KIT.opp[t];
                o[t] = {{ plain: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk }})), theirs: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk, bags: [null, theirs] }})),
                  both: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk, bags: [mineBag, theirs] }})), full: __lab.play({N}, i => ({{ teams: [__lab.gearOn(__lab.mine(), gearOf), opp(i)], skill: sk, bags: [mineBag, theirs] }})) }}; }}
              return o; }})()""")
            for t, row in out['kits'].items(): print(f'Gear and potions, tier {t}:', ', '.join(f"{k} {v['win']}%" + (f" ({v['pots']} potions)" if 'pots' in v else '') for k, v in row.items()))
        if 'cups' in PARTS:
            out['cups'] = await pg.evaluate(f"""(() => {{ const far = [0, 0, 0, 0], s0 = __lab.cell();
              for (let i = 0; i < {N}; i++) {{ let r = 0; const club = __lab.clubs[i % __lab.clubs.length];
                for (const t of W_LANCE.tiers) {{ const s = __lab.one(i * 3 + r, {{ teams: [__lab.mine(), __lab.opp(club, t)], skill: wListsSkillOf(t), bags: [null, W_LISTS_KIT.opp[t]] }}, s0);
                  if (s.win !== 0) break; r++; }}
                far[r]++; }}
              return {{ out_qf: far[0], out_sf: far[1], out_final: far[2], won: far[3], win: +(100 * far[3] / {N}).toFixed(1) }}; }})()""")
            print('Gilded Lances:', json.dumps(out['cups']))
        if 'single' in PARTS:
            out['single'] = await pg.evaluate(f"""(() => {{ const pw = {{}}, gear = {{}}, pots = {{}}, sit = {{}}, opp = () => __lab.four(3, 0), rows = {json.dumps(ROWS)}, want = k => !rows || rows.includes(k);
              for (const kind of Object.keys(wJT.pow).filter(k => !W_STARS.some(s => s.kind === k) && want(k))) {{
                const row = {{ base: __lab.play({N}, () => ({{ teams: [__lab.fourOf(kind), opp()], skill: [1, 1], powers: false }})).win }};
                const one = (id, alt) => __lab.play({N}, () => ({{ teams: [__lab.fourOf(kind, alt), opp()], skill: [1, 1], powers: [true, false], powOnly: [id, null] }}), id);
                const P = wJT.pow[kind], P2 = wJT.pow2[kind], U = wJT.ult[kind];
                row[P[0].id] = one(P[0].id); row[P[1].id] = one(P[1].id); row[P2[0].id] = one(P2[0].id, true); row[P2[1].id] = one(P2[1].id, true); row[U.id] = one(U.id);
                pw[kind] = row; }}
              if (want('sit')) {{ sit.base = __lab.play({N}, () => ({{ teams: [__lab.mine(), opp()], skill: [1, 1], powers: false }})).win;
              for (const id of Object.keys(wJT.sit)) sit[id] = __lab.play({N}, () => ({{ teams: [__lab.mine(), opp()], skill: [1, 1], powers: [true, false], powOnly: [id, null] }}), id); }}
              if (want('gear')) {{ gear.base = __lab.play({N}, () => ({{ teams: [__lab.mine(), opp()], skill: [1, 1] }})).win;
              for (const id of Object.keys(W_LISTS_GEAR)) gear[id] = __lab.play({N}, () => ({{ teams: [__lab.geared(id), opp()], skill: [1, 1] }})).win; }}
              if (want('pots')) {{ pots.base = __lab.play({N}, () => ({{ teams: [__lab.mine(), opp()], skill: [1, 1], bags: [{{}}, null] }})).win;
              for (const id of Object.keys(wJT.potions)) pots[id] = __lab.play({N}, () => ({{ teams: [__lab.mine(), opp()], skill: [1, 1], bags: [{{ [id]: 2 }}, null] }})); }}
              return {{ powers: pw, situation: sit, gear, potions: pots }}; }})()""")
            S = out['single']
            print('One power at a time (your side only; win against the same four with none):')
            for kind, row in S['powers'].items():
                print(f"  {kind} (none {row['base']}%): " + ', '.join(f"{k} {v['win']}% ({v['casts']}/match)" for k, v in row.items() if k != 'base'))
            if S['situation']: print('Situation powers (none ' + str(S['situation']['base']) + '%):', ', '.join(f"{k} {v['win']}% ({v['casts']})" for k, v in S['situation'].items() if k != 'base'))
            if S['gear']: print('One piece of gear on all four (none ' + str(S['gear']['base']) + '%):', ', '.join(f"{k} {v}%" for k, v in S['gear'].items() if k != 'base'))
            if S['potions']: print('One potion, two in the bag (none ' + str(S['potions']['base']) + '%):', ', '.join(f"{k} {v['win']}% ({v.get('pots', 0)} given)" for k, v in S['potions'].items() if k != 'base'))
        if 'umbral' in PARTS:
            # (every row plays match i on the same seed with the same two fours: Math.random is seeded per match while the
            # fours are drawn, so a hex's swing is measured on the same matches as the row without it)
            out['umbral'] = await pg.evaluate(f"""(() => {{ const o = {{}}, rows = {json.dumps(ROWS)}, bag = W_LISTS_KIT.opp[4], sk = wListsSkillOf(4), hx = Object.keys(wJT.hexes), MR = Math.random, keep = __lab.base;
              const same = (i, f) => {{ let q = Math.imul(i + 1, 7919) >>> 0; Math.random = () => {{ q = (Math.imul(q, 1103515245) + 12345) >>> 0; return (q >>> 8) / 16777216; }}; try {{ return f(); }} finally {{ Math.random = MR; }} }};
              const play = (n, f) => {{ let w = 0, pts = 0, opp = 0, b0 = 0, c0 = 0; for (let i = 0; i < n; i++) {{ const r = __lab.one(i, same(i, () => f(i)), 31000);
                if (r.win === 0) w++; pts += r.tot[0]; opp += r.tot[1]; b0 += r.st[0].breaks; c0 += r.st[0].courses; }}
                return {{ win: +(100 * w / n).toFixed(1), pts: +(pts / n).toFixed(2), opp: +(opp / n).toFixed(2), brk: +(b0 / Math.max(1, c0)).toFixed(3) }}; }};
              const want = k => !rows || rows.includes(k);
              __lab.base = {{ courses: 3, powers: true, ground: false }};
              try {{
                const nadir = x => play({N}, i => Object.assign({{ teams: [__lab.mine(), wUmbJtFour(3)], skill: sk, bags: [null, bag] }}, x(i)));
                if (want('archmage')) o.archmage = play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 2] }}));
                if (want('lich')) o.lich = play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 3] }}));
                if (want('tier3')) o.tier3 = play({N}, i => ({{ teams: [__lab.mine(), __lab.opp(__lab.clubs[i % __lab.clubs.length], 3)], skill: wListsSkillOf(3), bags: [null, W_LISTS_KIT.opp[3]] }}));
                if (want('tierU')) o.tierU = play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, W_JTG.oppBonus[4])], skill: sk, bags: [null, bag] }}));
                if (want('nadir')) o.nadir = nadir(() => ({{}}));
                // (the champion without her own ultimate: what The Pale Charge is worth)
                if (want('noUlt')) o.noUlt = play({N}, () => {{ const T = wUmbJtFour(3); T.roster.forEach(m => delete m.ult); return {{ teams: [__lab.mine(), T], skill: sk, bags: [null, bag] }}; }});
                for (const h of hx) if (want(h)) o[h] = nadir(() => ({{ hexes: [h], hexOn: 0 }}));
                // (as the champion draws them: W_NADIR.lists.hexes of them, every such draw in turn; the finale draws two)
                const draws = n => n <= 1 ? hx.map(h => [h]) : hx.flatMap((a, j) => hx.slice(j + 1).map(b => [a, b])), dr = draws(W_NADIR.lists.hexes), two = draws(2);
                if (want('drawn')) o.drawn = nadir(i => ({{ hexes: dr[i % dr.length], hexOn: 0 }}));
                if (want('two') && W_NADIR.lists.hexes !== 2) o.two = nadir(i => ({{ hexes: two[i % two.length], hexOn: 0 }}));
              }} finally {{ __lab.base = keep; }}
              return o; }})()""")
            print('Umbral (level parity):', ', '.join(f"{k} {fmt(v)}" for k, v in out['umbral'].items()))
        await br.close()
    out['n'] = N; out['secs'] = round(time.time() - t0)
    json.dump(out, open(OUT, 'w'), indent=1)
    print(f"{out['secs']}s, {OUT}")

asyncio.run(main())

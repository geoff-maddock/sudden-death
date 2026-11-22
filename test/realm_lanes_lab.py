"""Realm bowling balance bot (issue #100, phase 10): headless bowling matches and Gutter Cups in dist/realm.html.

  python3 test/realm_lanes_lab.py 200            200 games for every cell, and 200 cups
  python3 test/realm_lanes_lab.py 200 'W_LNG.oppBonus = { 1: 0, 2: 2, 3: 5 }'    a tuning override, run in the page first
  python3 test/realm_lanes_lab.py 300 '' tiers,gaps    only some parts (tiers, gaps, skills, powers, lines, stances,
                                                       kits, hall, cups, read, single, umbral)
  python3 test/realm_lanes_lab.py 300 '' umbral        only the Umbral (issue #99, phase 4g)

Every game is the bowling engine played to a final, headless (wBL.simGame), as Simulate plays it: one Baker game of ten
frames, the hall on (the tide mid), powers on, your five bowling as a Knight would, the other side at the skill of the
tier (Squire, Knight, Archmage). No game ends level (the roll-off). Your five: a fresh journey with five players at
level 3, in the order their ratings suggest.
- tiers: against a rival's five as the world sets them (their level is yours plus the tier, less one, with the tier's
  rating bonus, W_LNG.oppBonus, and skill): the games you really bowl. Round every club, a game each.
- gaps: their level yours plus a gap (-1 to +3), no bonus, both Knights, their five your own kinds (so level is all that
  differs; the same for skills, powers, lines, stances and hall).
- skills: even level, their bowlers a Squire, a Knight, an Archmage.
- powers: even level, powers for both, neither, yours only and theirs only.
- lines: your line fixed all game (Deep inside, the pocket, Up the boards), theirs their own call.
- stances: your tempo and ball fixed all game.
- kits: by tier, plain; their bag only (as Simulate plays it); both bags; and the full kit (both bags, and your five in
  gear, a piece each).
- hall: the hall on and off; the tide high, mid and low; and how often the weaker side (a level down) wins with each.
- cups: Simulate every round (the final best of three): how far it gets, how often it wins.
- read: reading the transition. An Archmage that moves (reads the oil as it is and changes its line) against one that
  doesn't (plans on the fresh lane, the pocket every ball); the same with the transition off (the lanes kept as
  dressed), where reading should be worth nothing; Knight against Knight with it on and off (the scores); and the
  order: your five in the order the ratings suggest, in the reverse of it, and shuffled.
- single: each thing on its own, even level, both Knights, against the same game without it. Powers: for every kind, a
  five of that kind, with only that one power castable by your side (powOnly; the other side has none), against the five
  with no powers; each strike power, spare power, second power and ultimate, with how often it was cast a game; and the
  situation powers and Steady with your own five. Gear: each piece on every one of your five. Potions: a bag of two of
  that one, given as a Knight would.
- umbral (issue #99, phase 4g): your five at level 3 against level 3 (level parity), as Simulate plays the Drowned
  Lanes' champion (your five bowling as a Knight). The Lich against the Archmage (your own kinds, no bonus, no bags);
  tier 3 as the world sets it and tier U on your own kinds (W_LNG.oppBonus[4], the Lich, a full bag) for reference; the
  Nadir five (the champion's game) with no hexes, without the champion's own ultimate, each hex alone, as many drawn as
  the champion draws (every draw in turn), and two (the finale's round). The rows are paired: game i of the Archmage,
  Lich and tier U rows plays the same two fives on the same seed, and so does game i of every Nadir row, so a hex's
  swing is measured on the same games as the row without it.
Every game reports side 0's win %, its average score and its strike %. Writes /tmp/realm_lanes_lab.json."""
import asyncio, json, sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 200
OVR = sys.argv[2] if len(sys.argv) > 2 else ''
PARTS = set((sys.argv[3] if len(sys.argv) > 3 else 'tiers,gaps,skills,powers,lines,stances,kits,hall,cups,read,single,umbral').split(','))

SETUP = r"""
window.__lab = {};
// your five (level 3) and a five of kinds at a level (with the tier's rating bonus), as the engine takes them. Every game
// draws its fives afresh (a player's ratings are rolled a point either way, so one draw is luck)
__lab.kinds = null;
__lab.five = (lvl, bonus, kinds) => { kinds = kinds || __lab.kinds;
  const roster = kinds.map(kind => wLanesPlayer(wMakePlayer({ kind, lvl }, 'opp')));
  if (bonus) roster.forEach((p, j) => { for (let i = 0; i < bonus; i++) { const s = wBL.stats[(i * 5 + j) % 6]; p.r[s] = Math.min(wBL.cap, p.r[s] + 1); } });
  return { name: 'Them', short: 'THM', roster }; };
__lab.mine = () => Object.assign(__lab.five(3, 0), { name: 'Us', short: 'US' });
// a rival as the world sets it at a tier, its kept five drawn again each game
__lab.opp = (club, t) => { delete wLng().opp[club]; return wLanesOpp(club, t); };
__lab.base = { frames: 10, hall: true, tide: 'mid', powers: true };
__lab.seed0 = 1000;
// (each cell its own run of seeds: the same seeds in every cell would carry one run's luck into all of them)
__lab.cell = () => { __lab.seed0 += 100003; return __lab.seed0; };
__lab.one = (i, o, s0) => wBL.simGame(Object.assign({ seed: s0 + i }, __lab.base, o));
// play n games; o(i) gives the options; { win, score (side 0's average), strikes (side 0's strike %), ro (roll-offs %) }
__lab.play = (n, o, seed0) => { let w = 0, sc = 0, x = 0, f = 0, ro = 0; const s0 = seed0 || __lab.cell();
  for (let i = 0; i < n; i++) { const r = __lab.one(i, o(i), s0); if (r.win === 0) w++; sc += r.game[0]; x += r.st[0].strikes; f += r.st[0].firsts; if (r.ro) ro++; }
  return { win: +(100 * w / n).toFixed(1), score: +(sc / n).toFixed(1), strikes: +(100 * x / Math.max(1, f)).toFixed(1), ro: +(100 * ro / n).toFixed(1) }; };
// play n games and count side 0's casts of one power id: { win, casts (a game) }
__lab.playCast = (n, o, id) => { let w = 0, c = 0; const s0 = __lab.cell();
  for (let i = 0; i < n; i++) { const r = wBL.simGame(Object.assign({ seed: s0 + i }, __lab.base, o(i))); if (r.win === 0) w++; c += (r.casts || []).filter(x => x.side === 0 && x.id === id).length; }
  return { win: +(100 * w / n).toFixed(1), casts: +(c / n).toFixed(2) }; };
// a five of one kind at level 3 (pw: { strike, spare } 1 for a bowler's second power)
__lab.fiveOf = (kind, pw) => ({ name: 'Us', short: 'US', roster: [0, 1, 2, 3, 4].map(() => Object.assign(wLanesPlayer(wMakePlayer({ kind, lvl: 3 }, 'opp')), pw ? { pw } : {})) });
__lab.geared = id => { const T = __lab.mine(), G = Object.assign({ id }, W_GEAR[id]); T.roster = T.roster.map(m => Object.assign({}, m, { r: wGearRate(m.r, G, wBL.cap), gear: wGearTag(G) })); return T; };
0"""

async def main():
    t0 = time.time(); out = {}
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page()
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wBL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['elf', 'spider', 'gorgon', 'dwarf']; let i = 0; while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 3 }, 'tavern')); for (const q of wRoster()) { q.lvl = 3; wBlOf(q); } wFiveSync(); LAB = true; })()")
        await pg.evaluate(SETUP)
        await pg.evaluate("__lab.kinds = wFiveMine().roster.map(m => m.kind); __lab.clubs = wBallClubs()")
        if OVR: await pg.evaluate(OVR)
        print('your five:', await pg.evaluate("__lab.kinds.join(', ')"))

        if 'tiers' in PARTS:
            out['tiers'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const t of [1, 2, 3]) o[t] = __lab.play({N}, i => ({{ teams: [__lab.mine(), __lab.opp(__lab.clubs[i % __lab.clubs.length], t)], skill: wLanesSkillOf(t) }})); return o; }})()""")
            print('Tiers, as the world sets them:', json.dumps(out['tiers']))
        if 'gaps' in PARTS:
            out['gaps'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const g of [-1, 0, 1, 2, 3]) o[g] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.five(3 + g, 0)], skill: [1, 1] }})); return o; }})()""")
            print('Level gap:', json.dumps(out['gaps']))
        if 'skills' in PARTS:
            out['skills'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const k of [0, 1, 2]) o[['Squire', 'Knight', 'Archmage'][k]] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, k] }})); return o; }})()""")
            print('Their skill:', json.dumps(out['skills']))
        if 'powers' in PARTS:
            out['powers'] = await pg.evaluate(f"""(() => {{ const go = pw => __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 1], powers: pw }}));
              return {{ both: go(true), neither: go(false), mine: go([true, false]), theirs: go([false, true]) }}; }})()""")
            print('Powers:', json.dumps(out['powers']))
        if 'lines' in PARTS:
            out['lines'] = await pg.evaluate(f"""(() => {{ const o = {{ auto: __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 1] }})) }};
              for (const l of ['deep', 'pocket', 'boards']) o[l] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 1], fix: [{{ line: l }}, null] }})); return o; }})()""")
            print('Your line, fixed:', json.dumps(out['lines']))
        if 'stances' in PARTS:
            out['stances'] = await pg.evaluate(f"""(() => {{ const o = {{}};
              for (const tempo of ['steady', 'quick']) for (const ball of ['heavy', 'light']) o[tempo + '/' + ball] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 1], fix: [{{ tempo, ball }}, null] }})); return o; }})()""")
            print('Your tempo and ball, fixed:', json.dumps(out['stances']))
        if 'kits' in PARTS:
            out['kits'] = await pg.evaluate(f"""(() => {{ const o = {{}}, mineBag = {{ draught: 2, blsteady: 1, blchalk: 1, bloil: 1 }}, gearOf = ['bl_reactive', 'bl_brace', 'bl_rosin', 'bl_urethane', 'bl_shoes'];
              const geared = () => {{ const T = __lab.mine(); T.roster = T.roster.map((m, i) => {{ const G = Object.assign({{ id: gearOf[i] }}, W_GEAR[gearOf[i]]); return Object.assign({{}}, m, {{ r: wGearRate(m.r, G, wBL.cap), gear: wGearTag(G) }}); }}); return T; }};
              for (const t of [1, 2, 3]) {{ const opp = i => __lab.opp(__lab.clubs[i % __lab.clubs.length], t), sk = wLanesSkillOf(t), theirs = W_LANES_KIT.opp[t];
                o[t] = {{ plain: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk }})), theirs: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk, bags: [null, theirs] }})),
                  both: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk, bags: [mineBag, theirs] }})), full: __lab.play({N}, i => ({{ teams: [geared(), opp(i)], skill: sk, bags: [mineBag, theirs] }})) }}; }}
              return o; }})()""")
            print('Gear and potions:', json.dumps(out['kits']))
        if 'hall' in PARTS:
            out['hall'] = await pg.evaluate(f"""(() => {{ const go = (lv, x) => __lab.play({N}, () => Object.assign({{ teams: [__lab.mine(), __lab.five(lv, 0)], skill: [1, 1] }}, x));
              return {{ on: go(3, {{}}), off: go(3, {{ hall: false }}), high: go(3, {{ tide: 'high' }}), low: go(3, {{ tide: 'low' }}), upOn: go(4, {{}}), upOff: go(4, {{ hall: false }}) }}; }})()""")
            print('The hall and the tide:', json.dumps(out['hall']))
        if 'cups' in PARTS:
            out['cups'] = await pg.evaluate(f"""(() => {{ const far = [0, 0, 0, 0]; let finals = 0, three = 0;
              for (let i = 0; i < {N}; i++) {{ let r = 0; const club = __lab.clubs[i % __lab.clubs.length];
                for (const [ri, t] of W_GUTTER.tiers.entries()) {{ const best = W_GUTTER.bestOf[ri], need = Math.ceil(best / 2); let a = 0, b = 0, g = 0;
                  while (a < need && b < need) {{ const s = wBL.simGame(Object.assign({{ seed: 9000 + i * 11 + r * 3 + g++ }}, __lab.base, {{ teams: [__lab.mine(), __lab.opp(club, t)], skill: wLanesSkillOf(t) }})); if (s.win === 0) a++; else b++; }}
                  if (best > 1) {{ finals++; if (a + b === 3) three++; }}
                  if (b >= need) break; r++; }}
                far[r]++; }}
              return {{ out_qf: far[0], out_sf: far[1], out_final: far[2], won: far[3], win: +(100 * far[3] / {N}).toFixed(1), finals_to_three: finals ? +(100 * three / finals).toFixed(1) : null }}; }})()""")
            print('Gutter Cups:', json.dumps(out['cups']))
        if 'read' in PARTS:
            out['read'] = await pg.evaluate(f"""(() => {{ const am = x => __lab.play({N}, () => Object.assign({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [2, 2], noRead: [false, true], fix: [null, {{ line: 'pocket' }}] }}, x));
              const kk = x => __lab.play({N}, () => Object.assign({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 1] }}, x));
              const ord = f => __lab.play({N}, () => {{ const T = __lab.mine(), o = wBL.autoOrder(T.roster.map(m => Object.assign({{}}, m, {{ rs: Object.fromEntries(wBL.stats.map(k => [k, (m.r[k] - 1) / 11])) }}))); T.order = f(o); return {{ teams: [T, __lab.five(3, 0)], skill: [1, 1] }}; }});
              return {{ moves: am({{}}), movesNoTransition: am({{ wear: false }}), knights: kk({{}}), knightsNoTransition: kk({{ wear: false }}),
                order: {{ auto: ord(o => o), reverse: ord(o => o.slice().reverse()), shuffled: ord(o => shuffle(o.slice())) }} }}; }})()""")
            print('Reading the transition, and the order:', json.dumps(out['read']))
        if 'single' in PARTS:
            out['single'] = await pg.evaluate(f"""(() => {{ const pw = {{}}, gear = {{}}, pots = {{}}, sit = {{}};
              for (const kind of Object.keys(wBL.pow)) {{
                const opp = () => __lab.five(3, 0), base = __lab.play({N}, () => ({{ teams: [__lab.fiveOf(kind), opp()], skill: [1, 1], powers: false }})).win, row = {{ base }};
                const one = (id, alt) => __lab.playCast({N}, () => ({{ teams: [__lab.fiveOf(kind, alt ? {{ strike: 1, spare: 1 }} : null), opp()], skill: [1, 1], powers: [true, false], powOnly: [id, null] }}), id);
                const P = wBL.pow[kind], P2 = wBL.pow2[kind], U = wBL.ult[kind];
                row[P[0].id] = one(P[0].id); row[P[1].id] = one(P[1].id); row[P2[0].id] = one(P2[0].id, true); row[P2[1].id] = one(P2[1].id, true); row[U.id] = one(U.id);
                pw[kind] = row; }}
              sit.base = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 1], powers: false }})).win;
              for (const id of [...Object.keys(wBL.sit), 'steady']) sit[id] = __lab.playCast({N}, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 1], powers: [true, false], powOnly: [id, null] }}), id);
              gear.base = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 1] }})).win;
              for (const id of Object.keys(W_LANES_GEAR)) gear[id] = __lab.play({N}, () => ({{ teams: [__lab.geared(id), __lab.five(3, 0)], skill: [1, 1] }})).win;
              pots.base = gear.base;
              for (const id of Object.keys(wBL.potions)) pots[id] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 1], bags: [{{ [id]: 2 }}, null] }})).win;
              return {{ powers: pw, situation: sit, gear, potions: pots }}; }})()""")
            S = out['single']
            print('One power at a time (your side only; win against the same five with none):')
            for kind, row in S['powers'].items():
                print(f"  {kind} (none {row['base']}%): " + ', '.join(f"{k} {v['win']}% ({v['casts']}/game)" for k, v in row.items() if k != 'base'))
            print('Situation powers and Steady (none ' + str(S['situation']['base']) + '%):', ', '.join(f"{k} {v['win']}% ({v['casts']})" for k, v in S['situation'].items() if k != 'base'))
            print('One piece of gear on all five (none ' + str(S['gear']['base']) + '%):', ', '.join(f"{k} {v}%" for k, v in S['gear'].items() if k != 'base'))
            print('One potion, two in the bag (none ' + str(S['potions']['base']) + '%):', ', '.join(f"{k} {v}%" for k, v in S['potions'].items() if k != 'base'))
        if 'umbral' in PARTS:
            # (every row draws game i's two fives from the same stream; paired rows also play game i on the same seed)
            out['umbral'] = await pg.evaluate(f"""(() => {{ const o = {{}}, bag = W_LANES_KIT.opp[4], sk = wLanesSkillOf(4), hx = Object.keys(wBL.hexes), MR = Math.random, P0 = 7770001;
              const same = (i, f) => {{ let q = Math.imul(i + 1, 7919) >>> 0; Math.random = () => {{ q = (Math.imul(q, 1103515245) + 12345) >>> 0; return (q >>> 8) / 16777216; }}; try {{ return f(); }} finally {{ Math.random = MR; }} }};
              o.archmage = __lab.play({N}, i => same(i, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 2] }})), P0);
              o.lich = __lab.play({N}, i => same(i, () => ({{ teams: [__lab.mine(), __lab.five(3, 0)], skill: [1, 3] }})), P0);
              o.tier3 = __lab.play({N}, i => same(i, () => ({{ teams: [__lab.mine(), __lab.opp(__lab.clubs[i % __lab.clubs.length], 3)], skill: wLanesSkillOf(3), bags: [null, W_LANES_KIT.opp[3]] }})));
              o.tierU = __lab.play({N}, i => same(i, () => ({{ teams: [__lab.mine(), __lab.five(3, W_LNG.oppBonus[4])], skill: sk, bags: [null, bag] }})), P0);
              const nadir = x => __lab.play({N}, i => same(i, () => Object.assign({{ teams: [__lab.mine(), wUmbBlFive(3)], skill: sk, bags: [null, bag] }}, x(i))), P0 + 1);
              o.nadir = nadir(() => ({{}}));
              // (the champion without their own ultimate: what The Drowning Bell is worth)
              o.noUlt = __lab.play({N}, i => same(i, () => {{ const T = wUmbBlFive(3); T.roster.forEach(m => delete m.ult); return {{ teams: [__lab.mine(), T], skill: sk, bags: [null, bag] }}; }}), P0 + 1);
              for (const h of hx) o[h] = nadir(() => ({{ hexes: [h] }}));
              // (as the champion draws them: W_NADIR.lanes.hexes of them, every such draw in turn; the finale draws two)
              const draws = n => n <= 1 ? hx.map(h => [h]) : hx.flatMap((a, j) => hx.slice(j + 1).map(b => [a, b])), dr = draws(W_NADIR.lanes.hexes), two = draws(2);
              o.drawn = nadir(i => ({{ hexes: dr[i % dr.length] }}));
              if (W_NADIR.lanes.hexes !== 2) o.two = nadir(i => ({{ hexes: two[i % two.length] }}));
              return o; }})()""")
            U = out['umbral']
            print('Umbral (level parity):', ', '.join(f"{k} {v['win']}% ({v['score']}, {v['strikes']}% X)" for k, v in U.items()))
        await br.close()
    out['n'] = N; out['secs'] = round(time.time() - t0)
    json.dump(out, open('/tmp/realm_lanes_lab.json', 'w'), indent=1)
    print(f"{out['secs']}s, /tmp/realm_lanes_lab.json")

asyncio.run(main())

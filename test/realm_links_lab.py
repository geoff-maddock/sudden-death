"""Realm golf balance bot (issue #92, phase 10): headless golf matches and Divot Cups in dist/realm.html.

  python3 test/realm_links_lab.py 120            120 matches for every cell, and 120 cups
  python3 test/realm_links_lab.py 120 'W_LKG.oppBonus = { 1: 0, 2: 1, 3: 2 }'    a tuning override, run in the page first
  python3 test/realm_links_lab.py 300 '' tiers,gaps    only some parts (tiers, gaps, skills, powers, lines, stances,
                                                       kits, enchant, rule, cups)

Every match is the golf engine played to a final, headless (wGL.simGame), as Simulate plays it: nine holes of captain's
choice match play on the standing nine, the day's weather, the wood and the enchanted course on, powers on, your four
caddied as a Knight, the other side at the caddie skill of the tier (Squire, Knight, Archmage). No match ends level.
Your four: a fresh journey with five players at level 3, the caddie's four in their roles.
- tiers: against a rival's four as the world sets them (their level is yours plus the tier, less one, with the tier's
  rating bonus and caddie): the matches you really play.
- gaps: their level yours plus a gap (-1 to +3), no bonus, both Knights, their four your own kinds (so level is all
  that differs; the same for skills, powers, lines, stances and enchant).
- skills: even level, their caddie a Squire, a Knight, an Archmage.
- powers: even level, powers for both, neither, and yours only.
- lines: your line fixed all game (Go for it, Percentages, Lay up), theirs their caddie's.
- stances: your stance fixed all game (each Tempo with each Mood).
- kits: by tier, plain; their bag only (as Simulate plays it); both bags; and the full kit (both bags, and your four in
  gear, a piece each).
- enchant: even level, the enchanted course and the wood on and off: strokes over par, and how often the weaker side
  (a level down) wins.
- rule: how often the hitter rule moves a shot off its role's player.
- cups: a fresh journey at level 3, Simulate every round: how far it gets, how often it wins.
Writes /tmp/realm_links_lab.json."""
import asyncio, json, sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 120
OVR = sys.argv[2] if len(sys.argv) > 2 else ''
PARTS = set((sys.argv[3] if len(sys.argv) > 3 else 'tiers,gaps,skills,powers,lines,stances,kits,enchant,rule,cups').split(','))

SETUP = r"""
window.__lab = {};
// your four (level 3) and a four of kinds at a level (with the tier's rating bonus), as the engine takes them
// (every match draws its fours afresh: a player's ratings are rolled a point either way, so one draw is luck; your
// four is your kinds at your level, as theirs is, rolled again each match)
__lab.kinds = null;
__lab.mine = () => { const M = wFourMine(); __lab.kinds = __lab.kinds || M.roster.map(m => m.kind); return Object.assign(__lab.four(3, 0), { name: M.name }); };
// (their four are your own kinds, in your roles' order: an even match is the same players, so only the level, the bonus,
// the caddie and the call tell them apart)
__lab.four = (lvl, bonus) => { const kinds = __lab.kinds || wFourMine().roster.map(m => m.kind);
  const roster = kinds.map(kind => wLinksPlayer(wMakePlayer({ kind, lvl }, 'opp')));
  if (bonus) roster.forEach((p, j) => { for (let i = 0; i < bonus; i++) { const s = wGL.stats[(i * 5 + j) % 6]; p.r[s] = Math.min(wGL.cap, p.r[s] + 1); } });
  return { name: 'Them', roster, roles: { tee: 0, approach: 1, short: 2, putt: 3 } }; };
// a rival as the world sets it at a tier, its kept four drawn again each match
__lab.opp = (club, t) => { delete wLkg().opp[club]; return wLinksOpp(club, t); };
__lab.base = { holes: 9, weather: 'breeze', wood: true, powers: true, enchant: true };
// play n matches; o(i) gives the options; returns { win, over, holes, upW }
__lab.play = (n, o) => { let w = 0, over = 0, k = 0, po = 0, early = 0;
  for (let i = 0; i < n; i++) { const r = wGL.simGame(Object.assign({ seed: 1000 + i }, __lab.base, o(i))); if (r.win === 0) w++; if (r.played > r.holes) po++; if (r.played < r.holes) early++;
    for (const c of r.card) { over += (c.up[0] ? c.par + 4 : c.done[0] ? c.st[0] : c.st[0] + 1) - c.par; k++; } }
  return { win: +(100 * w / n).toFixed(1), over: +(over / k).toFixed(2), playoff: +(100 * po / n).toFixed(1), early: +(100 * early / n).toFixed(1) }; };
0"""

def pct(x): return f"{x:.1f}%"

async def main():
    t0 = time.time(); out = {}
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page()
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wGL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['elf', 'spider', 'gorgon', 'dwarf']; let i = 0; while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 3 }, 'tavern')); for (const q of wRoster()) { q.lvl = 3; wGlOf(q); } wFourAuto(); LAB = true; })()")
        await pg.evaluate(SETUP)
        if OVR: await pg.evaluate(OVR)
        # (a journey's rival clubs are drawn afresh each run, and a club's own kinds swing a match more than the tier does:
        # so the tier, kit and cup cells go round every club, the local side and all the rivals, a match each)
        await pg.evaluate("__lab.clubs = wBallClubs()")

        if 'tiers' in PARTS:
            out['tiers'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const t of [1, 2, 3]) o[t] = __lab.play({N}, i => ({{ teams: [__lab.mine(), __lab.opp(__lab.clubs[i % __lab.clubs.length], t)], skill: wLinksSkill(t) }})); return o; }})()""")
            print('Tiers, as the world sets them:', json.dumps(out['tiers']))
        if 'gaps' in PARTS:
            out['gaps'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const g of [-1, 0, 1, 2, 3]) o[g] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3 + g, 0)], skill: [1, 1] }})); return o; }})()""")
            print('Level gap:', json.dumps(out['gaps']))
        if 'skills' in PARTS:
            out['skills'] = await pg.evaluate(f"""(() => {{ const o = {{}}; for (const k of [0, 1, 2]) o[wGL.skills.names[k]] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, k] }})); return o; }})()""")
            print('Their caddie:', json.dumps(out['skills']))
        if 'powers' in PARTS:
            out['powers'] = await pg.evaluate(f"""(() => {{ const go = pw => __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], powers: pw }}));
              return {{ both: go(true), neither: go(false), mine: go([true, false]), theirs: go([false, true]) }}; }})()""")
            print('Powers:', json.dumps(out['powers']))
        if 'lines' in PARTS:
            out['lines'] = await pg.evaluate(f"""(() => {{ const o = {{ auto: __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1] }})) }};
              for (const l of ['go', 'pct', 'lay']) o[l] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], line: [l, null] }})); return o; }})()""")
            print('Your line, fixed:', json.dumps(out['lines']))
        if 'stances' in PARTS:
            out['stances'] = await pg.evaluate(f"""(() => {{ const o = {{}};
              for (const tempo of ['steady', 'quick']) for (const mood of ['careful', 'bold']) o[tempo + '/' + mood] = __lab.play({N}, () => ({{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1], stance: [{{ tempo, mood }}, null] }})); return o; }})()""")
            print('Your stance, fixed:', json.dumps(out['stances']))
        if 'kits' in PARTS:
            out['kits'] = await pg.evaluate(f"""(() => {{ const o = {{}}, mineBag = {{ draught: 2, glstill: 1, glmoss: 1, gloil: 1 }}, gearOf = ['gl_driver', 'gl_irons', 'gl_wedge', 'gl_putter'];
              const geared = () => {{ const T = __lab.mine(); T.roster = T.roster.map((m, i) => {{ const G = Object.assign({{ id: gearOf[i] }}, W_GEAR[gearOf[i]]); return Object.assign({{}}, m, {{ r: wGearRate(m.r, G, wGL.cap), gear: wGearTag(G) }}); }}); return T; }};
              for (const t of [1, 2, 3]) {{ const opp = i => __lab.opp(__lab.clubs[i % __lab.clubs.length], t), sk = wLinksSkill(t), theirs = W_LINKS_KIT.opp[t];
                o[t] = {{ plain: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk }})), theirs: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk, bags: [null, theirs] }})),
                  both: __lab.play({N}, i => ({{ teams: [__lab.mine(), opp(i)], skill: sk, bags: [mineBag, theirs] }})), full: __lab.play({N}, i => ({{ teams: [geared(), opp(i)], skill: sk, bags: [mineBag, theirs] }})) }}; }}
              return o; }})()""")
            print('Gear and potions:', json.dumps(out['kits']))
        if 'enchant' in PARTS:
            out['enchant'] = await pg.evaluate(f"""(() => {{ const go = (lv, x) => __lab.play({N}, () => Object.assign({{ teams: [__lab.mine(), __lab.four(lv, 0)], skill: [1, 1] }}, x));
              return {{ on: go(3, {{}}), off: go(3, {{ enchant: false, wood: false }}), upOn: go(4, {{}}), upOff: go(4, {{ enchant: false, wood: false }}) }}; }})()""")
            print('The enchanted course:', json.dumps(out['enchant']))
        if 'rule' in PARTS:
            out['rule'] = await pg.evaluate(f"""(() => {{ let shots = 0, off = 0;
              for (let i = 0; i < {N}; i++) {{ const r = wGL.simGame(Object.assign({{ seed: 5000 + i }}, __lab.base, {{ teams: [__lab.mine(), __lab.four(3, 0)], skill: [1, 1] }}));
                for (const e of r.log) if (e.k === 'shot' && e.side === 0) {{ shots++; const role = e.kind === 'putt' ? 3 : e.kind === 'tee' ? 0 : e.kind === 'approach' ? 1 : 2; if (e.ri !== role) off++; }} }}
              return {{ shots, off: +(100 * off / shots).toFixed(1) }}; }})()""")
            print('The hitter rule:', json.dumps(out['rule']))
        if 'cups' in PARTS:
            out['cups'] = await pg.evaluate(f"""(() => {{ const far = [0, 0, 0, 0]; for (let i = 0; i < {N}; i++) {{ let r = 0;
                for (const t of W_DIVOT.tiers) {{ const s = wGL.simGame(Object.assign({{ seed: 9000 + i * 3 + r }}, __lab.base, {{ teams: [__lab.mine(), __lab.opp(__lab.clubs[i % __lab.clubs.length], t)], skill: wLinksSkill(t) }})); if (s.win !== 0) break; r++; }} far[r]++; }}
              return {{ out_qf: far[0], out_sf: far[1], out_final: far[2], won: far[3], win: +(100 * far[3] / {N}).toFixed(1) }}; }})()""")
            print('Divot Cups:', json.dumps(out['cups']))
        await br.close()
    out['n'] = N; out['secs'] = round(time.time() - t0)
    json.dump(out, open('/tmp/realm_links_lab.json', 'w'), indent=1)
    print(f"{out['secs']}s, /tmp/realm_links_lab.json")

asyncio.run(main())

"""Realm baseball balance bot (issue #4, phase 6): headless ball games and Diamond Cups in dist/realm.html.

  python3 test/realm_diamond_lab.py 120            120 games at each level gap, and 120 cups
  python3 test/realm_diamond_lab.py 120 'W_DCUP.tiers = [1, 1, 2]'    a tuning override, run in the page first
  python3 test/realm_diamond_lab.py 300 '' umbral   only part 3, the Umbral (300 games for each row)
  python3 test/realm_diamond_lab.py 200 '' kits     only part 4, gear and potions (200 games for each row)
  python3 test/realm_diamond_lab.py 200 '' powers   only part 5, picks, situation powers and the crowd (200 games a row)
  python3 test/realm_diamond_lab.py 150 '' ground   only part 6, Graftonbury Ballpark's ways (150 games a row, seeded)

Every game is Brimstone Diamond's own engine played to a final (wBD.sim): both sides on the CPU at the same skill, so
the result comes from the players' ratings, and the CPU skill of a tier makes no difference here. That is what
Simulate gives you; Play and Manage put you in place of the CPU on your side.

Part 1, single games: a fresh journey with five players, all at the same level, against a rival's nine at that level
plus the gap. Win rate by gap, and by tier (which only changes the CPU skill both sides play at).
Part 2, whole cups: a fresh journey at level 3, Simulate every round; how far it gets, how often it wins, what it
earns.
Part 3, the Umbral (issue #99, 4a): tier U at level parity. The Lich against an Archmage on the same nine (the CPU
skill alone); the champion's game as Simulate plays it (your nine as an Archmage against the Bone Nine: the Lich,
W_BALL.oppBonus[4], and the champion on the mound), with no hexes, then each hex alone (no single one should move it
by more than about 10 points), then two drawn at random as her game draws them.
Part 4, gear and potions (issue #115, phase 1): your nine at level 3 against a rival's at the same level. By tier (the
CPU skill both sides play at): plain; their bag only (as Simulate plays it: your bag stays shut); both bags (yours a
Stamina Draught, a Brimstone Tonic, Owl-Eye Drops and Steadyhand Balm); and the full kit (both bags, and a piece of gear
on every one of your players: three bats, a ball on the starter, a Rosin Bag on the reliever, gloves and spikes). Then
at tier 2 each piece alone, on every player it is for (bats and gloves on the eight in the field, balls and the Rosin
Bag on the pitchers, spikes on everyone), and each potion alone, two in your bag.
Part 5, powers (issue #115, phase 2; only with 'powers'): your nine at level 3 against a rival's at the same level. By
tier: off (as the other parts play: LAB mode leaves the powers out), both sides on (the Realm's game), yours only and
theirs only (situation powers and the crowd); then at tier 2 yours with the situation powers alone and the crowd alone,
and your nine's picks: every kind's magic, every physical skill (and second pitch), by name, and picks off.
Part 6, the ground (issue #115, phase 4; only with 'ground'): Graftonbury Ballpark's mound grass and flickering
floodlight, your nine at level 3 against a rival's at the same level, every row over the same seeds (game i is seed i
in every row, so the rows differ only by the ground). By tier: off (as the other parts play), a day game (the mound
grass alone: the lights are off) and a night game (the grass and the dim patch); then at tier 2 a night game with the
patch inert (drawn and counted, doing nothing: what a fly into it does without it), the patch alone (no grass), and a
night game where your side's CPU doesn't read them (no pulls, no aiming: yours against theirs), and neither side's.
A day game and a night game from the same seed play the same random stream until the ground acts. Writes
/tmp/realm_diamond_lab.json."""
import asyncio, json, sys, os, time, collections
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
PRE = sys.argv[2] if len(sys.argv) > 2 else ''
ONLY = sys.argv[3] if len(sys.argv) > 3 else ''

LAB_JS = r"""
window.DLAB = {
  journey(lvl) {
    LAB = true; wStart(null, { club: pick(CLUB_IDS) });
    const kinds = shuffle(Object.keys(SIG).filter(k => FA_NAMES[k] && !wRoster().some(p => p.kind === k)));
    while (wRoster().length < W_BALL.minOwn) wRecruit({ kind: kinds.pop(), lvl }, 'tavern');
    for (const p of wRoster()) { p.lvl = lvl; p.xp = 0; wBdOf(p); }
    WG.nine = null; wNineSync();
    RUN.gold = 1000;
  },
  game(lvl, gap, tier) {
    DLAB.journey(lvl);
    const club = Object.values(WG.rivals)[0], keep = wBallOppLvl;
    wBallOppLvl = () => Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + gap));
    let opp; try { opp = wBallOpp(club, tier); } finally { wBallOppLvl = keep; }
    const t0 = performance.now();
    wBD.sim({ defs: [wNineDef(), opp], innings: W_BALL.innings, diff: W_BALL.diff[tier], rules: W_BALL.rules });
    const [a, h] = wBD.G.teams;
    return { gap, tier, us: a.R, them: h.R, win: a.R > h.R, ms: performance.now() - t0 };
  },
  cup(lvl) {
    DLAB.journey(lvl);
    const xp0 = wRoster().reduce((s, p) => s + wXpTotal(p), 0), g0 = RUN.gold;
    wDcupEnter();
    const D = WG.dcup, rounds = [];
    for (let i = 0; i < 3 && !D.done && !D.out; i++) {
      const r = D.round, opp = wDcupMine();
      wDcupPlay('sim');
      const g = D.games[r].find(x => x.a === 'me');
      rounds.push({ r, opp, us: g.ra, them: g.rb, win: g.w === 'me' });
      wDcupCatchUp();
    }
    while (D.pending) wDcupCatchUp();
    return { rounds, champ: D.champ === 'me', reached: rounds.length, xp: wRoster().reduce((s, p) => s + wXpTotal(p), 0) - xp0, gold: RUN.gold - g0 };
  }
};
// the Umbral: your nine (CPU skill mine) against the Bone Nine (or, with same: a rival's nine at your level, at skill theirs)
DLAB.umb = function (lvl, o) {
  DLAB.journey(lvl);
  const nine = wNineDef(); nine.diff = o.mine;
  let opp;
  if (o.same) { const club = Object.values(WG.rivals)[0], keep = wBallOppLvl; wBallOppLvl = () => wNineTier(); try { opp = wBallOpp(club, 1); } finally { wBallOppLvl = keep; } opp.diff = o.theirs; }
  else opp = wUmb4aNine(W_UMB4A.tier, 'diamond');
  const hx = o.hexes === 'draw' ? shuffle(W_UMB4A.hexes.slice()).slice(0, W_NADIR.diamond.hexes) : o.hexes || [];
  const rules = Object.assign({}, W_BALL.rules, hx.length ? { hexes: hx, hexBy: 1 } : {});
  wBD.sim({ defs: [nine, opp], innings: W_BALL.innings, diff: W_BALL.diff[W_UMB4A.tier], rules });
  const [a, h] = wBD.G.teams;
  return { us: a.R, them: h.R, win: a.R > h.R };
};
// gear and potions (part 4): a piece on the players of def that who picks, as wNineBdPlayer puts it on a roster player
DLAB.wear = (def, id, who) => {
  const G = Object.assign({ id }, W_GEAR[id]), gx = JSON.parse(JSON.stringify(G.fx || {})); delete gx.r;
  for (const p of def.roster.concat(def.pen)) { if (who && !who(p)) continue; Object.assign(p, wGearRate(Object.fromEntries(wBD.stats.map(s => [s, p[s]])), G, W_BDR.cap)); p.gear = G.name; p.gx = gx; }
  return def;
};
DLAB.pitcher = p => p.pos === 'P' || p.pos === 'RP';
DLAB.fielder = p => !DLAB.pitcher(p);
DLAB.forId = id => { const fx = W_GEAR[id].fx; return fx.ball || fx.ctrl ? DLAB.pitcher : fx.bat || fx.reach ? DLAB.fielder : null; };
DLAB.FULL = { C: 'bd_glove', '1B': 'bd_splinter', '2B': 'bd_glove', '3B': 'bd_hornet', SS: 'bd_glove', LF: 'bd_spikes', CF: 'bd_hornet', RF: 'bd_spikes', P: 'bd_ghost', RP: 'bd_rosin' };
DLAB.MINE = { draught: 1, bdtonic: 1, bdeye: 1, bdsteady: 1 };
// o: { tier, bags: 'none'|'theirs'|'both'|{ mine bag }, gear: 'full'|gear id }
DLAB.kit = function (lvl, o) {
  DLAB.journey(lvl);
  const club = Object.values(WG.rivals)[0], keep = wBallOppLvl, tier = o.tier || 2;
  wBallOppLvl = () => wNineTier();
  let opp; try { opp = wBallOpp(club, tier); } finally { wBallOppLvl = keep; }
  const nine = wNineDef();
  if (o.gear === 'full') for (const p of nine.roster.concat(nine.pen)) DLAB.wear({ roster: [p], pen: [] }, DLAB.FULL[p.pos]);
  else if (o.gear) DLAB.wear(nine, o.gear, DLAB.forId(o.gear));
  const theirs = Object.assign({}, W_DIAMOND_KIT.opp[tier]), mine = typeof o.bags === 'object' ? Object.assign({}, o.bags) : o.bags === 'both' ? Object.assign({}, DLAB.MINE) : null;
  const bags = o.bags === 'none' || !o.bags ? null : [mine, typeof o.bags === 'object' ? null : theirs];
  wBD.sim({ defs: [nine, opp], innings: W_BALL.innings, diff: W_BALL.diff[tier], rules: W_BALL.rules, bags });
  const [a, h] = wBD.G.teams, K = wBD.kit;
  return { us: a.R, them: h.R, win: a.R > h.R, pots: K ? K.pots.map(x => x.side + x.id) : [] };
};
// powers (part 5, issue #115 phase 2): your nine at level lvl against a rival's at the same level, tier o.tier; o.pow is
// the game's rules.bdpow (null: off, as the other parts play), o.mine your nine's picks (0 every kind's magic, 1 every
// physical skill and second pitch, 'name' by name as the other nine picks; left out: as the journey has them, 0)
DLAB.pow = function (lvl, o) {
  DLAB.journey(lvl);
  const club = Object.values(WG.rivals)[0], keep = wBallOppLvl, tier = o.tier || 2;
  wBallOppLvl = () => wNineTier();
  let opp; try { opp = wBallOpp(club, tier); } finally { wBallOppLvl = keep; }
  if (o.mine != null) for (const p of wRoster().concat(WG.nine.cu)) p.bdPw = o.mine === 'name' ? wBdPickByName(p.n) : { bat: o.mine, run: o.mine, field: o.mine, pitch: o.mine };
  wBD.sim({ defs: [wNineDef(), opp], innings: W_BALL.innings, diff: W_BALL.diff[tier], rules: Object.assign({}, W_BALL.rules, { bdpow: o.pow || null }) });
  const [a, h] = wBD.G.teams, B = wBD.G.bdp;
  return { us: a.R, them: h.R, win: a.R > h.R, inn: wBD.G.inning, casts: B ? B.casts.map(c => [c.side, c.k, c.id]) : [], tally: B ? B.tally : null };
};
// the ground (part 6): game seed, your nine at level lvl against a rival's at the same level, tier o.tier, o.ground the
// game's rules.ground (null: off). The seed is set first, so every row plays the same journeys and nines
DLAB.ground = function (seed, lvl, o) {
  window.__rs = seed; DLAB.journey(lvl);
  const club = Object.values(WG.rivals)[0], keep = wBallOppLvl, tier = o.tier || 2;
  wBallOppLvl = () => wNineTier();
  let opp; try { opp = wBallOpp(club, tier); } finally { wBallOppLvl = keep; }
  wBD.sim({ defs: [wNineDef(), opp], innings: W_BALL.innings, diff: W_BALL.diff[tier], rules: Object.assign({}, W_BALL.rules, { ground: o.ground || null }) });
  const G = wBD.G, [a, h] = G.teams, D = wBD.gd, P = [...G.pstats.values()], sum = k => P.reduce((n, s) => n + (s[k] || 0), 0);
  return { us: a.R, them: h.R, win: a.R > h.R, inn: G.inning, bb: sum('bb'), so: sum('so'), tally: D ? D.tally : null };
};
// XP to date, levels included
window.wXpTotal = p => { let n = p.xp; for (let l = 1; l < p.lvl; l++) n += wXpNeed(l); return n; };
"""

def pct(a, b): return f"{100 * a / b:5.1f}%" if b else '   - '

def print_kits(kits, gnames):
    def w(k): rows = kits[k]; return sum(g['win'] for g in rows) / len(rows), len(rows), sum(g['us'] for g in rows) / len(rows), sum(g['them'] for g in rows) / len(rows)
    print('\ngear and potions, your nine at level 3 against a rival\'s at level 3, Simulate (both sides on the CPU at the tier\'s skill)')
    print('                                        n    win   runs for-against   potions a game (yours, theirs)')
    for t in (1, 2, 3):
        base = w(f't{t}:none')[0]
        for key, label in ((f't{t}:none', 'plain'), (f't{t}:theirs', 'their bag only (Simulate)'), (f't{t}:both', 'both bags'), (f't{t}:both:full', 'both bags, and your nine in gear')):
            r, n, us, th = w(key); rows = kits[key]
            pm = sum(sum(1 for x in g['pots'] if x[0] == '0') for g in rows) / n; pt = sum(sum(1 for x in g['pots'] if x[0] == '1') for g in rows) / n
            print(f"  tier {t} {label:30s} {n:5d}  {100 * r:5.1f}%   {us:.1f}-{th:.1f}   {pm:.2f}, {pt:.2f}" + ('' if key.endswith('none') else f"   {100 * (r - base):+5.1f} pts"))
    base = w('t2:none')[0]
    print(f"each piece alone, tier 2, on every player it is for (none {100 * base:.1f}%)")
    for k in kits:
        if k.startswith('g:'): r, n, us, th = w(k); print(f"  {gnames[k[2:]]:22s} {n:5d}  {100 * r:5.1f}%   {us:.1f}-{th:.1f}   {100 * (r - base):+5.1f} pts")
    print(f"each potion alone, two in your bag, tier 2 (none {100 * base:.1f}%)")
    for k in kits:
        if k.startswith('p:'):
            r, n, us, th = w(k); used = sum(len(g['pots']) for g in kits[k]) / n
            print(f"  {k[2:]:22s} {n:5d}  {100 * r:5.1f}%   {us:.1f}-{th:.1f}   {100 * (r - base):+5.1f} pts   given {used:.2f} a game")

POW_ROWS = [  # key, label, o
    ('off', 'off (as before: no picks, no powers)', {'pow': None}),
    ('all', 'both sides (the Realm\'s game)', {'pow': {'on': [True, True]}}),
    ('mine', 'yours only: situation powers and crowd', {'pow': {'on': [True, False]}}),
    ('theirs', 'theirs only', {'pow': {'on': [False, True]}}),
    ('sit', 'yours only, situation powers alone', {'pow': {'on': [True, False], 'crowd': False}}),
    ('crowd', 'yours only, the crowd alone', {'pow': {'on': [True, False], 'sit': False}}),
    ('picks0', 'both sides, your nine all magic', {'pow': {'on': [True, True]}, 'mine': 0}),
    ('picks1', 'both sides, your nine all physical', {'pow': {'on': [True, True]}, 'mine': 1}),
    ('picksn', 'both sides, your nine by name', {'pow': {'on': [True, True]}, 'mine': 'name'}),
    ('nopick', 'both sides, picks off (every kind all)', {'pow': {'on': [True, True], 'picks': False}}),
]

def print_pow(pw):
    def w(k): rows = pw[k]; return sum(g['win'] for g in rows) / len(rows), len(rows), sum(g['us'] for g in rows) / len(rows), sum(g['them'] for g in rows) / len(rows)
    print('\npowers, your nine at level 3 against a rival\'s at level 3, Simulate (both sides on the CPU at the tier\'s skill)')
    print('                                                   n    win   runs for-against   a game: sit (you, them)  crowd (you, them)  extra inn.')
    for t in (1, 2, 3):
        base = w(f't{t}:off')[0]
        for key, label, _ in POW_ROWS:
            k = f't{t}:{key}'
            if k not in pw: continue
            r, n, us, th = w(k); rows = pw[k]
            cnt = lambda side, kinds: sum(sum(1 for c in g['casts'] if c[0] == side and c[1] in kinds) for g in rows) / n
            ex = sum(1 for g in rows if g['inn'] > 3) / n
            print(f"  tier {t} {label:40s} {n:5d}  {100 * r:5.1f}%   {us:.2f}-{th:.2f}   {cnt(0, ('sit',)):.2f}, {cnt(1, ('sit',)):.2f}            {cnt(0, ('amp', 'ultamp')):.2f}, {cnt(1, ('amp', 'ultamp')):.2f}        {100 * ex:4.1f}%" + ('' if key == 'off' else f"   {100 * (r - base):+5.1f} pts"))
    rows = [g for k in pw if k.endswith(':all') for g in pw[k]]
    sits = collections.Counter(c[2] for g in rows for c in g['casts'] if c[1] == 'sit'); amps = collections.Counter(c[2] for g in rows for c in g['casts'] if c[1] != 'sit')
    print(f"  in the Realm's game ({len(rows)} games, both sides): situation powers a game {', '.join(f'{k} {v / len(rows):.2f}' for k, v in sits.most_common())}")
    print(f"  crowd spends a game {sum(amps.values()) / len(rows):.2f}: {', '.join(f'{k} {v / len(rows):.2f}' for k, v in amps.most_common(8))}")
    ty = collections.Counter(); [ty.update(g['tally']) for g in rows if g['tally']]
    print(f"  moments the stands saw a game: {', '.join(f'{k} {v / len(rows):.2f}' for k, v in ty.items())}")

GROUND_ROWS = [  # key, label, o
    ('off', 'off (as before)', {'ground': None}),
    ('plain', 'on, the grass off, a day game (paired)', {'ground': {'on': True, 'night': False, 'grass': False}}),
    ('day', 'a day game: the mound grass', {'ground': {'on': True, 'night': False}}),
    ('night', 'a night game: grass and the dim patch', {'ground': {'on': True, 'night': True}}),
    ('inert', 'night, the patch inert (counted only)', {'ground': {'on': True, 'night': True, 'inert': True}}),
    ('dim', 'night, the dim patch alone (no grass)', {'ground': {'on': True, 'night': True, 'grass': False}}),
    ('noread', "night, your CPU doesn't read them", {'ground': {'on': True, 'night': True, 'read': [False, True]}}),
    ('blind', 'night, neither CPU reads them', {'ground': {'on': True, 'night': True, 'read': [False, False]}}),
]
# Brimstone Diamond's own random draws are Math.random as the page loaded it, so the seed goes in before the page
SEED = """window.__rs = 1; Math.random = function () { let t = (window.__rs = (window.__rs + 0x6D2B79F5) | 0); t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };"""

def print_ground(gr):
    def w(k): rows = gr[k]; n = len(rows); return sum(g['win'] for g in rows) / n, n, sum(g['us'] for g in rows) / n, sum(g['them'] for g in rows) / n
    print("\nthe ground, Graftonbury Ballpark: your nine at level 3 against a rival's at level 3, Simulate, the same seeds in every row")
    print('                                                n    win   runs for-against  runs a game    walks  strikeouts | a game: pulls  aims  flies into the patch (caught)  bobbles there')
    for t in (1, 2, 3):
        base = w(f't{t}:off')
        for key, label, _ in GROUND_ROWS:
            k = f't{t}:{key}'
            if k not in gr: continue
            r, n, us, th = w(k); rows = gr[k]
            T = lambda f: sum((g['tally'] or {}).get(f, 0) for g in rows) / n
            fly = T('fly'); cau = sum((g['tally'] or {}).get('flyOut', 0) for g in rows) / max(1, sum((g['tally'] or {}).get('fly', 0) for g in rows))
            bb = sum(g['bb'] for g in rows) / n; so = sum(g['so'] for g in rows) / n
            print(f"  tier {t} {label:38s} {n:5d}  {100 * r:5.1f}%   {us:.2f}-{th:.2f}   {us + th:5.2f} ({us + th - base[2] - base[3]:+.2f})  {bb:5.2f}  {so:5.2f}      |  {T('pulls'):.2f}  {T('aims'):5.1f}  {fly:.2f} ({100 * cau:4.1f}%)  {T('bob'):.3f}" + ('' if key == 'off' else f"   {100 * (r - base[0]):+5.1f} pts"))

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        if ONLY == 'ground': await pg.add_init_script(SEED)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wDcupEnter === 'function'")
        await pg.add_script_tag(content=LAB_JS)
        if PRE: await pg.evaluate(PRE + "\n;0")
        t0 = time.time()
        games = []; cups = []; umb = {}
        async def urows(key, o):
            umb[key] = []
            for i in range(0, N, 20):
                k = min(20, N - i)
                umb[key] += await pg.evaluate(f"(() => {{ const o = []; for (let i = 0; i < {k}; i++) o.push(DLAB.umb(3, {json.dumps(o)})); return o; }})()")
        kits = {}
        async def krows(key, o):
            kits[key] = []
            for i in range(0, N, 20):
                k = min(20, N - i)
                kits[key] += await pg.evaluate(f"(() => {{ const o = []; for (let i = 0; i < {k}; i++) o.push(DLAB.kit(3, {json.dumps(o)})); return o; }})()")
        if ONLY in ('', 'kits'):
            for t in (1, 2, 3):
                for b, gr in (('none', None), ('theirs', None), ('both', None), ('both', 'full')):
                    await krows(f"t{t}:{b}{':full' if gr else ''}", {'tier': t, 'bags': b, 'gear': gr})
            gids = await pg.evaluate("Object.keys(W_DIAMOND_GEAR)")
            for gid in gids: await krows('g:' + gid, {'tier': 2, 'bags': 'none', 'gear': gid})
            for pid in ('draught', 'bdtonic', 'bdeye', 'bdsteady'): await krows('p:' + pid, {'tier': 2, 'bags': {pid: 2}})
            gnames = await pg.evaluate("Object.fromEntries(Object.entries(W_DIAMOND_GEAR).map(([k, v]) => [k, v.name]))")
        pw = {}
        async def prows(key, o):
            pw[key] = []
            for i in range(0, N, 20):
                k = min(20, N - i)
                pw[key] += await pg.evaluate(f"(() => {{ const o = []; for (let i = 0; i < {k}; i++) o.push(DLAB.pow(3, {json.dumps(o)})); return o; }})()")
        if ONLY == 'ground':
            gr = {}
            for t in (1, 2, 3):
                for key, _, o in GROUND_ROWS:
                    if t != 2 and key not in ('off', 'plain', 'day', 'night'): continue
                    k = f't{t}:{key}'; gr[k] = []
                    for i in range(0, N, 20):
                        m = min(20, N - i)
                        gr[k] += await pg.evaluate(f"(() => {{ const o = []; for (let i = 0; i < {m}; i++) o.push(DLAB.ground({1 + i} + i, 3, {json.dumps(dict(o, tier=t))})); return o; }})()")
            await br.close()
            json.dump({'ground': gr}, open('/tmp/realm_diamond_lab.json', 'w'))
            print('override', PRE or '(none)', f' {time.time() - t0:.0f}s', ' page errors', len(errs), errs[:2])
            print_ground(gr)
            return
        if ONLY == 'powers':
            for t in (1, 2, 3):
                for key, _, o in POW_ROWS:
                    if t != 2 and key not in ('off', 'all', 'mine', 'theirs'): continue
                    await prows(f't{t}:{key}', dict(o, tier=t))
            await br.close()
            json.dump({'powers': pw}, open('/tmp/realm_diamond_lab.json', 'w'))
            print('override', PRE or '(none)', f' {time.time() - t0:.0f}s', ' page errors', len(errs), errs[:2])
            print_pow(pw)
            return
        if ONLY == 'kits':
            await br.close()
            json.dump({'kits': kits}, open('/tmp/realm_diamond_lab.json', 'w'))
            print('override', PRE or '(none)', f' {time.time() - t0:.0f}s', ' page errors', len(errs), errs[:2])
            print_kits(kits, gnames)
            return
        await urows('arch', {'same': True, 'mine': 2, 'theirs': 2})
        await urows('lich', {'same': True, 'mine': 2, 'theirs': 3})
        await urows('none', {'mine': 2})
        hexes = await pg.evaluate("W_UMB4A.hexes")
        for h in hexes: await urows(h, {'mine': 2, 'hexes': [h]})
        await urows('champ', {'mine': 2, 'hexes': 'draw'})
        hexn = await pg.evaluate("Object.fromEntries(Object.entries(wBD.hexes()).map(([k, v]) => [k, v.n]))")
        for gap in ((-1, 0, 1, 2, 3) if ONLY != 'umbral' else ()):
            for i in range(0, N, 10):
                k = min(10, N - i)
                games += await pg.evaluate(f"(() => {{ const o = []; for (let i = 0; i < {k}; i++) o.push(DLAB.game(3, {gap}, 1 + ({i} + i) % 3)); return o; }})()")
        for i in (range(0, N, 5) if ONLY != 'umbral' else ()):
            k = min(5, N - i)
            cups += await pg.evaluate(f"(() => {{ const o = []; for (let i = 0; i < {k}; i++) o.push(DLAB.cup(3)); return o; }})()")
        await br.close()
    json.dump({'games': games, 'cups': cups, 'umbral': umb, 'kits': kits}, open('/tmp/realm_diamond_lab.json', 'w'))
    if kits: print_kits(kits, gnames)
    print('override', PRE or '(none)', f' {time.time() - t0:.0f}s' + (f', {sum(g["ms"] for g in games) / len(games):.0f} ms a game' if games else ''))
    print('page errors', len(errs), errs[:2])
    def wr(k): rows = umb[k]; return sum(g['win'] for g in rows), len(rows)
    print('\nthe Umbral, tier U, your nine at level 3, their level the same (parity), Simulate')
    print('                                            n    win   runs for-against')
    def line(label, k, base=None):
        rows = umb[k]; w, n = wr(k)
        d = '' if base is None else f"   {100 * (w / n - wr(base)[0] / wr(base)[1]):+5.1f} pts"
        print(f"  {label:38s} {n:5d}  {pct(w, n)}   {sum(g['us'] for g in rows) / n:.1f}-{sum(g['them'] for g in rows) / n:.1f}{d}")
    line('the same nine, Archmage against Archmage', 'arch')
    line('the same nine, Archmage against the Lich', 'lich', 'arch')
    line('tier U: the Bone Nine, no hexes', 'none')
    for h in hexes: line('  + ' + hexn[h], h, 'none')
    line('the champion\'s game (two hexes drawn)', 'champ', 'none')
    if ONLY == 'umbral': return
    print('\nsingle games, your nine at level 3, Simulate')
    print('gap (their level - yours)    n    win   runs for-against')
    for gap in (-1, 0, 1, 2, 3):
        rows = [g for g in games if g['gap'] == gap]
        w = sum(g['win'] for g in rows)
        print(f"  {gap:+d}                      {len(rows):5d}  {pct(w, len(rows))}   {sum(g['us'] for g in rows) / len(rows):.1f}-{sum(g['them'] for g in rows) / len(rows):.1f}")
    print('by tier (the CPU skill both sides play at), all gaps')
    for t in (1, 2, 3):
        rows = [g for g in games if g['tier'] == t]
        print(f"  tier {t}                    {len(rows):5d}  {pct(sum(g['win'] for g in rows), len(rows))}")
    print('\nDiamond Cups, level 3, Simulate every round')
    rc = collections.Counter(c['reached'] for c in cups)
    won = [sum(1 for c in cups for r in c['rounds'] if r['r'] == k and r['win']) for k in range(3)]
    played = [sum(1 for c in cups for r in c['rounds'] if r['r'] == k) for k in range(3)]
    for k, name in enumerate(['quarter-final', 'semi-final', 'final']):
        print(f"  {name:14s} played {played[k]:4d}  won {pct(won[k], played[k])}")
    champ = sum(c['champ'] for c in cups)
    print(f"  champion {pct(champ, len(cups))} of {len(cups)} cups; XP a cup {sum(c['xp'] for c in cups) / len(cups):.0f}, gold a cup {sum(c['gold'] for c in cups) / len(cups):+.0f} (fee and prize included)")

asyncio.run(main())

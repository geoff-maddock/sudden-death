"""Realm football balance bot (issue #9, phase 8): headless football games and Cinder Cups in dist/realm.html.

  python3 test/realm_gridiron_lab.py 120            120 games at each level gap and skill, and 120 cups
  python3 test/realm_gridiron_lab.py 120 'W_GFG.oppBonus = { 1: 0, 2: 0, 3: 1 }'    a tuning override, run in the page first

Every game is the gridiron engine played to a final, headless (wGF.simGame), as Simulate plays it: your seven casts
its powers as a Knight, the other side at the CPU skill of the tier (Squire, Knight, Archmage).
Part 1, single games: a fresh journey with five players at level 3 (call-ups fill the seven) against a rival's seven at
that level plus the gap. Win rate by gap, and by the other side's CPU skill at an even level.
Part 2, powers: the same at an even level with powers off for both sides, to see what powers do to the result.
Part 2b, stances (issue #29): the same with your side forced to play Safe, Balanced or Risky on every down (theirs
picked by their coach): win rate, turnovers, plays of 20+ yards and stamina at the end.
Part 3, whole cups: a fresh journey at level 3, Simulate every round; how far it gets, how often it wins, what it
earns.
Part 4, gear and potions (issue #61, phase 7): by tier (gap 0), four ways: plain (no gear, no potions); their bag only
(W_GRID_KIT.opp[tier], as Simulate plays it now); both bags (yours a full one, KIT_MINE, given by your coach as a
Knight would: a stand-in for giving them by hand in Play and Manage); and the full kit (both bags, and your five own
players in gear, KIT_GEAR). Writes /tmp/realm_gridiron_lab.json."""
import asyncio, json, sys, os, time, collections
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
PRE = sys.argv[2] if len(sys.argv) > 2 else ''

LAB_JS = r"""
window.GLAB = {
  journey(lvl) {
    LAB = true; wStart(null, { club: pick(CLUB_IDS) });
    const kinds = shuffle(Object.keys(SIG).filter(k => FA_NAMES[k] && wGF.kinds.includes(k) && !wRoster().some(p => p.kind === k)));
    while (wRoster().length < W_GFG.minOwn) wRecruit({ kind: kinds.pop(), lvl }, 'tavern');
    for (const p of wRoster()) { p.lvl = lvl; p.xp = 0; delete p.gf; wGfOf(p); }
    WG.seven = null; wSevenSync();
    RUN.gold = 1000;
  },
  // one game: their level is yours plus the gap; tier sets their rating bonus and CPU skill (skill overrides the skill)
  game(lvl, gap, tier, o) {
    o = o || {};
    GLAB.journey(lvl);
    // (gear: one piece each, round your own players; it goes in through wSevenPlayer as a player's own)
    if (o.gear) wRoster().forEach((p, i) => { p.gear = { grid: o.gear[i % o.gear.length] }; });
    const club = Object.values(WG.rivals)[0], keep = wBallOppLvl;
    wBallOppLvl = () => Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + gap));
    let opp; try { wGfg().opp = {}; opp = wGridOpp(club, tier); } finally { wBallOppLvl = keep; }
    const sk = wGridSkill(tier); if (o.skill != null) sk[1] = o.skill;
    const t0 = performance.now();
    const bags = o.kit ? [o.kit === 'theirs' ? null : Object.assign({}, KIT_MINE), Object.assign({}, W_GRID_KIT.opp[tier] || {})] : null;
    const g = wGF.simGame(Object.assign({ teams: [typeof wGridSquad === 'function' ? wGridSquad().team : wSevenTeam(), opp], skill: sk, powers: o.powers !== false, stance: o.stance ? [o.stance, null] : null }, bags ? { bags } : {}));
    const out = { kit: o.kit || 'plain', used: [0, 1].map(s => (g.pots || []).filter(x => x.side === s).length), gap, tier, skill: sk[1], powers: o.powers !== false, us: g.score[0], them: g.score[1], win: g.score[0] > g.score[1], tie: g.score[0] === g.score[1], ms: performance.now() - t0 };
    if (o.stance) {
      const G = wGF.G, mine = g.box.filter(b => b.side === 0), sum = k => mine.reduce((a, b) => a + (b.line[k] || 0), 0), on = [...new Set(Object.values(G.teams[0].off).concat(Object.values(G.teams[0].def)))];
      Object.assign(out, { stance: o.stance, to: sum('fuml') + sum('pint'), take: sum('ints') + sum('fr'), sacked: g.box.filter(b => b.side === 1).reduce((a, b) => a + (b.line.sk || 0), 0),
        big: G.drives.filter(d => d.side === 0).reduce((a, d) => a + d.plays.filter(e => e.gain >= 20).length, 0), stam: on.reduce((a, j) => a + (G.stam ? G.stam[0][j] : 100), 0) / on.length });
    }
    return out;
  },
  cup(lvl) {
    GLAB.journey(lvl);
    const xp0 = wRoster().reduce((s, p) => s + wXpTotal(p), 0), g0 = RUN.gold;
    wGcupEnter();
    const D = WG.gcup, rounds = [];
    for (let i = 0; i < 3 && !D.done && !D.out; i++) {
      const r = D.round, opp = wGcupMine();
      wGfg().met = {}; wGcupPlay('sim');
      const g = D.games[r].find(x => x.a === 'me');
      rounds.push({ r, opp, us: g.ra, them: g.rb, win: g.w === 'me', yd: !!g.yd });
      wGcupCatchUp();
    }
    while (D.pending) wGcupCatchUp();
    return { rounds, champ: D.champ === 'me', reached: rounds.length, xp: wRoster().reduce((s, p) => s + wXpTotal(p), 0) - xp0, gold: RUN.gold - g0 };
  }
};
// XP to date, levels included
// your full bag, and the gear your own players wear in the full kit
window.KIT_MINE = { draught: 2, secondwind: 1, gfresin: 1, gfhaste: 1, gffog: 1, gfsalve: 1 };
window.KIT_GEAR = ['gf_cleats', 'gf_pads', 'gf_gloves', 'gf_helmet', 'gf_tee'];
window.wXpTotal = p => { let n = p.xp; for (let l = 1; l < p.lvl; l++) n += wXpNeed(l); return n; };
"""

def pct(a, b): return f"{100 * a / b:5.1f}%" if b else '   - '

async def batch(pg, n, expr, per=10):
    out = []
    for i in range(0, n, per):
        k = min(per, n - i)
        out += await pg.evaluate(f"(() => {{ const o = []; for (let j = 0; j < {k}; j++) {{ const i = {i} + j; o.push({expr}); }} return o; }})()")
    return out

def row(label, rows):
    w = sum(g['win'] for g in rows); t = sum(g['tie'] for g in rows)
    print(f"  {label:26s} {len(rows):5d}  {pct(w, len(rows))}  {pct(t, len(rows))}   {sum(g['us'] for g in rows) / len(rows):.1f}-{sum(g['them'] for g in rows) / len(rows):.1f}")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGcupEnter === 'function'")
        await pg.add_script_tag(content=LAB_JS)
        if PRE: await pg.evaluate(PRE + "\n;0")
        t0 = time.time()
        games = []
        for gap in (-1, 0, 1, 2, 3):
            games += await batch(pg, N, f"GLAB.game(3, {gap}, 1 + i % 3)")
        skills = []
        for sk in (0, 1, 2):
            skills += await batch(pg, N, f"GLAB.game(3, 0, 2, {{ skill: {sk} }})")
        nopow = await batch(pg, N, "GLAB.game(3, 0, 2, { skill: 1, powers: false })")
        stances = []
        for st in ('safe', 'bal', 'risky'):
            stances += await batch(pg, N, f"GLAB.game(3, 0, 2, {{ skill: 1, stance: '{st}' }})")
        cups = await batch(pg, N, "GLAB.cup(3)", per=5)
        kits = []
        for t in (1, 2, 3):
            for kit, opt in (('plain', '{}'), ('theirs', "{ kit: 'theirs' }"), ('both', "{ kit: 'both' }"), ('full', "{ kit: 'both', gear: KIT_GEAR }")):
                rows = await batch(pg, N, f"GLAB.game(3, 0, {t}, {opt})")
                for g in rows: g['kit'] = kit
                kits += rows
        await br.close()
    json.dump({'games': games, 'skills': skills, 'nopow': nopow, 'stances': stances, 'cups': cups, 'kits': kits}, open('/tmp/realm_gridiron_lab.json', 'w'))
    allg = games + skills + nopow
    print('override', PRE or '(none)', f' {time.time() - t0:.0f}s, {sum(g["ms"] for g in allg) / len(allg):.0f} ms a game')
    print('page errors', len(errs), errs[:2])
    print('\nsingle games, your seven at level 3, Simulate (you cast as a Knight, they at the tier\'s skill)')
    print('                                 n    win    tie   points for-against')
    for gap in (-1, 0, 1, 2, 3):
        row(f"gap {gap:+d} (their level - yours)", [g for g in games if g['gap'] == gap])
    print('by tier, all gaps (their rating bonus and CPU skill)')
    for t in (1, 2, 3):
        row(f"tier {t}", [g for g in games if g['tier'] == t])
    print('their CPU skill, even level, tier 2 ratings')
    for sk, name in enumerate(['Squire', 'Knight', 'Archmage']):
        row(name, [g for g in skills if g['skill'] == sk])
    print('powers, even level, both Knights')
    row('with powers', [g for g in skills if g['skill'] == 1])
    row('without powers', nopow)
    print('your stance on every down, even level, both Knights (theirs picked by their coach)')
    print('                                 n    win    tie   points for-against   lost  took  sacked  20+ plays  stamina at the end')
    for st, name in (('safe', 'Safe'), ('bal', 'Balanced'), ('risky', 'Risky')):
        rs = [g for g in stances if g['stance'] == st]; m = lambda k: sum(g[k] for g in rs) / len(rs)
        w = sum(g['win'] for g in rs); t = sum(g['tie'] for g in rs)
        print(f"  {name:26s} {len(rs):5d}  {pct(w, len(rs))}  {pct(t, len(rs))}   {m('us'):.1f}-{m('them'):.1f}          {m('to'):.2f}  {m('take'):.2f}  {m('sacked'):.2f}    {m('big'):.2f}       {m('stam'):.0f}")
    print('\nCinder Cups, level 3, Simulate every round')
    won = [sum(1 for c in cups for r in c['rounds'] if r['r'] == k and r['win']) for k in range(3)]
    played = [sum(1 for c in cups for r in c['rounds'] if r['r'] == k) for k in range(3)]
    for k, name in enumerate(['quarter-final', 'semi-final', 'final']):
        print(f"  {name:14s} played {played[k]:4d}  won {pct(won[k], played[k])}")
    yd = sum(1 for c in cups for r in c['rounds'] if r['yd'])
    champ = sum(c['champ'] for c in cups)
    print(f"  champion {pct(champ, len(cups))} of {len(cups)} cups; {yd} of your games settled on yards; XP a cup {sum(c['xp'] for c in cups) / len(cups):.0f}, gold a cup {sum(c['gold'] for c in cups) / len(cups):+.0f} (fee and prize included)")

    print('\ngear and potions, by tier at an even level (your coach gives your potions as a Knight would)')
    print('                                 n    win    tie   points for-against   potions used, yours-theirs')
    for t in (1, 2, 3):
        for kit, name in (('plain', 'plain'), ('theirs', 'their bag only'), ('both', 'both bags'), ('full', 'both bags, you in gear')):
            rs = [g for g in kits if g['tier'] == t and g['kit'] == kit]
            if not rs: continue
            w = sum(g['win'] for g in rs); tt = sum(g['tie'] for g in rs); u = [sum(g['used'][s] for g in rs) / len(rs) for s in (0, 1)]
            print(f"  {'tier ' + str(t) + ': ' + name:26s} {len(rs):5d}  {pct(w, len(rs))}  {pct(tt, len(rs))}   {sum(g['us'] for g in rs) / len(rs):.1f}-{sum(g['them'] for g in rs) / len(rs):.1f}            {u[0]:.1f}-{u[1]:.1f}")

asyncio.run(main())

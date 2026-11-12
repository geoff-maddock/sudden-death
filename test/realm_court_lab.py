"""Realm basketball balance bot (issue #77, phase 10): headless basketball games and Charter Nets in dist/realm.html.

  python3 test/realm_court_lab.py 120            120 games at each level gap, skill, call and kit, and 120 cups
  python3 test/realm_court_lab.py 120 'W_BKG.oppBonus = { 1: 0, 2: 1, 3: 2 }'    a tuning override, run in the page first
  python3 test/realm_court_lab.py 300 '' gaps,cups    only some parts (gaps, skills, powers, calls, cups, kits; also played:
                                                      the tiers as the world sets them only, tiers: even-level games by
                                                      tier only, and stances: Pace and Pressure only)

Every game is the court engine played to a final, headless (wBK.simGame), as Simulate plays it: five minutes, the
Charter Court's own ways on, your five coached and casting as a Knight, the other side at the CPU skill of the tier
(Squire, Knight, Archmage).
Part 1, single games: a fresh journey with seven players at level 3 (a five and a bench of two, as theirs) against a
rival's squad. First by tier as the world sets it (their level is yours plus the tier less one, with the tier's rating
bonus and coach): these are the games you really play. Then at that level plus a gap: win rate by gap and by tier, and
by the other coach's skill at an even level.
Part 2, powers: the same at an even level with powers off for both sides, to see what powers do to the result.
Part 3, the call: the same with your side's call fixed for the whole game (theirs picked by their coach): each offense
set, each defense, each Pace and each Pressure, the rest left at Motion, Man and Balanced. Win rate, points, and for
the stances your turnovers, steals, fouls, shots and stamina at the end.
Part 4, whole cups: a fresh journey at level 3, Simulate every round; how far it gets, how often it wins, what it
earns.
Part 5, gear and potions: by tier at an even level, four ways: plain (no gear, no potions); their bag only
(W_COURT_KIT.opp[tier], as Simulate plays it now); both bags (yours a full one, KIT_MINE, given by your bench as a
Knight would: a stand-in for giving them by hand in Play and Manage); and the full kit (both bags, and your five in
gear, KIT_GEAR: one piece each, round the squad). Writes /tmp/realm_court_lab.json."""
import asyncio, json, sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
PRE = sys.argv[2] if len(sys.argv) > 2 else ''
PARTS = (sys.argv[3] if len(sys.argv) > 3 else 'gaps,skills,powers,calls,cups,kits').split(',')

LAB_JS = r"""
window.CLAB = {
  journey(lvl) {
    LAB = true; wStart(null, { club: pick(CLUB_IDS) });
    const kinds = shuffle(Object.keys(SIG).filter(k => FA_NAMES[k] && wBK.kinds.includes(k) && !W_STARS.some(s => s.kind === k) && !wRoster().some(p => p.kind === k)));
    while (wRoster().length < 5 + W_BKG.bench) wRecruit({ kind: kinds.pop(), lvl }, 'tavern');
    for (const p of wRoster()) { p.lvl = lvl; p.xp = 0; delete p.bk; wBkOf(p); }
    WG.court = null; wCourtSync();
    RUN.gold = 1000;
  },
  // one game: their level is yours plus the gap; tier sets their rating bonus and coach (skill overrides the coach)
  game(lvl, gap, tier, o) {
    o = o || {};
    CLAB.journey(lvl);
    // (gear: one piece each, round your own players; it goes in through wCourtPlayer as a player's own)
    if (o.gear) wRoster().forEach((p, i) => { p.gear = { court: o.gear[i % o.gear.length] }; });
    const club = Object.values(WG.rivals)[0], keep = wBallOppLvl;
    // (gap null: as the world sets it, their level yours plus the tier less one)
    if (gap != null) wBallOppLvl = () => Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + gap));
    let opp; try { wBkg().opp = {}; opp = wCourtOpp(club, tier); } finally { wBallOppLvl = keep; }
    const sk = wCourtSkill(tier); if (o.skill != null) sk[1] = o.skill;
    const t0 = performance.now();
    const bags = o.kit ? [o.kit === 'theirs' ? null : Object.assign({}, KIT_MINE), Object.assign({}, W_COURT_KIT.opp[tier] || {})] : null;
    const g = wBK.simGame(Object.assign({ teams: [wCourtSquad(opp).team, opp], skill: sk, mins: 5, court: true, ordered: [true, false], powers: o.powers !== false },
      o.call ? { calls: [Object.assign({ off: 'motion', def: 'man', pace: 'bal', press: 'bal' }, o.call), null] } : {}, bags ? { bags } : {}));
    const T = g.box[0].tot, st = wBK.stam(), on = wBK.onFloor();
    return { kit: o.kit || 'plain', used: [0, 1].map(s => wBK.pots().filter(x => x.side === s).length), gap, tier, skill: sk[1], powers: o.powers !== false, call: o.call || null,
      us: g.score[0], them: g.score[1], win: g.score[0] > g.score[1], tie: g.score[0] === g.score[1], ot: g.ot || 0, ms: performance.now() - t0,
      tov: T.tov, stl: T.stl, blk: T.blk, pf: T.pf, fga: T.fga, tpa: T.tpa, reb: T.reb, stam: on[0].reduce((a, ri) => a + st[0][ri], 0) / on[0].length };
  },
  cup(lvl) {
    CLAB.journey(lvl);
    const xp0 = wRoster().reduce((s, p) => s + wXpTotal(p), 0), g0 = RUN.gold;
    wNetEnter();
    const D = WG.bkcup, rounds = [];
    for (let i = 0; i < 3 && !D.done && !D.out; i++) {
      const r = D.round, opp = wNetMine();
      wBkg().met = {}; wNetPlay('sim');
      const g = D.games[r].find(x => x.a === 'me');
      rounds.push({ r, opp, us: g.ra, them: g.rb, win: g.w === 'me', tb: !!g.tb });
      wNetCatchUp();
    }
    while (D.pending) wNetCatchUp();
    return { rounds, champ: D.champ === 'me', reached: rounds.length, xp: wRoster().reduce((s, p) => s + wXpTotal(p), 0) - xp0, gold: RUN.gold - g0 };
  }
};
// your full bag, and the gear your five wear in the full kit
window.KIT_MINE = { draught: 2, secondwind: 1, bkhot: 1, bksteady: 1 };
window.KIT_GEAR = ['bk_shoes', 'bk_bands', 'bk_pads', 'bk_braces', 'bk_socks'];
// XP to date, levels included
window.wXpTotal = p => { let n = p.xp; for (let l = 1; l < p.lvl; l++) n += wXpNeed(l); return n; };
"""

def pct(a, b): return f"{100 * a / b:5.1f}%" if b else '   - '

async def batch(pg, n, expr, per=10):
    out = []
    for i in range(0, n, per):
        k = min(per, n - i)
        out += await pg.evaluate(f"(() => {{ const o = []; for (let j = 0; j < {k}; j++) {{ const i = {i} + j; o.push({expr}); }} return o; }})()")
    return out

def row(label, rows, more=False):
    if not rows: return
    n = len(rows); w = sum(g['win'] for g in rows); t = sum(g['tie'] for g in rows); m = lambda k: sum(g[k] for g in rows) / n
    extra = f"      {m('tov'):4.1f}  {m('stl'):4.1f}  {m('pf'):4.1f}  {m('fga'):5.1f}  {m('tpa'):4.1f}   {m('stam'):3.0f}" if more else ''
    print(f"  {label:28s} {n:5d}  {pct(w, n)}  {pct(t, n)}   {m('us'):.1f}-{m('them'):.1f}{extra}")

SETS = [('pick', 'Pick and roll'), ('post', 'Post up'), ('motion', 'Motion'), ('iso', 'Isolation'), ('spread', 'Spread for three'), ('hot', 'Feed the hot hand')]
DEFS = [('man', 'Man'), ('zone', 'Zone'), ('press', 'Press'), ('switch', 'Switch everything'), ('pack', 'Pack the paint')]
PACES = [('push', 'Push'), ('bal', 'Balanced'), ('grind', 'Grind')]
PRESSES = [('gamble', 'Gamble'), ('bal', 'Balanced'), ('sit', 'Sit back')]

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wNetEnter === 'function'")
        await pg.add_script_tag(content=LAB_JS)
        if PRE: await pg.evaluate(PRE + "\n;0")
        t0 = time.time()
        games, skills, nopow, calls, cups, kits = [], [], [], [], [], []
        if 'gaps' in PARTS:
            for gap in (-1, 0, 1, 2, 3):
                games += await batch(pg, N, f"CLAB.game(3, {gap}, 1 + i % 3)")
        if 'skills' in PARTS or 'powers' in PARTS:
            for sk in (0, 1, 2) if 'skills' in PARTS else (1,):
                skills += await batch(pg, N, f"CLAB.game(3, 0, 2, {{ skill: {sk} }})")
        if 'powers' in PARTS:
            nopow = await batch(pg, N, "CLAB.game(3, 0, 2, { skill: 1, powers: false })")
        played = []
        if 'played' in PARTS or 'gaps' in PARTS:
            played = await batch(pg, 3 * N, "CLAB.game(3, null, 1 + i % 3)")
        if 'tiers' in PARTS:
            games += await batch(pg, 3 * N, "CLAB.game(3, 0, 1 + i % 3)")
        if 'calls' in PARTS or 'stances' in PARTS:
            # (Motion, Man and Balanced are one game, played once and shown in each table)
            todo = [('off', k) for k, _ in SETS] + [('def', k) for k, _ in DEFS if k != 'man'] + [('pace', k) for k, _ in PACES if k != 'bal'] + [('press', k) for k, _ in PRESSES if k != 'bal']
            if 'calls' not in PARTS: todo = [('off', 'motion')] + [t for t in todo if t[0] in ('pace', 'press')]
            for kind, k in todo:
                rows = await batch(pg, N, f"CLAB.game(3, 0, 2, {{ skill: 1, call: {{ {kind}: '{k}' }} }})")
                for g in rows: g['ck'], g['cv'] = kind, k
                calls += rows
        if 'cups' in PARTS:
            cups = await batch(pg, N, "CLAB.cup(3)", per=5)
        if 'kits' in PARTS:
            for t in (1, 2, 3):
                for kit, opt in (('plain', '{}'), ('theirs', "{ kit: 'theirs' }"), ('both', "{ kit: 'both' }"), ('full', "{ kit: 'both', gear: KIT_GEAR }")):
                    rows = await batch(pg, N, f"CLAB.game(3, 0, {t}, {opt})")
                    for g in rows: g['kit'] = kit
                    kits += rows
        await br.close()
    json.dump({'played': played, 'games': games, 'skills': skills, 'nopow': nopow, 'calls': calls, 'cups': cups, 'kits': kits}, open('/tmp/realm_court_lab.json', 'w'))
    allg = played + games + skills + nopow + calls + kits
    print('override', PRE or '(none)', f' {time.time() - t0:.0f}s' + (f", {sum(g['ms'] for g in allg) / len(allg):.0f} ms a game, {100 * sum(1 for g in allg if g['ot']) / len(allg):.1f}% to overtime" if allg else ''))
    print('page errors', len(errs), errs[:2])
    head = '                                   n    win    tie   points for-against'
    if played:
        print('\nby tier as the world sets it: their level yours plus the tier less one, the tier\'s rating bonus and coach'); print(head)
        for t in (1, 2, 3):
            row(f"tier {t} (their level +{t - 1})", [g for g in played if g['tier'] == t])
    if games:
        print('\nsingle games, your five at level 3, Simulate (your coach a Knight, theirs at the tier\'s skill)')
        print(head)
        for gap in (-1, 0, 1, 2, 3):
            row(f"gap {gap:+d} (their level - yours)", [g for g in games if g['gap'] == gap])
        print('by tier, all gaps (their rating bonus and coach)')
        for t in (1, 2, 3):
            row(f"tier {t}", [g for g in games if g['tier'] == t])
        print('by tier, at an even level')
        for t in (1, 2, 3):
            row(f"tier {t}", [g for g in games if g['tier'] == t and g['gap'] == 0])
    if 'skills' in PARTS:
        print('\ntheir coach, even level, tier 2 ratings'); print(head)
        for sk, name in enumerate(['Squire', 'Knight', 'Archmage']):
            row(name, [g for g in skills if g['skill'] == sk])
    if nopow:
        print('\npowers, even level, both Knights'); print(head)
        row('with powers', [g for g in skills if g['skill'] == 1])
        row('without powers', nopow)
    if calls:
        more = head + '   lost  stole  fouls  shots  threes  stamina at the end'
        base = [g for g in calls if g['ck'] == 'off' and g['cv'] == 'motion']
        pick_ = lambda kind, k: base if (kind, k) in (('def', 'man'), ('pace', 'bal'), ('press', 'bal')) else [g for g in calls if g['ck'] == kind and g['cv'] == k]
        print('\nyour call fixed all game, even level, both Knights (theirs picked by their coach); the rest Motion, Man, Balanced')
        if skills: print(head); row('(your coach calls it)', [g for g in skills if g['skill'] == 1])
        for title, kind, L in (('your offense set', 'off', SETS), ('your defense', 'def', DEFS), ('your Pace', 'pace', PACES), ('your Pressure', 'press', PRESSES)):
            if 'calls' not in PARTS and kind in ('off', 'def'): continue
            print(title); print(more)
            for k, name in L: row(name, pick_(kind, k), True)
    if cups:
        print('\nCharter Nets, level 3, Simulate every round')
        won = [sum(1 for c in cups for r in c['rounds'] if r['r'] == k and r['win']) for k in range(3)]
        played = [sum(1 for c in cups for r in c['rounds'] if r['r'] == k) for k in range(3)]
        for k, name in enumerate(['quarter-final', 'semi-final', 'final']):
            print(f"  {name:14s} played {played[k]:4d}  won {pct(won[k], played[k])}")
        tb = sum(1 for c in cups for r in c['rounds'] if r['tb'])
        champ = sum(c['champ'] for c in cups)
        print(f"  champion {pct(champ, len(cups))} of {len(cups)} cups; {tb} of your games settled on rebounds; XP a cup {sum(c['xp'] for c in cups) / len(cups):.0f}, gold a cup {sum(c['gold'] for c in cups) / len(cups):+.0f} (fee and prize included)")
    if kits:
        print('\ngear and potions, by tier at an even level (your bench gives your potions as a Knight would)')
        print(head + '   potions used, yours-theirs')
        for t in (1, 2, 3):
            for kit, name in (('plain', 'plain'), ('theirs', 'their bag only'), ('both', 'both bags'), ('full', 'both bags, you in gear')):
                rs = [g for g in kits if g['tier'] == t and g['kit'] == kit]
                if not rs: continue
                w = sum(g['win'] for g in rs); tt = sum(g['tie'] for g in rs); u = [sum(g['used'][s] for g in rs) / len(rs) for s in (0, 1)]
                print(f"  {'tier ' + str(t) + ': ' + name:28s} {len(rs):5d}  {pct(w, len(rs))}  {pct(tt, len(rs))}   {sum(g['us'] for g in rs) / len(rs):.1f}-{sum(g['them'] for g in rs) / len(rs):.1f}            {u[0]:.1f}-{u[1]:.1f}")

asyncio.run(main())

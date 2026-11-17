"""Realm hockey balance bot (issue #83, phase 11): headless hockey games and Pond Kettles in dist/realm.html.

  python3 test/realm_rink_lab.py 120            120 games at each level gap, skill, call and kit, and 120 cups
  python3 test/realm_rink_lab.py 120 'W_HKG.oppBonus = { 1: 0, 2: 1, 3: 2 }'    a tuning override, run in the page first
  python3 test/realm_rink_lab.py 300 '' gaps,cups    only some parts (gaps, skills, powers, calls, special, cups, kits; also
                                                     played: the tiers as the world sets them only, tiers: even-level
                                                     games by tier only, and stances: Tempo and Edge only)

Every game is the rink engine played to a final, headless (wHK.simGame), as Simulate plays it: six minutes, the Pond
Rink's own ways on, your six coached and casting as a Knight, the other side at the CPU skill of the tier (Squire,
Knight, Archmage). No game ends level.
Part 1, single games: a fresh journey with eight players at level 3 (a six and a bench of two, as theirs) against a
rival's squad. First by tier as the world sets it (their level is yours plus the tier less one, with the tier's rating
bonus and coach): these are the games you really play. Then at that level plus a gap: win rate by gap and by tier, and
by the other coach's skill at an even level.
Part 2, powers: the same at an even level with powers off for both sides, and for one side only, to see what powers do.
Part 3, the call: the same with your side's call fixed for the whole game (theirs picked by their coach): each system
with the puck, each without it, each Tempo and each Edge, the rest left at Cycle, Man and Balanced. Win rate, goals,
and your shots, hits, penalties and stamina at the end. Special teams (special): each power-play and penalty-kill setup
fixed, with how often your power plays score and theirs do.
Part 4, whole cups: a fresh journey at level 3, Simulate every round; how far it gets, how often it wins, what it
earns.
Part 5, gear and potions: by tier at an even level, four ways: plain (no gear, no potions); their bag only
(W_RINK_KIT.opp[tier], as Simulate plays it now); both bags (yours a full one, KIT_MINE, given by your bench as a Knight
would: a stand-in for giving them by hand in Play and Manage); and the full kit (both bags, and your six in gear: one
piece each, the Bone Mask on your goalie). Writes /tmp/realm_rink_lab.json."""
import asyncio, json, sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
PRE = sys.argv[2] if len(sys.argv) > 2 else ''
PARTS = (sys.argv[3] if len(sys.argv) > 3 else 'gaps,skills,powers,calls,special,cups,kits').split(',')

LAB_JS = r"""
window.HLAB = {
  journey(lvl) {
    LAB = true; wStart(null, { club: pick(CLUB_IDS) });
    const kinds = shuffle(Object.keys(SIG).filter(k => FA_NAMES[k] && wHK.kinds.includes(k) && !W_STARS.some(s => s.kind === k) && !wRoster().some(p => p.kind === k)));
    while (wRoster().length < wHK.pos.length + W_HKG.bench) wRecruit({ kind: kinds.pop(), lvl }, 'tavern');
    for (const p of wRoster()) { p.lvl = lvl; p.xp = 0; delete p.hk; wHkOf(p); }
    WG.rink = null; wSixSync();
    RUN.gold = 1000;
  },
  // one game: their level is yours plus the gap; tier sets their rating bonus and coach (skill overrides the coach)
  game(lvl, gap, tier, o) {
    o = o || {};
    HLAB.journey(lvl);
    // (gear: one piece each for your skaters, round them, and the mask on your goalie; in through wRinkPlayer as a player's own)
    if (o.gear) { const C = wSixSync(), gk = C.six.G; let i = 0; for (const p of wRoster()) p.gear = { rink: p.id === gk ? 'hk_mask' : o.gear[i++ % o.gear.length] }; }
    const club = Object.values(WG.rivals)[0], keep = wBallOppLvl;
    // (gap null: as the world sets it, their level yours plus the tier less one)
    if (gap != null) wBallOppLvl = () => Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + gap));
    let opp; try { wHkg().opp = {}; opp = wRinkOpp(club, tier); } finally { wBallOppLvl = keep; }
    const sk = wRinkSkill(tier); if (o.skill != null) sk[1] = o.skill;
    const t0 = performance.now();
    const bags = o.kit ? [o.kit === 'theirs' ? null : Object.assign({}, KIT_MINE), Object.assign({}, W_RINK_KIT.opp[tier] || {})] : null;
    // (your bag given by your bench as a Knight would: the lab's side is watched, so its coach may open it)
    const g = wHK.simGame(Object.assign({ teams: [wRinkSquad(opp).team, opp], skill: sk, mins: 6, pond: true, ordered: [true, false], powers: o.powers == null ? true : o.powers },
      o.call ? { calls: [Object.assign({ att: 'cycle', def: 'man', pp: 'umbrella', pk: 'box', tempo: 'bal', edge: 'bal' }, o.call), null] } : {}, bags ? { bags } : {}));
    const T = g.box[0].tot, U = g.box[1].tot, pen = s => g.pens.filter(x => x.side === s).length, ppg = s => g.log.filter(l => l.side === s && l.str === 'pp').length;
    const on = g.box[0].rows.filter(r => r.on && r.pos !== 'G');
    return { kit: o.kit || 'plain', used: [0, 1].map(s => g.pots.filter(x => x.side === s).length), gap, tier, skill: sk[1], powers: o.powers == null ? true : o.powers, call: o.call || null,
      us: g.score[0], them: g.score[1], win: g.win === 0, ot: g.ot || 0, so: !!g.so, ms: performance.now() - t0,
      sog: T.sog, sogA: U.sog, hit: T.hit, pen: pen(0), penA: pen(1), ppg: ppg(0), ppgA: ppg(1), take: T.take, blk: T.blk, casts: [0, 1].map(s => g.casts.filter(c => c.side === s).length),
      sta: on.length ? on.reduce((a, r) => a + r.sta, 0) / on.length * 100 : 0 };
  },
  cup(lvl) {
    HLAB.journey(lvl);
    const xp0 = wRoster().reduce((s, p) => s + wXpTotal(p), 0), g0 = RUN.gold;
    wKettleEnter();
    const D = WG.hkcup, rounds = [];
    for (let i = 0; i < 3 && !D.done && !D.out; i++) {
      const r = D.round, opp = wKettleMine();
      wHkg().met = {}; wKettlePlay('sim');
      const g = D.games[r].find(x => x.a === 'me');
      rounds.push({ r, opp, us: g.ra, them: g.rb, win: g.w === 'me', end: g.end });
      wKettleCatchUp();
    }
    while (D.pending) wKettleCatchUp();
    return { rounds, champ: D.champ === 'me', reached: rounds.length, xp: wRoster().reduce((s, p) => s + wXpTotal(p), 0) - xp0, gold: RUN.gold - g0 };
  }
};
// your full bag, and the gear your skaters wear in the full kit (your goalie wears the mask)
window.KIT_MINE = { draught: 2, hkanti: 1, hkcider: 1, hkliniment: 1 };
window.KIT_GEAR = ['hk_skates', 'hk_stick', 'hk_gloves', 'hk_pads', 'hk_puck'];
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
    n = len(rows); w = sum(g['win'] for g in rows); m = lambda k: sum(g[k] for g in rows) / n
    extra = f"     {m('sog'):5.1f}  {m('sogA'):5.1f}  {m('hit'):4.1f}  {m('pen'):4.2f}  {m('take'):5.1f}   {m('sta'):3.0f}" if more else ''
    print(f"  {label:30s} {n:5d}  {pct(w, n)}   {m('us'):.2f}-{m('them'):.2f}{extra}")

ATTS = [('cycle', 'Cycle'), ('rush', 'Rush'), ('dump', 'Dump and chase'), ('point', 'Point shots'), ('crash', 'Crash the net')]
DEFS = [('man', 'Man'), ('fore', 'Forecheck'), ('trap', 'Trap'), ('box', 'Box'), ('collapse', 'Collapse')]
TEMPOS = [('push', 'Push'), ('bal', 'Balanced'), ('sit', 'Sit on it')]
EDGES = [('rough', 'Rough'), ('bal', 'Balanced'), ('clean', 'Clean')]
PPS = [('umbrella', 'Umbrella'), ('overload', 'Overload'), ('front', 'Net front')]
PKS = [('box', 'Box'), ('diamond', 'Diamond'), ('press', 'Pressure')]

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wKettleEnter === 'function'")
        await pg.add_script_tag(content=LAB_JS)
        if PRE: await pg.evaluate(PRE + "\n;0")
        t0 = time.time()
        games, skills, nopow, onepow, calls, special, cups, kits = [], [], [], [], [], [], [], []
        if 'gaps' in PARTS:
            for gap in (-1, 0, 1, 2, 3):
                games += await batch(pg, N, f"HLAB.game(3, {gap}, 1 + i % 3)")
        if 'skills' in PARTS or 'powers' in PARTS:
            for sk in (0, 1, 2) if 'skills' in PARTS else (1,):
                skills += await batch(pg, N, f"HLAB.game(3, 0, 2, {{ skill: {sk} }})")
        if 'powers' in PARTS:
            nopow = await batch(pg, N, "HLAB.game(3, 0, 2, { skill: 1, powers: false })")
            for side in (0, 1):
                rows = await batch(pg, N, f"HLAB.game(3, 0, 2, {{ skill: 1, powers: [{'true, false' if side == 0 else 'false, true'}] }})")
                for g in rows: g['who'] = side
                onepow += rows
        played = []
        if 'played' in PARTS or 'gaps' in PARTS:
            played = await batch(pg, 3 * N, "HLAB.game(3, null, 1 + i % 3)")
        if 'tiers' in PARTS:
            games += await batch(pg, 3 * N, "HLAB.game(3, 0, 1 + i % 3)")
        if 'calls' in PARTS or 'stances' in PARTS:
            # (Cycle, Man and Balanced are one game, played once and shown in each table)
            todo = [('att', k) for k, _ in ATTS] + [('def', k) for k, _ in DEFS if k != 'man'] + [('tempo', k) for k, _ in TEMPOS if k != 'bal'] + [('edge', k) for k, _ in EDGES if k != 'bal']
            if 'calls' not in PARTS: todo = [('att', 'cycle')] + [t for t in todo if t[0] in ('tempo', 'edge')]
            for kind, k in todo:
                rows = await batch(pg, N, f"HLAB.game(3, 0, 2, {{ skill: 1, call: {{ {kind}: '{k}' }} }})")
                for g in rows: g['ck'], g['cv'] = kind, k
                calls += rows
        if 'special' in PARTS:
            for kind, L in (('pp', PPS), ('pk', PKS)):
                for k, _ in L:
                    rows = await batch(pg, N, f"HLAB.game(3, 0, 2, {{ skill: 1, call: {{ {kind}: '{k}' }} }})")
                    for g in rows: g['ck'], g['cv'] = kind, k
                    special += rows
        if 'cups' in PARTS:
            cups = await batch(pg, N, "HLAB.cup(3)", per=5)
        if 'kits' in PARTS:
            for t in (1, 2, 3):
                for kit, opt in (('plain', '{}'), ('theirs', "{ kit: 'theirs' }"), ('both', "{ kit: 'both' }"), ('full', "{ kit: 'both', gear: KIT_GEAR }")):
                    rows = await batch(pg, N, f"HLAB.game(3, 0, {t}, {opt})")
                    for g in rows: g['kit'] = kit
                    kits += rows
        await br.close()
    json.dump({'played': played, 'games': games, 'skills': skills, 'nopow': nopow, 'onepow': onepow, 'calls': calls, 'special': special, 'cups': cups, 'kits': kits}, open('/tmp/realm_rink_lab.json', 'w'))
    allg = played + games + skills + nopow + onepow + calls + special + kits
    print('override', PRE or '(none)', f' {time.time() - t0:.0f}s' + (f", {sum(g['ms'] for g in allg) / len(allg):.0f} ms a game, {100 * sum(1 for g in allg if g['ot']) / len(allg):.1f}% past the third period, {100 * sum(1 for g in allg if g['so']) / len(allg):.1f}% to a shootout" if allg else ''))
    print('page errors', len(errs), errs[:2])
    head = '                                     n    win    goals for-against'
    if played:
        print('\nby tier as the world sets it: their level yours plus the tier less one, the tier\'s rating bonus and coach'); print(head)
        for t in (1, 2, 3):
            row(f"tier {t} (their level +{t - 1})", [g for g in played if g['tier'] == t])
    if games:
        print('\nsingle games, your six at level 3, Simulate (your coach a Knight, theirs at the tier\'s skill)')
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
        row('both sides with powers', [g for g in skills if g['skill'] == 1])
        row('neither', nopow)
        row('yours only', [g for g in onepow if g['who'] == 0])
        row('theirs only', [g for g in onepow if g['who'] == 1])
        both = [g for g in skills if g['skill'] == 1]
        if both: print(f"  casts a game with both on: yours {sum(g['casts'][0] for g in both) / len(both):.1f}, theirs {sum(g['casts'][1] for g in both) / len(both):.1f}")
    if calls:
        more = head + '    shots  theirs  hits  pens  takes  stamina at the end'
        base = [g for g in calls if g['ck'] == 'att' and g['cv'] == 'cycle']
        pick_ = lambda kind, k: base if (kind, k) in (('def', 'man'), ('tempo', 'bal'), ('edge', 'bal')) else [g for g in calls if g['ck'] == kind and g['cv'] == k]
        print('\nyour call fixed all game, even level, both Knights (theirs picked by their coach); the rest Cycle, Man, Balanced')
        if skills: print(head); row('(your coach calls it)', [g for g in skills if g['skill'] == 1])
        for title, kind, L in (('your system with the puck', 'att', ATTS), ('your system without it', 'def', DEFS), ('your Tempo', 'tempo', TEMPOS), ('your Edge', 'edge', EDGES)):
            if 'calls' not in PARTS and kind in ('att', 'def'): continue
            print(title); print(more)
            for k, name in L: row(name, pick_(kind, k), True)
    if special:
        print('\nspecial teams: your setup fixed all game, even level, both Knights')
        print('                                     n    win    goals      penalties on them  your power-play goals   on you  theirs')
        for title, kind, L in (('your power play', 'pp', PPS), ('your penalty kill', 'pk', PKS)):
            print(title)
            for k, name in L:
                rs = [g for g in special if g['ck'] == kind and g['cv'] == k]
                if not rs: continue
                n = len(rs); pa = sum(g['penA'] for g in rs); pg_ = sum(g['ppg'] for g in rs); pu = sum(g['pen'] for g in rs); ga = sum(g['ppgA'] for g in rs)
                print(f"  {name:30s} {n:5d}  {pct(sum(g['win'] for g in rs), n)}   {sum(g['us'] for g in rs) / n:.2f}-{sum(g['them'] for g in rs) / n:.2f}      {pa:4d}        {pg_:4d} ({pct(pg_, pa).strip()})        {pu:4d}   {ga:4d} ({pct(ga, pu).strip()})")
    if cups:
        print('\nPond Kettles, level 3, Simulate every round')
        won = [sum(1 for c in cups for r in c['rounds'] if r['r'] == k and r['win']) for k in range(3)]
        played_ = [sum(1 for c in cups for r in c['rounds'] if r['r'] == k) for k in range(3)]
        for k, name in enumerate(['quarter-final', 'semi-final', 'final']):
            print(f"  {name:14s} played {played_[k]:4d}  won {pct(won[k], played_[k])}")
        ends = sum(1 for c in cups for r in c['rounds'] if r['end'])
        champ = sum(c['champ'] for c in cups)
        print(f"  champion {pct(champ, len(cups))} of {len(cups)} cups; {ends} of your games went past the third period; XP a cup {sum(c['xp'] for c in cups) / len(cups):.0f}, gold a cup {sum(c['gold'] for c in cups) / len(cups):+.0f} (fee and prize included)")
    if kits:
        print('\ngear and potions, by tier at an even level (your bench gives your potions as a Knight would)')
        print(head + '   potions used, yours-theirs')
        for t in (1, 2, 3):
            for kit, name in (('plain', 'plain'), ('theirs', 'their bag only'), ('both', 'both bags'), ('full', 'both bags, you in gear')):
                rs = [g for g in kits if g['tier'] == t and g['kit'] == kit]
                if not rs: continue
                w = sum(g['win'] for g in rs); u = [sum(g['used'][s] for g in rs) / len(rs) for s in (0, 1)]
                print(f"  {'tier ' + str(t) + ': ' + name:30s} {len(rs):5d}  {pct(w, len(rs))}   {sum(g['us'] for g in rs) / len(rs):.2f}-{sum(g['them'] for g in rs) / len(rs):.2f}            {u[0]:.1f}-{u[1]:.1f}")

asyncio.run(main())

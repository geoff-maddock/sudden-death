"""Realm boxing balance bot (issue #23, phase 7): headless cards and Anvil Belts in dist/realm.html.

  python3 test/realm_ring_lab.py 120            120 cards at each level gap and skill, and 120 Belts
  python3 test/realm_ring_lab.py 120 'W_BXG.oppBonus = { 1: 0, 2: 1, 3: 3 }'    a tuning override, run in the page first

Every card is three bouts on the Anvil Ring's engine boxed to the end, headless (wBX.simCard), as Simulate boxes it:
your corner's pairing, your fighters boxing and casting as Knights, theirs at the CPU skill of the tier (Squire,
Knight, Archmage).
Part 1, single cards: a fresh journey with three players at level 3 against a rival's three at that level plus the gap.
Win rate by gap, and by tier (their rating bonus and CPU skill).
Part 2, their CPU skill at an even level with tier 2 ratings.
Part 3, powers: the same at an even level with powers off for both sides.
Part 4, whole Anvil Belts: a fresh journey at level 3, Simulate every round; how far it gets, how often it wins, what
it earns.
Part 5, gear and potions (issue #61, phase 7): by tier, as the world sets it, four ways: plain (no gear, no potions);
their bag only (W_RING_KIT.opp[tier], as Simulate boxes it now); both bags (yours a full one, KIT_MINE, used by your
corner as a Knight's would: a stand-in for giving them by hand in Play and Manage); and the full kit (both bags, and
your three in gear, KIT_GEAR).
Part 6, tier U (the Umbral, issue #99, phase 4c): a card at tier U as the world sets it (tier 4: their rating bonus,
the Lich in their corner, their full bag; Simulate, so your bag stays home) at level parity, by their CPU skill
(Archmage and Lich, the same ratings) and powers; and the Nadir champion's own card (wUmbRingSide), without hexes and
with each try's two as they are drawn.
Part 7, hexes: the tier U card with each hex alone, against none. Parts 6 and 7 are seeded by the card's number (the
journey, their side and the bouts), so each row boxes the same cards and differs only in what the row changes.
  python3 test/realm_ring_lab.py 120 --umbral   parts 6 and 7 only
Part 8, situation powers and curses (issue #115, phase 3; only with --more): your three at level 3 against a rival's at
the tier's level, by tier: off (as the other parts box: LAB mode leaves them out), both sides on (the Realm's card),
yours only and theirs only; then at tier 2 both sides with the curses alone and the situation powers alone. Each row
boxes the same seeded cards (as parts 6 and 7), so the rows differ only in what they change.
  python3 test/realm_ring_lab.py 150 --more     part 8 only
Writes /tmp/realm_ring_lab.json (part 8: /tmp/realm_ring_lab_more.json)."""
import asyncio, json, sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

UMB_ONLY = '--umbral' in sys.argv
MORE_ONLY = '--more' in sys.argv
ARGS = [a for a in sys.argv[1:] if a not in ('--umbral', '--more')]
N = int(ARGS[0]) if len(ARGS) > 0 else 100
PRE = ARGS[1] if len(ARGS) > 1 else ''

LAB_JS = r"""
window.BLAB = {
  journey(lvl) {
    LAB = true; wStart(null, { club: pick(CLUB_IDS) });
    const kinds = shuffle(Object.keys(SIG).filter(k => FA_NAMES[k] && wBX.kinds.includes(k) && !wRoster().some(p => p.kind === k)));
    while (wRoster().length < 3) wRecruit({ kind: kinds.pop(), lvl }, 'tavern');
    for (const p of wRoster()) { p.lvl = lvl; p.xp = 0; delete p.bx; wBxOf(p); }
    RUN.gold = 1000;
  },
  // one card: their level is yours plus the gap; tier sets their rating bonus and CPU skill (skill overrides the skill)
  card(lvl, gap, tier, o) {
    o = o || {};
    // (seeded: the journey, their side and the card itself all from the seed, so rows that differ only in one thing
    // box the same cards: the Umbral parts compare that way)
    if (o.seed != null && !o.seeded) { const keep = Math.random; Math.random = mulberry(o.seed); try { return BLAB.card(lvl, gap, tier, Object.assign({}, o, { seeded: true })); } finally { Math.random = keep; } }
    BLAB.journey(lvl);
    // (gear: one piece each, round the three; it goes in through wBxFighter as a player's own)
    if (o.gear) wRoster().forEach((p, i) => { p.gear = { ring: o.gear[i % o.gear.length] }; });
    const club = Object.values(WG.rivals)[0], keep = wBallOppLvl, taken = new Set(), mine = wRingSide(taken);
    wBallOppLvl = () => Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + gap));
    let opp; try { wBxg().opp = {}; opp = wRingOpp(club, tier, taken); } finally { wBallOppLvl = keep; }
    const sk = wRingSkill(tier); if (o.skill != null) sk[1] = o.skill;
    const t0 = performance.now();
    const bags = o.kit ? [o.kit === 'theirs' ? {} : Object.assign({}, KIT_MINE), Object.assign({}, W_RING_KIT.opp[tier] || {})] : null;
    // (the Umbral: the Nadir champion's own three in place of the club's, and the card's hexes)
    if (o.champ) { const t2 = new Set(mine.fighters.map(f => f.n)); opp = wUmbRingSide(W_NADIR.ring, t2); }
    // ('drawn': the hexes a try would draw, a different try each card)
    let hexes = o.hexes;
    if (hexes === 'drawn') { const keep = WG.umbral; WG.umbral = { tries: { ring: BLAB.tries = (BLAB.tries || 0) + 1 } }; try { hexes = wUmbRingHexes('ring', W_NADIR.ring.hexes); } finally { WG.umbral = keep; } }
    const r = wBX.simCard(Object.assign({ sides: [mine, opp], skill: sk, powers: o.powers !== false }, o.bxpow !== undefined ? { bxpow: o.bxpow } : {}, bags ? { bags } : {}, hexes && hexes.length ? { hexes } : {}, o.seed != null ? { seed: o.seed } : {}));
    const R = r.result, bouts = r.bouts;
    // situation powers and curses (part 8): what each side cast a card, and its cut-man's washes
    const more = [0, 1].map(s => bouts.reduce((m, b) => { if (b.bxp) { for (const c of b.bxp.casts) if (c.side === s) m[c.k === 'sit' ? c.id : 'cu']++; m.wash += b.bxp.wash[s]; } return m; }, { canvas: 0, last: 0, bell: 0, cu: 0, wash: 0 }));
    const used = r.bags && bags ? [0, 1].map(s => Object.keys(bags[s]).reduce((n, id) => n + bags[s][id] - ((r.bags[s] || {})[id] || 0), 0)) : [0, 0];
    return { more, hexes: hexes || [], champ: !!o.champ, kit: o.kit || 'plain', used, gap, tier, skill: sk[1], powers: o.powers !== false, us: R.won[0], them: R.won[1], win: R.win === 0, tie: R.win == null, by: R.by,
      boutWins: bouts.filter(b => b.over.win === 0).length, stops: bouts.filter(b => b.over.how !== 'dec').length, myKos: bouts.filter(b => b.over.win === 1 && b.over.how !== 'dec').length, ms: performance.now() - t0 };
  },
  belt(lvl) {
    BLAB.journey(lvl);
    const xp0 = wRoster().reduce((s, p) => s + wXpTotal(p), 0), g0 = RUN.gold, hp0 = RUN.hp;
    wBcupEnter();
    const D = WG.bcup, rounds = [];
    for (let i = 0; i < 3 && !D.done && !D.out; i++) {
      const r = D.round, opp = wBcupMine();
      wBxg().met = {}; RUN.hp = RUN.maxhp; wBcupPlay('sim');
      const g = D.cards[r].find(x => x.a === 'me');
      rounds.push({ r, opp, us: g.ra, them: g.rb, win: g.w === 'me', toss: !!g.toss });
      wBcupCatchUp();
    }
    while (D.pending) wBcupCatchUp();
    return { rounds, champ: D.champ === 'me', reached: rounds.length, xp: wRoster().reduce((s, p) => s + wXpTotal(p), 0) - xp0, gold: RUN.gold - g0 };
  }
};
// XP to date, levels included
// your full bag, and the gear your three wear in the full kit
window.KIT_MINE = { draught: 2, cutsalve: 2, smellsalts: 2, ragetonic: 2 };
window.KIT_GEAR = ['bx_wraps', 'bx_guard', 'bx_robe'];
window.wXpTotal = p => { let n = p.xp; for (let l = 1; l < p.lvl; l++) n += wXpNeed(l); return n; };
"""

def pct(a, b): return f"{100 * a / b:5.1f}%" if b else '   - '

async def batch(pg, n, expr, per=10):
    out = []
    for i in range(0, n, per):
        k = min(per, n - i)
        out += await pg.evaluate(f"(() => {{ const o = []; for (let j = 0; j < {k}; j++) {{ const i = {i} + j; o.push({expr}); }} return o; }})()")
    return out

def row(label, rows, extra=''):
    if not rows: return
    w = sum(g['win'] for g in rows); t = sum(g['tie'] for g in rows); n = len(rows)
    print(f"  {label:28s} {n:5d}  {pct(w, n)}  {pct(t, n)}   bouts {sum(g['us'] for g in rows) / n:.2f}-{sum(g['them'] for g in rows) / n:.2f}   stopped {sum(g['stops'] for g in rows) / (3 * n):4.0%}   your KOs {sum(g['myKos'] for g in rows) / n:.2f}{extra}")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBcupEnter === 'function'")
        await pg.add_script_tag(content=LAB_JS)
        if PRE: await pg.evaluate(PRE + "\n;0")
        t0 = time.time()
        if MORE_ONLY: return await more(pg, errs, t0)
        cards, tiers, skills, nopow, belts, kits = [], [], [], [], [], []
        if not UMB_ONLY:
            for gap in (-1, 0, 1, 2, 3):
                cards += await batch(pg, N, f"BLAB.card(3, {gap}, 1 + i % 3)")
            for t in (1, 2, 3):
                tiers += await batch(pg, N, f"BLAB.card(3, {t - 1}, {t})")
            for sk in (0, 1, 2):
                skills += await batch(pg, N, f"BLAB.card(3, 0, 2, {{ skill: {sk} }})")
            nopow = await batch(pg, N, "BLAB.card(3, 0, 2, { skill: 1, powers: false })")
            belts = await batch(pg, N, "BLAB.belt(3)", per=5)
            for t in (1, 2, 3):
                for kit, extra in (('plain', ''), ('theirs', ", kit: 'theirs'"), ('both', ", kit: 'both'"), ('full', ", kit: 'both', gear: KIT_GEAR")):
                    rows = await batch(pg, N, f"BLAB.card(3, {t - 1}, {t}, {{ {extra[2:]} }})" if extra else f"BLAB.card(3, {t - 1}, {t})")
                    for g in rows: g['kit'] = kit
                    kits += rows
        # the Umbral (issue #99, phase 4c): tier U at level parity, as the world sets it (Simulate: their bag only)
        umb = {}
        umb['tier U'] = await batch(pg, N, "BLAB.card(3, 0, 4, { seed: 10007 + i, kit: 'theirs' })")
        umb['tier U, Archmage'] = await batch(pg, N, "BLAB.card(3, 0, 4, { seed: 10007 + i, kit: 'theirs', skill: 2 })")
        umb['tier U, no powers'] = await batch(pg, N, "BLAB.card(3, 0, 4, { seed: 10007 + i, kit: 'theirs', powers: false })")
        umb['champion, no hexes'] = await batch(pg, N, "BLAB.card(3, 0, 4, { seed: 10007 + i, kit: 'theirs', champ: true })")
        umb['champion, drawn hexes'] = await batch(pg, N, "BLAB.card(3, 0, 4, { seed: 10007 + i, kit: 'theirs', champ: true, hexes: 'drawn' })")
        hexes = await pg.evaluate("Object.keys(wBX.hexes)")
        hx = {}
        for h in ['none'] + hexes:
            hx[h] = await batch(pg, 2 * N, f"BLAB.card(3, 0, 4, {{ seed: 10007 + i, kit: 'theirs'{'' if h == 'none' else ', hexes: [' + repr(h) + ']'} }})")
        await br.close()
    json.dump({'cards': cards, 'tiers': tiers, 'skills': skills, 'nopow': nopow, 'belts': belts, 'kits': kits, 'umbral': umb, 'hexes': hx}, open('/tmp/realm_ring_lab.json', 'w'))
    allc = cards + tiers + skills + nopow + umb['tier U']
    print('override', PRE or '(none)', f' {time.time() - t0:.0f}s, {sum(g["ms"] for g in allc) / len(allc):.0f} ms a card')
    print('page errors', len(errs), errs[:2])
    print('\nthe Umbral: tier U at level parity, Simulate (their rating bonus, their full bag, the Lich in their corner)')
    print('                                   n    win   draw')
    for k, rs in umb.items(): row(k, rs)
    print('hexes, one at a time against none, tier U at level parity (target: none moves the win rate more than 10 points)')
    base = sum(g['win'] for g in hx['none']) / len(hx['none'])
    for h, rs in hx.items():
        row(h, rs, '' if h == 'none' else f"   {100 * (sum(g['win'] for g in rs) / len(rs) - base):+5.1f} points")
    if UMB_ONLY: return
    print('\nsingle cards, your three at level 3, Simulate (you box and cast as Knights, they at the tier\'s skill)')
    print('                                   n    win   draw')
    for gap in (-1, 0, 1, 2, 3):
        row(f"gap {gap:+d} (their level - yours)", [g for g in cards if g['gap'] == gap])
    print('by tier, as the world sets it (their level is yours plus the tier, less one; the tier\'s bonus and skill)')
    for t in (1, 2, 3):
        row(f"tier {t}", [g for g in tiers if g['tier'] == t])
    print('their CPU skill, even level, tier 2 ratings')
    for sk, name in enumerate(['Squire', 'Knight', 'Archmage']):
        row(name, [g for g in skills if g['skill'] == sk])
    print('powers, even level, both Knights')
    row('with powers', [g for g in skills if g['skill'] == 1])
    row('without powers', nopow)
    print('\nwhole Anvil Belts, level 3, Simulate every round')
    n = len(belts)
    for r, name in enumerate(['quarter-final (tier 1)', 'semi-final (tier 2)', 'final (tier 3)']):
        played = [b['rounds'][r] for b in belts if len(b['rounds']) > r]
        print(f"  {name:28s} played {len(played):4d}  won {pct(sum(x['win'] for x in played), len(played))}")
    print(f"  Belts won {pct(sum(b['champ'] for b in belts), n)}   XP {sum(b['xp'] for b in belts) / n:.0f} a Belt across the team   gold {sum(b['gold'] for b in belts) / n:+.0f} a Belt")

    print('\ngear and potions, by tier as the world sets it (your corner uses your bag as a Knight would)')
    print('                                   n    win   draw   (potions: used a card, yours-theirs)')
    for t in (1, 2, 3):
        for kit, name in (('plain', 'plain'), ('theirs', 'their bag only'), ('both', 'both bags'), ('full', 'both bags, you in gear')):
            rs = [g for g in kits if g['tier'] == t and g['kit'] == kit]
            if not rs: continue
            u = [sum(g['used'][s] for g in rs) / len(rs) for s in (0, 1)]
            row(f"tier {t}: {name}", rs, f"   potions {u[0]:.1f}-{u[1]:.1f}")

MORE_ROWS = [  # key, label, bxpow
    ('off', 'off (as the other parts box)', None),
    ('all', 'both sides (the Realm\'s card)', {'sit': True, 'curse': True}),
    ('mine', 'yours only', {'on': [True, False]}),
    ('theirs', 'theirs only', {'on': [False, True]}),
]
MORE_T2 = [('curse', 'both sides, curses alone', {'sit': False}), ('sit', 'both sides, situation powers alone', {'curse': False})]

async def more(pg, errs, t0):
    out = {}
    for t in (1, 2, 3):
        for key, label, P in MORE_ROWS + (MORE_T2 if t == 2 else []):
            out[f't{t}:{key}'] = await batch(pg, N, f"BLAB.card(3, {t - 1}, {t}, {{ seed: 20011 + i, bxpow: {json.dumps(P)} }})")
    json.dump(out, open('/tmp/realm_ring_lab_more.json', 'w'))
    print(f'{time.time() - t0:.0f}s   page errors', len(errs), errs[:2])
    print('\nsituation powers and curses, your three at level 3 against a rival\'s at the tier\'s level, Simulate (the same seeded cards in every row)')
    print('                                             n    win   draw   a card: sits (you, them)  curses (you, them)  washes (you, them)')
    for t in (1, 2, 3):
        base = sum(g['win'] for g in out[f't{t}:off']) / len(out[f't{t}:off'])
        for key, label, _ in MORE_ROWS + (MORE_T2 if t == 2 else []):
            rs = out[f't{t}:{key}']; n = len(rs)
            c = lambda s, k: sum(sum(g['more'][s][x] for x in k) for g in rs) / n
            row(f"tier {t} {label}"[:40].ljust(40), rs, f"   sits {c(0, ('canvas', 'last', 'bell')):.2f}, {c(1, ('canvas', 'last', 'bell')):.2f}  curses {c(0, ('cu',)):.2f}, {c(1, ('cu',)):.2f}  washes {c(0, ('wash',)):.2f}, {c(1, ('wash',)):.2f}" + ('' if key == 'off' else f"   {100 * (sum(g['win'] for g in rs) / n - base):+5.1f} pts"))
    rs = [g for k in out if k.endswith(':all') for g in out[k]]
    n = len(rs)
    print(f"  in the Realm's card ({n} cards, both sides), a card: " + ', '.join(f"{k} {sum(g['more'][s][k] for g in rs for s in (0, 1)) / n:.2f}" for k in ('canvas', 'last', 'bell', 'cu', 'wash')))

asyncio.run(main())

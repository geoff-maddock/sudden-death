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
it earns. Writes /tmp/realm_ring_lab.json."""
import asyncio, json, sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
PRE = sys.argv[2] if len(sys.argv) > 2 else ''

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
    BLAB.journey(lvl);
    const club = Object.values(WG.rivals)[0], keep = wBallOppLvl, taken = new Set(), mine = wRingSide(taken);
    wBallOppLvl = () => Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + gap));
    let opp; try { wBxg().opp = {}; opp = wRingOpp(club, tier, taken); } finally { wBallOppLvl = keep; }
    const sk = wRingSkill(tier); if (o.skill != null) sk[1] = o.skill;
    const t0 = performance.now();
    const r = wBX.simCard({ sides: [mine, opp], skill: sk, powers: o.powers !== false });
    const R = r.result, bouts = r.bouts;
    return { gap, tier, skill: sk[1], powers: o.powers !== false, us: R.won[0], them: R.won[1], win: R.win === 0, tie: R.win == null, by: R.by,
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
    if not rows: return
    w = sum(g['win'] for g in rows); t = sum(g['tie'] for g in rows); n = len(rows)
    print(f"  {label:28s} {n:5d}  {pct(w, n)}  {pct(t, n)}   bouts {sum(g['us'] for g in rows) / n:.2f}-{sum(g['them'] for g in rows) / n:.2f}   stopped {sum(g['stops'] for g in rows) / (3 * n):4.0%}   your KOs {sum(g['myKos'] for g in rows) / n:.2f}")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBcupEnter === 'function'")
        await pg.add_script_tag(content=LAB_JS)
        if PRE: await pg.evaluate(PRE + "\n;0")
        t0 = time.time()
        cards = []
        for gap in (-1, 0, 1, 2, 3):
            cards += await batch(pg, N, f"BLAB.card(3, {gap}, 1 + i % 3)")
        tiers = []
        for t in (1, 2, 3):
            tiers += await batch(pg, N, f"BLAB.card(3, {t - 1}, {t})")
        skills = []
        for sk in (0, 1, 2):
            skills += await batch(pg, N, f"BLAB.card(3, 0, 2, {{ skill: {sk} }})")
        nopow = await batch(pg, N, "BLAB.card(3, 0, 2, { skill: 1, powers: false })")
        belts = await batch(pg, N, "BLAB.belt(3)", per=5)
        await br.close()
    json.dump({'cards': cards, 'tiers': tiers, 'skills': skills, 'nopow': nopow, 'belts': belts}, open('/tmp/realm_ring_lab.json', 'w'))
    allc = cards + tiers + skills + nopow
    print('override', PRE or '(none)', f' {time.time() - t0:.0f}s, {sum(g["ms"] for g in allc) / len(allc):.0f} ms a card')
    print('page errors', len(errs), errs[:2])
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

asyncio.run(main())

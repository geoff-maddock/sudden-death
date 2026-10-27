"""Realm baseball balance bot (issue #4, phase 6): headless ball games and Diamond Cups in dist/realm.html.

  python3 test/realm_diamond_lab.py 120            120 games at each level gap, and 120 cups
  python3 test/realm_diamond_lab.py 120 'W_DCUP.tiers = [1, 1, 2]'    a tuning override, run in the page first

Every game is Brimstone Diamond's own engine played to a final (wBD.sim): both sides on the CPU at the same skill, so
the result comes from the players' ratings, and the CPU skill of a tier makes no difference here. That is what
Simulate gives you; Play and Manage put you in place of the CPU on your side.

Part 1, single games: a fresh journey with five players, all at the same level, against a rival's nine at that level
plus the gap. Win rate by gap, and by tier (which only changes the CPU skill both sides play at).
Part 2, whole cups: a fresh journey at level 3, Simulate every round; how far it gets, how often it wins, what it
earns. Writes /tmp/realm_diamond_lab.json."""
import asyncio, json, sys, os, time, collections
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
PRE = sys.argv[2] if len(sys.argv) > 2 else ''

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
// XP to date, levels included
window.wXpTotal = p => { let n = p.xp; for (let l = 1; l < p.lvl; l++) n += wXpNeed(l); return n; };
"""

def pct(a, b): return f"{100 * a / b:5.1f}%" if b else '   - '

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wDcupEnter === 'function'")
        await pg.add_script_tag(content=LAB_JS)
        if PRE: await pg.evaluate(PRE + "\n;0")
        t0 = time.time()
        games = []
        for gap in (-1, 0, 1, 2, 3):
            for i in range(0, N, 10):
                k = min(10, N - i)
                games += await pg.evaluate(f"(() => {{ const o = []; for (let i = 0; i < {k}; i++) o.push(DLAB.game(3, {gap}, 1 + ({i} + i) % 3)); return o; }})()")
        cups = []
        for i in range(0, N, 5):
            k = min(5, N - i)
            cups += await pg.evaluate(f"(() => {{ const o = []; for (let i = 0; i < {k}; i++) o.push(DLAB.cup(3)); return o; }})()")
        await br.close()
    json.dump({'games': games, 'cups': cups}, open('/tmp/realm_diamond_lab.json', 'w'))
    print('override', PRE or '(none)', f' {time.time() - t0:.0f}s, {sum(g["ms"] for g in games) / len(games):.0f} ms a game')
    print('page errors', len(errs), errs[:2])
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

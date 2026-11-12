"""Realm superstar balance (issue #24, phase 4; basketball from issue #77, phase 8): what a superstar adds to a team, in
the card game, football, baseball and basketball, against an ordinary player of the same level in the same place. (Boxing has its own round robin in
docs/realm/BALANCE.md.)

  python3 test/realm_stars_lab.py 200                    200 of each test for each superstar and the control
  python3 test/realm_stars_lab.py 200 'W_KRK.lash = 2'   a tuning override, run in the page first
  python3 test/realm_stars_lab.py 1000 '' gf,bd          only some tests (normal, elite, gf, bd, bk)
  python3 test/realm_stars_lab.py 300 '' elite ctl,kraken only some superstars (ctl: the control; k:zombie: one league kind)

Every test starts a fresh journey with its players at one level and adds one more player at that level: a superstar,
or (the control) a league kind the team does not have yet, picked at random each time. That player starts; somebody
else is captain, so this measures the power and the cards, not the captain's bonus.
  Card game: the realm's card-game bot (test/realm_lab.js) plays a match at full HP: a pickup game (normal) and an
    elite, at level 4 and tier 2. Win rate, and HP lost in a won match (the real cost of a pickup game).
  Football: a whole game, Simulate (wGF.simGame), at an even level, the other side a Knight (tier 2). Win rate.
  Baseball: a whole game, Simulate (wBD.sim), at an even level, tier 2. Win rate.
  Basketball: a whole game, Simulate (wBK.simGame), four of your own and the extra player as your five, the coach
    picking the spots, at an even level, the other side a Knight (tier 2). Win rate and the margin.
Writes /tmp/realm_stars_lab.json."""
import asyncio, json, sys, os, time
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
PRE = sys.argv[2] if len(sys.argv) > 2 else ''
PARTS = (sys.argv[3] if len(sys.argv) > 3 else 'normal,elite,gf,bd,bk').split(',')

LAB_JS = r"""
window.SLAB = {
  // a fresh journey: n players at lvl, then one more (a superstar's id, or 'ctl' for a league kind the team lacks) who starts
  team(lvl, who, n) {
    LAB = true; wStart(null, { club: pick(CLUB_IDS) });
    const league = () => shuffle(Object.keys(SIG).filter(k => FA_NAMES[k] && !W_STARS.some(s => s.kind === k) && wGF.kinds.includes(k) && !wRoster().some(p => p.kind === k)));
    while (wRoster().length < n) wRecruit({ kind: league()[0], lvl }, 'tavern');
    const s = who === 'ctl' || who.startsWith('k:') ? null : wStar(who), kind = who.startsWith('k:') ? who.slice(2) : null;
    if (kind) for (const q of wRoster().filter(q => q.kind === kind)) wRelease(q.id);
    const p = s ? wRecruit({ kind: s.kind, n: s.name, lvl, num: s.num, star: s.id }, 'star') : wRecruit({ kind: kind || league()[0], lvl }, 'tavern');
    for (const q of wRoster()) { q.lvl = lvl; q.xp = 0; delete q.gf; }
    wMovePlayer(p.id, 0);
    WG.captain = wStarters().find(q => q.id !== p.id).id;
    WG.seven = null; WG.nine = null;
    RUN.gold = 1000; RUN.hp = RUN.maxhp;
    return p;
  },
  card(who, type) {
    SLAB.team(4, who, 3); wSyncParty(); RUN.hp = RUN.maxhp;
    beginFight = enc => { UI.busy = false; startCombat(enc.ids, enc.type, enc.sport, enc.trait); };
    renderPanel = () => { };
    RUN.pending = null; B = null;
    startMatch({ type, tier: 2, world: { kind: 'wild', ref: null, region: 'tide' } });
    const hp0 = RUN.hp; let g = 0;
    while (!B.over && g++ < 80) { REALMBOT({}); if (B.over) break; runSteps(endTurn()); }
    const res = B.over || 'lose', out = { win: res === 'win', lost: hp0 - Math.max(0, RUN.hp), turns: B.turn };
    B.over = res; B.phase = 'done'; finishFight();
    return out;
  },
  gf(who) {
    const p = SLAB.team(3, who, W_GFG.minOwn - 1); for (const q of wRoster()) wGfOf(q); wSevenSync();
    const club = Object.values(WG.rivals)[0]; wGfg().opp = {};
    const opp = wGridOpp(club, 2), sq = wGridSquad(opp);
    const g = wGF.simGame({ teams: [sq.team, opp], skill: wGridSkill(2), powers: true });
    return { win: g.score[0] > g.score[1], tie: g.score[0] === g.score[1], on: sq.team.roster.some(r => r.kind === p.kind), d: g.score[0] - g.score[1] };
  },
  bd(who) {
    const p = SLAB.team(3, who, W_BALL.minOwn - 1); for (const q of wRoster()) wBdOf(q); wNineSync();
    const club = Object.values(WG.rivals)[0], def = wNineDef();
    const opp = wBallOpp(club, 2);
    wBD.sim({ defs: [def, opp], innings: W_BALL.innings, diff: W_BALL.diff[2], rules: W_BALL.rules });
    const [a, h] = wBD.G.teams;
    return { win: a.R > h.R, on: def.roster.some(r => r.kind === p.kind), d: a.R - h.R };
  },
  bk(who) {
    const p = SLAB.team(3, who, 4); for (const q of wRoster()) { delete q.bk; wBkOf(q); } WG.court = null; wCourtSync();
    const club = Object.values(WG.rivals)[0]; wBkg().opp = {};
    const opp = wCourtOpp(club, 2), sq = wCourtSquad(opp);
    const g = wBK.simGame({ teams: [sq.team, opp], skill: wCourtSkill(2), mins: 5, court: true, ordered: [true, false] });
    return { win: g.score[0] > g.score[1], on: sq.team.roster.slice(0, 5).some(r => r.kind === p.kind), d: g.score[0] - g.score[1] };
  }
};
"""

WHO = (sys.argv[4] if len(sys.argv) > 4 else 'ctl,phoenix,kraken,behemoth,djinn,hydra,wyrm').split(',')


def pct(a, b): return f"{100 * a / b:5.1f}%" if b else '   - '


async def batch(pg, n, expr, per=10):
    out = []
    for i in range(0, n, per):
        k = min(per, n - i)
        out += await pg.evaluate(f"(() => {{ const o = []; for (let j = 0; j < {k}; j++) {{ try {{ o.push({expr}); }} catch (e) {{ o.push({{ err: String(e.stack || e) }}); }} }} return o; }})()")
    return out


async def main():
    t0 = time.time()
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wStart === 'function' && typeof W_STARS !== 'undefined'")
        await pg.add_script_tag(path=ROOT + '/test/realm_lab.js')
        await pg.add_script_tag(content=LAB_JS)
        if PRE: await pg.evaluate(PRE + "\n;0")
        res = {}
        for w in WHO:
            run = {'normal': f"SLAB.card('{w}', 'normal')", 'elite': f"SLAB.card('{w}', 'elite')", 'gf': f"SLAB.gf('{w}')", 'bd': f"SLAB.bd('{w}')", 'bk': f"SLAB.bk('{w}')"}
            res[w] = {k: (await batch(pg, N, e) if k in PARTS else []) for k, e in run.items()}
            print(f"  {w} done, {time.time() - t0:.0f}s", flush=True)
        await br.close()
    json.dump(res, open('/tmp/realm_stars_lab.json', 'w'))
    bad = [(w, k, r['err']) for w in res for k in res[w] for r in res[w][k] if 'err' in r]
    if bad: print('ERRORS', len(bad), bad[0])
    print(f"\n{N} of each. Card game at level 4, tier 2 (HP lost: in won pickup games). Football, baseball and basketball at an even level, tier 2.")
    print(f"{'':10} {'pickup win':>10} {'HP lost':>8} {'elite win':>10} {'HP lost':>8} {'football':>9} {'ties':>6} {'started':>8} {'baseball':>9} {'started':>8} {'basketball':>11} {'margin':>7}")
    for w in WHO:
        R = {k: [r for r in v if 'err' not in r] for k, v in res[w].items()}
        won = [r for r in R['normal'] if r['win']]; wel = [r for r in R['elite'] if r['win']]
        hp = sum(r['lost'] for r in won) / max(1, len(won)); hpe = sum(r['lost'] for r in wel) / max(1, len(wel))
        print(f"{('control' if w == 'ctl' else w):10} {pct(len(won), len(R['normal'])):>10} {hp:8.1f} {pct(len(wel), len(R['elite'])):>10} {hpe:8.1f} "
              f"{pct(sum(r['win'] for r in R['gf']), len(R['gf'])):>9} {pct(sum(r['tie'] for r in R['gf']), len(R['gf'])):>6} {pct(sum(r['on'] for r in R['gf']), len(R['gf'])):>8} "
              f"{pct(sum(r['win'] for r in R['bd']), len(R['bd'])):>9} {pct(sum(r['on'] for r in R['bd']), len(R['bd'])):>8} "
              f"{pct(sum(r['win'] for r in R['bk']), len(R['bk'])):>11} {sum(r['d'] for r in R['bk']) / max(1, len(R['bk'])):7.1f}")
    print(f"total {time.time() - t0:.0f}s")
    if errs: print('page errors:', errs[:3])

asyncio.run(main())

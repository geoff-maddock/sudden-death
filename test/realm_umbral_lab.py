"""Umbral balance (issue #99): the card game at tier U, with the teams that get there.

  python3 test/realm_umbral_lab.py 40            40 journeys by the realm bot; each that wins the Crown then plays
                                                  K matches of each kind below, at full HP, from the same team
  python3 test/realm_umbral_lab.py 40 3 'W_UMB3.card.hp = 1.15'   K, and a tuning override run in the page first

Kinds, all at level 4 (W_ROAD.maxLv):
  light3        an ordinary match in the light at tier 3 (the hardest the light has)
  dark          the same on the dark side: tier U, dark traits
  light3 elite  an elite match in the light at tier 3
  dark elite    the same on the dark side
  gate          the Gatekeeper, with two hexes drawn as for a first try
Prints the win rate, the HP lost (as a share of max HP) and the turns for each. Writes /tmp/realm_umbral_lab.json."""
import asyncio, json, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 40
K = int(sys.argv[2]) if len(sys.argv) > 2 else 3
PRE = sys.argv[3] if len(sys.argv) > 3 else ''

LAB_JS = r"""
window.ULAB = function (K) {
  const log = REALMLAB({}), out = { champion: log.result === 'champion', runs: [] };
  if (!out.champion || !WG.umbral) return out;
  const den = DB.locs.find(l => l.id === 'rimewatch');
  const one = (what, map, spec) => {
    RUN.hp = RUN.maxhp; RUN.pending = null; B = null; WG.map = map; WG.x = den.x; WG.y = den.y + 1; WG.min = 12 * 60;
    if (spec === 'gate') { WG.umbral.tries = {}; WG.umbral.pieces = []; WG.map = 'u:umbralden'; wNadirMatch('gate'); }
    else startMatch(Object.assign({ tier: 3, lv: W_ROAD.maxLv, ambush: false, world: { kind: 'wild', ref: null, region: 'rime' } }, spec));
    if (!B) return null;
    const hp0 = RUN.hp; let g = 0;
    while (!B.over && g++ < 80) { REALMBOT({}); if (B.over) break; runSteps(endTurn()); }
    const r = { what, win: B.over === 'win', lost: (hp0 - Math.max(0, RUN.hp)) / RUN.maxhp, turns: B.turn, ids: RUN.pending.ids.join('+') };
    B = null; RUN.pending = null; return r;
  };
  for (let k = 0; k < K; k++) for (const [what, map, spec] of [['light3', 'world', { type: 'normal' }], ['dark', 'u:world', { type: 'normal' }],
    ['light3 elite', 'world', { type: 'elite' }], ['dark elite', 'u:world', { type: 'elite' }], ['gate', 'u:umbralden', 'gate']]) { const r = one(what, map, spec); if (r) out.runs.push(r); }
  out.lvl = wRoster().reduce((a, p) => a + p.lvl, 0) / wRoster().length; out.deck = RUN.deck.length;
  return out;
};
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wStart === 'function' && typeof wNadirMatch === 'function'")
        await pg.add_script_tag(path=ROOT + '/test/realm_lab.js')
        await pg.add_script_tag(content=LAB_JS)
        if PRE: await pg.evaluate(PRE + "\n;0")
        logs = []
        for i in range(N):
            try: logs.append(await pg.evaluate(f'ULAB({K})'))
            except Exception as e: logs.append({'err': str(e)[:300]})
        await b.close()
    json.dump(logs, open('/tmp/realm_umbral_lab.json', 'w'))
    bad = [l['err'] for l in logs if 'err' in l]
    champs = [l for l in logs if l.get('champion')]
    print(f"page errors {len(errs)} {errs[:2]}  run errors {len(bad)} {bad[:2]}")
    print(f"journeys {len(logs)}, champions {len(champs)}" + (f", team level {sum(l['lvl'] for l in champs) / len(champs):.1f}, deck {sum(l['deck'] for l in champs) / len(champs):.0f}" if champs else ''))
    runs = [r for l in champs for r in l['runs']]
    for what in ['light3', 'dark', 'light3 elite', 'dark elite', 'gate']:
        rs = [r for r in runs if r['what'] == what]
        if not rs: continue
        print(f"{what:13} n {len(rs):4}  win {100 * sum(r['win'] for r in rs) / len(rs):5.1f}%  HP lost {100 * sum(r['lost'] for r in rs) / len(rs):5.1f}%  turns {sum(r['turns'] for r in rs) / len(rs):4.1f}")

asyncio.run(main())

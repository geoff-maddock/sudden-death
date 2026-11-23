"""Umbral balance (issue #99, phase 7): the whole Umbral, played through by the realm bot.

  python3 test/realm_umbral_journey_lab.py 40           40 journeys; each that wins the Crown then plays the Umbral
  python3 test/realm_umbral_journey_lab.py 40 10 'PRE'  the tries allowed a champion (and a round of the Seal), and a
                                                        tuning override run in the page first

Each Crown winner: the Gatekeeper first, then each sport's champion in turn (its two guards first, each an Umbral card
match, tried until beaten, at most TRIES each; the region's gate item taken as brought). A champion is tried until
beaten, at most TRIES times, while the gold lasts for the toll. Rested by a lantern before every match (full HP).
With all nine pieces, the Seal: three rounds, each tried at most TRIES times. Engine games are Simulated (the adapters
in LAB), card matches played by the bot.
Prints: how many of the Crown winners forged the Seal, the pieces they held at the end, where the others stopped, and
each champion's games won / played (and the guards' and the finale rounds'). Writes /tmp/realm_umbral_journey.json.
The target (issue #99): the Seal on about 5 to 15% of journeys that reach the Crown."""
import asyncio, json, sys, os, collections
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 40
TRIES = int(sys.argv[2]) if len(sys.argv) > 2 else 10
PRE = sys.argv[3] if len(sys.argv) > 3 else ''

LAB_JS = r"""
window.UJLAB = function (TRIES) {
  const log = REALMLAB({}), out = { champion: log.result === 'champion', games: [], stop: null };
  if (!out.champion || !WG.umbral) return out;
  const U = WG.umbral; U.seen = WG.dayAbs;
  const rest = () => { RUN.hp = RUN.maxhp; WG.cardOffer = null; WG.wprompts = []; };
  // a card match started by go(): played by the bot, settled the realm's way (a win continues, a loss blacks out)
  const card = (go) => {
    RUN.pending = null; B = null; go(); if (!B) return null;
    let g = 0; while (!B.over && g++ < 80) { REALMBOT({}); if (B.over) break; runSteps(endTurn()); }
    const res = B.over || 'lose'; if (!B.over) { B.over = 'lose'; B.phase = 'done'; }
    finishFight(); if (res === 'win') backToMap();
    WG.cardOffer = null; return res;
  };
  const play = (id) => {
    const C = W_NADIR[id]; rest();
    if (C.cond && C.cond.k === 'night') WG.min = 23 * 60;   // (a champion who plays only after dark: the bot waits for night)
    if (C.engine && id !== 'finale' || (id === 'finale' && C.engine)) { const t0 = (U.tries[id] || 0), p0 = U.pieces.length, f0 = U.finale || 0; const why = wNadirMatch(id); if (why) return null;
      return id === 'finale' ? ((U.finale || 0) > f0 ? 'win' : 'lose') : (U.pieces.length > p0 ? 'win' : 'lose'); }
    return card(() => wNadirMatch(id));
  };
  const champs = ['gate'].concat(Object.keys(W_NADIR).filter(k => W_NADIR[k].ground));
  for (const id of champs) {
    const C = W_NADIR[id]; WG.map = C.map || 'u:umbralden';
    if (C.ground) {
      U.guards = U.guards || {}; U.gates = U.gates || {}; U.gates[id] = WG.dayAbs;
      for (const i of [0, 1]) for (let t = 0; t < TRIES && !U.guards[C.ground + ':' + i]; t++) { rest(); const r = card(() => wUmbGuardMatch(C.ground, i)); out.games.push({ who: 'guard', res: r }); }
      if (![0, 1].every(i => U.guards[C.ground + ':' + i])) { out.stop = out.stop || 'guards of ' + id; break; }
    }
    let won = false;
    for (let t = 0; t < TRIES && !won; t++) {
      if ((U.tries[id] || 0) > 0 && RUN.gold < C.toll) { out.stop = out.stop || 'gold at ' + id; break; }
      const r = play(id); if (r == null) { out.stop = out.stop || 'could not play ' + id; break; }
      out.games.push({ who: id, res: r }); won = r === 'win';
    }
    if (!won) { out.stop = out.stop || 'lost to ' + id; break; }
  }
  out.pieces = U.pieces.length;
  if (out.pieces === 9) {
    WG.map = 'u:coliseum';
    for (let round = 0; round < 3 && !U.sealed; round++) {
      let won = false;
      for (let t = 0; t < TRIES && !won && !U.sealed; t++) { const r0 = U.finale || 0; wUmbFinaleEntry(); const r = play('finale'); out.games.push({ who: 'finale' + r0 + ':' + (W_NADIR.finale.engine || 'card'), res: r }); won = r === 'win' || (U.finale || 0) > r0 || !!U.sealed; }
      if (!won && !U.sealed) { out.stop = 'the Seal, round ' + (round + 1); break; }
    }
  }
  out.sealed = !!U.sealed; out.lvl = wRoster().reduce((a, p) => a + p.lvl, 0) / wRoster().length;
  return out;
};
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wStart === 'function' && typeof wUmbFinale === 'function'")
        await pg.add_script_tag(path=ROOT + '/test/realm_lab.js')
        await pg.add_script_tag(content=LAB_JS)
        if PRE: await pg.evaluate(PRE + "\n;0")
        logs = []
        for i in range(N):
            try: logs.append(await pg.evaluate(f'UJLAB({TRIES})'))
            except Exception as e: logs.append({'err': str(e)[:300]})
        await b.close()
    json.dump(logs, open('/tmp/realm_umbral_journey.json', 'w'))
    bad = [l['err'] for l in logs if 'err' in l]
    ch = [l for l in logs if l.get('champion')]
    print(f"page errors {len(errs)} {errs[:2]}  run errors {len(bad)} {bad[:2]}")
    print(f"journeys {len(logs)}, Crown winners {len(ch)}, forged the Seal {sum(l.get('sealed', False) for l in ch)} ({100 * sum(l.get('sealed', False) for l in ch) / max(1, len(ch)):.0f}% of Crown winners)")
    print('pieces at the end:', dict(sorted(collections.Counter(l.get('pieces', 0) for l in ch).items())))
    print('where the others stopped:', dict(collections.Counter(l.get('stop') for l in ch if not l.get('sealed')).most_common()))
    games = collections.defaultdict(lambda: [0, 0])
    for l in ch:
        for g in l.get('games', []): games[g['who']][1] += 1; games[g['who']][0] += g['res'] == 'win'
    for who, (w, n) in sorted(games.items()): print(f"  {who:22} won {w:3} of {n:3}  ({100 * w / max(1, n):.0f}%)")

asyncio.run(main())

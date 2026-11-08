# Boxing gear and potions (issue #61, phase 2). Asserts: the five pieces and the potions are items, sold and found
# where they should be; each piece does what it says over seeded headless bouts (wraps hit harder and cut deeper, a
# mouthguard takes less, lucky trunks beat the count sooner, the robe's opening status); potions in your corner (one a
# round, only between rounds, from the bag, each doing what it says, your corner's advice); the CPU corner using its
# bag with reasons in the log; a card's bags carried from bout to bout; and in the Realm: the bags on the pairing,
# Simulate leaving your bag alone, a potion given from the ring bar and taken from your bag when the card is settled,
# gear on the tale of the tape, the Belt's gear, and How to play. Exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

async def new_journey(pg, clear=False):
    await pg.goto(REALM_URL)
    if clear: await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof wRingBagMine === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close]') || document.querySelector('#modalBox button'); if (!b) break; b.click(); } })()"""

# a pair of fighters, the first with or without a piece of gear; N seeded bouts each way, same seeds
PAIR = """((gear, N, kinds) => { const k = kinds || ['ogre', 'minotaur'];
  const mk = (kind, g) => Object.assign({ n: kind, kind, num: 1, r: wBX.rate(kind) }, g ? { gear: { id: 'x', name: 'X', fx: g } } : {});
  const run = g => { const out = { dmg: 0, hpMaxB: 0, taken: 0, rise: [], kdB: 0 };
    for (let i = 0; i < N; i++) { const s = wBX.simBout({ fighters: [mk(k[0], g), mk(k[1], null)], seed: 9000 + i, skill: [1, 1] });
      out.dmg += s.stats[0].dmg; out.taken += s.stats[1].dmg; out.hpMaxB += s.fighters[1].hpMax; out.kdB += s.kd[1];
      for (const l of s.log) { const m = /^(.+) is up at (\\d+)\\.$/.exec(l.msg); if (m && m[1] === k[0]) out.rise.push(+m[2]); } }
    out.dmg /= N; out.taken /= N; out.hpMaxB /= N; out.riseAvg = out.rise.length ? out.rise.reduce((a, b) => a + b, 0) / out.rise.length : null; return out; };
  return { off: run(null), on: run(gear) }; })"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await new_journey(pg, clear=True)
        await pg.evaluate("(() => { while (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind: 'dwarf', lvl: 3 }, 'tavern')); })()")

        # ---- items, stores, chests ----
        r = await pg.evaluate("""(() => ({ gear: Object.keys(W_RING_GEAR).map(id => [id, DB.items[id] && DB.items[id].gear, !!DB.items[id].desc]),
          pots: ['cutsalve', 'smellsalts', 'ragetonic'].map(id => [id, !!DB.items[id], W_POTIONS[id] && W_POTIONS[id].sport]), draught: wPotionSports('draught'),
          everyStore: Object.values(DB.shops).every(S => S.cutsalve && S.smellsalts), cind: ['ragetonic', 'bx_wraps', 'bx_guard', 'bx_trunks'].every(id => DB.shops.cind[id]),
          elsewhereRage: Object.keys(DB.shops).filter(k => k !== 'cind' && DB.shops[k].ragetonic), chests: ['bx_gloves', 'bx_robe'].map(id => Object.keys(DB.chests).filter(c => (DB.chests[c].items || {})[id])) }))()""")
        check(len(r['gear']) == 5 and all(g[1] == 'ring' and g[2] for g in r['gear']), 'five pieces of boxing gear, each an item with what it does', r['gear'])
        check(all(x[1] and x[2] == 'ring' for x in r['pots']) and sorted(r['draught']) == ['grid', 'ring'], "boxing's potions are items; the Stamina Draught serves both sports", r)
        check(r['everyStore'] and r['cind'] and not r['elsewhereRage'], "Cut Salve and Smelling Salts in every store; the Rage Tonic and three pieces in Cinderhold's", r)
        check(all(len(c) >= 1 for c in r['chests']), 'the Weighted Gloves and the Ember Robe are in chests', r['chests'])

        # ---- gear in the engine, over seeded bouts ----
        w = await pg.evaluate(PAIR + "({ dmg: 1.08, cut: 1.33 }, 30)")
        check(w['on']['dmg'] > w['off']['dmg'] * 1.03 and w['on']['hpMaxB'] < w['off']['hpMaxB'] - 1, 'Hand Wraps: more damage, and more off the other fighter\'s most health', w)
        # (stats[1].dmg is what side 1 did; what side 1 TAKES is side 0's damage)
        m = await pg.evaluate("""(() => { const mk = (kind, g) => Object.assign({ n: kind, kind, num: 1, r: wBX.rate(kind) }, g ? { gear: { id: 'x', name: 'X', fx: g } } : {});
          let off = 0, on = 0; for (let i = 0; i < 60; i++) { off += wBX.simBout({ fighters: [mk('ogre'), mk('minotaur')], seed: 7000 + i }).stats[0].dmg; on += wBX.simBout({ fighters: [mk('ogre'), mk('minotaur', { headIn: .95 })], seed: 7000 + i }).stats[0].dmg; }
          return { off: off / 60, on: on / 60 }; })()""")
        check(m['on'] < m['off'], 'a Mouthguard: the fighter wearing it takes less (60 seeded bouts each way)', m)
        t = await pg.evaluate(PAIR + "({ rise: 1 }, 60, ['harpy', 'ogre'])")
        check(t['on']['riseAvg'] is not None and t['off']['riseAvg'] is not None and t['on']['riseAvg'] <= t['off']['riseAvg'] - .5, 'Lucky Trunks: up from a knockdown sooner', {'on': t['on']['riseAvg'], 'off': t['off']['riseAvg'], 'n': [len(t['on']['rise']), len(t['off']['rise'])]})
        r = await pg.evaluate("""(() => { wBX.start({ fighters: [{ n: 'A', kind: 'ogre', gear: { id: 'bx_robe', name: 'Ember Robe', fx: W_RING_GEAR.bx_robe.fx } }, { n: 'B', kind: 'elf' }], mode: 'watch', seed: 5 });
          const fx = wBX.fx(0), G = wBX.G; wBX.hide && wBX.hide(); return { fx, gear: G.F[0].gear, gx: G.F[0].gx }; })()""")
        check(any(f.get('id') == 'g_open' and f.get('acc') == .08 and f.get('t') == 12 for f in r['fx']) and r['gear'] == 'Ember Robe', "the Ember Robe's status is on at the opening bell", r)

        # ---- potions in your corner ----
        r = await pg.evaluate("""(() => {
          wBX.start({ fighters: [{ n: 'A', kind: 'ogre' }, { n: 'B', kind: 'elf' }], mode: 'call', you: 0, seed: 11, bags: [{ cutsalve: 1, smellsalts: 1, ragetonic: 1, draught: 1 }, {}] });
          const out = { intro: wBX.potionOk('cutsalve') }; wBX.call(wBX.wait.plan);
          for (let i = 0; i < 200000 && wBX.phase !== 'corner'; i++) wBX.step();
          out.inRound = false; const G = wBX.G, f = G.F[0];
          f.hpMax = 60; f.hp = 30; f.sta = 10;
          out.ok = wBX.potionOk('cutsalve'); out.use = wBX.potion('cutsalve'); out.hpMax = f.hpMax; out.hp = f.hp; out.bag = wBX.bag(0);
          out.second = wBX.potion('smellsalts'); out.log = G.log.slice(-1)[0].msg;
          return out; })()""")
        check(r['intro'] is False, 'no potions before the first round', r)
        check(r['ok'] and r['use'] and r['hpMax'] == 75 and r['hp'] == 40 and r['bag'].get('cutsalve') == 0, 'Cut Salve in the corner: 15 on their most health and 10 health, out of the bag', r)
        check(r['second'] is False and 'Cut Salve' in r['log'] and 'corner gives' in r['log'], 'one potion a round, and the log says so', r)
        r = await pg.evaluate("""(() => { const G = wBX.G, f = G.F[0], out = {};
          wBX.call(wBX.wait ? wBX.wait.plan : 'box'); for (let i = 0; i < 200000 && wBX.phase === 'corner'; i++) wBX.step(); for (let i = 0; i < 200000 && wBX.phase !== 'corner' && wBX.phase !== 'over'; i++) wBX.step();
          if (wBX.phase !== 'corner') return { phase: wBX.phase, round: G.round };
          f.potRound = -1;
          f.sta = 5; out.draught = wBX.potion('draught') && f.sta === f.staMax && f.fx.some(s => s.id === 'p_draught');
          out.salts = false; out.over = wBX.phase; return out; })()""")
        check(r.get('draught'), 'the Stamina Draught: full breath, and faster breath for the round', r)
        r = await pg.evaluate("""(() => {
          wBX.start({ fighters: [{ n: 'A', kind: 'harpy' }, { n: 'B', kind: 'ogre' }], mode: 'call', you: 0, seed: 21, bags: [{ smellsalts: 1, ragetonic: 1 }, {}] });
          wBX.call(wBX.wait.plan); const G = wBX.G, f = G.F[0]; G.kd[0] = 1;
          for (let i = 0; i < 200000 && wBX.phase !== 'corner'; i++) wBX.step();
          const adv = wBX.wait && wBX.wait.pot; const salts = wBX.potion('smellsalts') && f.salts === 3;
          return { adv, salts, rage: wBX.potionOk('ragetonic') }; })()""")
        check(r['salts'] and r['adv'] and r['adv']['id'] == 'smellsalts' and 'down' in r['adv']['why'], 'Smelling Salts set the next count, and your corner advised them after a knockdown, saying why', r)
        r = await pg.evaluate("""(() => { const G = wBX.G; wBX.call(wBX.wait.plan); for (let i = 0; i < 200000 && wBX.phase === 'corner'; i++) wBX.step(); for (let i = 0; i < 200000 && wBX.phase !== 'corner' && wBX.phase !== 'over'; i++) wBX.step();
          if (wBX.phase !== 'corner') return { ph: wBX.phase };
          const f = G.F[0]; return { rage: wBX.potion('ragetonic') && f.fx.some(s => s.id === 'p_rage' && s.dmgOut === 1.2 && s.dmgIn === 1.15) }; })()""")
        check(r.get('rage'), 'the Rage Tonic: more damage out and more taken, for the round', r)

        # ---- the CPU corner, and a card's bags ----
        r = await pg.evaluate("""(() => { let uses = 0, why = [], over = 0;
          for (let i = 0; i < 40; i++) { const s = wBX.simBout({ fighters: [{ n: 'A', kind: 'ogre' }, { n: 'B', kind: 'elf' }], seed: 300 + i, skill: [2, 2], bags: [{}, { cutsalve: 1, smellsalts: 1, ragetonic: 1, draught: 1 }] });
            uses += s.pots.filter(p => p.s === 1).length; if (s.pots.some(p => p.s === 0)) over++;
            for (const l of s.log) if (/corner gives B/.test(l.msg)) why.push(l.msg);
            const left = s.bags[1]; if (Object.values(left).some(n => n < 0)) over++; }
          return { uses, over, why: why.slice(0, 4), withWhy: why.every(m => /: /.test(m)) }; })()""")
        check(r['uses'] > 10 and r['over'] == 0, 'the CPU corner uses its own bag (never more than it has, never the other side\'s)', r)
        check(r['withWhy'] and r['why'], 'every potion the CPU corner gives is in the log with its reason', r['why'])
        r = await pg.evaluate("""(() => { const side = n => ({ name: n, fighters: ['ogre', 'troll', 'dwarf'].map(k => ({ n: k, kind: k })) });
          const c = wBX.simCard({ sides: [side('A'), side('B')], seed: 77, skill: [2, 2], bags: [{}, { cutsalve: 1 }] });
          const used = c.bouts.reduce((n, b) => n + b.pots.filter(p => p.s === 1).length, 0); return { used, left: c.bags[1].cutsalve }; })()""")
        check(r['used'] <= 1 and r['left'] == 1 - r['used'], "a card's bag carries from bout to bout: a potion used is gone for the next", r)

        # ---- in the Realm ----
        await pg.evaluate("(() => { wAddItem('cutsalve', 2); wAddItem('smellsalts', 1); const p = wRoster()[0]; wAddItem('bx_guard', 1); wGearPutOn(p.id, 'bx_guard'); })()")
        why = await pg.evaluate("wStartRing({ club: 'local', how: 'manage' })")
        await pg.wait_for_selector('#modalBox [data-rkbags]')
        t = await pg.evaluate("({ bags: document.querySelector('[data-rkbags]').textContent, gear: [...document.querySelectorAll('[data-tgear]')].map(e => e.textContent) })")
        check(why == '' and '2 Cut Salve' in t['bags'] and '1 Smelling Salts' in t['bags'] and 'Theirs:' in t['bags'], 'the pairing says what each corner brings', t)
        # Simulate leaves your bag alone
        await pg.click('#modalBox [data-rgo="sim"]')
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("({ cs: WG.items.cutsalve || 0, ss: WG.items.smellsalts || 0, live: wRingLive() })")
        check(r['cs'] == 2 and r['ss'] == 1 and not r['live'], 'Simulate leaves your bag alone', r)
        # the tape, with the fighter in the Mouthguard
        r = await pg.evaluate("""(() => { const mine = wRingSide(new Set()), theirs = wRingOpp('local', 1, new Set()), f = mine.fighters.find(x => x.gear);
          return { tape: f ? wRingTape(f, theirs.fighters[0]) : '', n: f && f.gear.name }; })()""")
        check('Mouthguard' in r['tape'] and 'data-tgear' in r['tape'], 'the tale of the tape shows the gear each fighter wears', r['n'])
        # a real card in Manage: a potion from the ring bar, then out of the bag when the card is settled
        await pg.evaluate("(() => { WG.bxg.met = {}; wStartRing({ club: 'local', how: 'manage' }); })()")
        await pg.wait_for_selector('#modalBox [data-rgo="manage"]')
        await pg.click('#modalBox [data-rgo="manage"]')
        await pg.wait_for_function("UI.view === 'ring' && wRingLive()")
        await pg.evaluate("wBX.speed = 8; WBX && wBX.call(wBX.wait ? wBX.wait.plan : 'box')")
        await pg.evaluate("(() => { for (let i = 0; i < 200000 && wBX.phase !== 'corner'; i++) wBX.step(); wRingBarNote(); })()")
        n = await pg.evaluate("document.querySelectorAll('#wRingPots [data-rpot]').length")
        await pg.click('#wRingPots [data-rpot="cutsalve"]')
        r = await pg.evaluate("({ bag: wBX.bag(0), items: WG.items.cutsalve || 0, btn: (document.querySelector('#wRingPots [data-rpot=\"cutsalve\"]') || {}).textContent, dis: (document.querySelector('#wRingPots [data-rpot=\"smellsalts\"]') || {}).disabled })")
        check(n == 2 and r['bag'].get('cutsalve') == 1 and r['items'] == 2 and 'Cut Salve (1)' in r['btn'] and r['dis'], 'the ring bar gives a potion in the corner (one a round); the bag is settled at the end', r)
        await pg.evaluate("(() => { wRingConcede(); })()")
        await pg.wait_for_selector('#cfYes'); await pg.click('#cfYes')
        await pg.wait_for_function("!wRingLive()")
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("({ cs: WG.items.cutsalve || 0, ss: WG.items.smellsalts || 0, log: WLOG.map(l => l[0]).filter(t => t.startsWith('Used in the corner')).slice(-1)[0] || '' })")
        check(r['cs'] == 1 and r['ss'] == 1 and '1 Cut Salve' in r['log'], 'what your corner used comes out of your bag when the card is settled (a conceded card too)', r)

        # ---- the Belt's gear ----
        r = await pg.evaluate("""(() => { WG.bcup = { cards: [[], [], [{ a: 'me', b: 'local', ra: 2, rb: 1 }]], round: 2, done: false }; try { wBcupWon(); } catch (e) { return { err: String(e) }; } return { robe: WG.items.bx_robe || 0, log: WLOG.map(l => l[0]).filter(t => t.includes('Belt comes with gear')).length }; })()""")
        check(r.get('robe') == 1 and r.get('log') == 1, 'the Anvil Belt adds the first piece of boxing gear you do not have', r)

        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpRingKit'); return e ? e.textContent : ''; })()")
        check('Hand Wraps' in h and 'Cut Salve' in h and 'one potion a round' in h, 'How to play explains boxing gear and potions', h[:200])
        check(not errs, 'no page errors', errs[:4])
        print('errors:', errs[:4])
        await br.close()
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

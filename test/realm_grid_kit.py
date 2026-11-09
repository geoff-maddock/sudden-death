# Football gear and potions (issue #61, phase 3). Asserts: the five pieces and four new potions are items, sold and
# found where they should be; the engine keeps a player's gear and each piece does what it says (cleats at the snap,
# the helmet's fumbles, the tee's range and chance, sticky gloves' catches and the pads' blocks, over the same seeded
# downs with and without); each new potion in the engine (one a play, Resin only with the ball, the Elixir's speed on
# the next play, the Fog hiding the call from the other coach, the Balm's full ratings), and your sideline's advice;
# the CPU sideline using its bag by skill, with reasons in the log; and in the Realm: their bag going in (Simulate
# leaving yours alone), a potion from Your bench taken from your bag, the new potions on the panel, gear on the Seven
# tab and in the lineup, the bags on the game card, the Cinder Cup's gear, and How to play. Exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wGridOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

# two sides for the engine; the first may wear one piece each (gear), on everyone or on the positions in at
TEAMS = """const KA = ['kobold', 'minotaur', 'golem', 'ogre', 'dwarf', 'goblin', 'troll'], KB = ['harpy', 'elf', 'golem', 'zombie', 'troll', 'skeleton', 'goblin'];
  const team = (name, ks, gear) => ({ name, short: name, color: '#c00', light: '#fff', roster: ks.map((kind, i) => Object.assign({ n: name + kind, kind, num: i + 1, r: wGF.rate(kind) }, gear ? { gear: { id: 'gx', name: 'Test Gear', fx: gear } } : {})) });
  const both = gear => [team('A', KA, gear), team('B', KB, null)];"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1400, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wGridBagMine === 'function'")
        await pg.evaluate("SET.tips = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy', 'elf', 'witch', 'vampire']) wRecruit({ kind, lvl: 2 }, 'tavern'); })()")
        await pg.evaluate(CLOSE_ALL)

        # ---- items, stores, chests ----
        r = await pg.evaluate("""(() => ({ gear: Object.keys(W_GRID_GEAR).map(id => [id, DB.items[id] && DB.items[id].gear, !!DB.items[id].desc]),
          pots: Object.keys(W_GRID_KIT.potions).map(id => [id, !!DB.items[id], wPotionSports(id)]),
          everyStore: Object.values(DB.shops).every(S => S.gfresin && S.gfsalve), cind: ['gfhaste', 'gffog', 'gf_cleats', 'gf_helmet', 'gf_tee'].every(id => DB.shops.cind[id]),
          elsewhere: Object.keys(DB.shops).filter(k => k !== 'cind' && (DB.shops[k].gfhaste || DB.shops[k].gffog || DB.shops[k].gf_cleats)),
          chests: ['gf_gloves', 'gf_pads'].map(id => Object.keys(DB.chests).filter(c => (DB.chests[c].items || {})[id])) }))()""")
        check(len(r['gear']) == 5 and all(g[1] == 'grid' and g[2] for g in r['gear']), 'five pieces of football gear, each an item with what it does', r['gear'])
        check(len(r['pots']) == 4 and all(x[1] and x[2] == ['grid'] for x in r['pots']), 'four new football potions, each an item for football', r['pots'])
        check(r['everyStore'] and r['cind'] and not r['elsewhere'], 'Resin and the Balm in every store; the Elixir, the Fog and three pieces in Cinderhold\'s', r)
        check(all(len(c) >= 1 for c in r['chests']), 'Sticky Gloves and Shoulder Pads are found in chests', r['chests'])

        # ---- gear in the engine ----
        g = await pg.evaluate("""(() => { %s
          wGF.start({ teams: both({ r: { spd: 1 }, fum: .4 }), seed: 3 }); const T = wGF.G.teams[0].roster[0];
          return { gear: T.gear, gx: T.gx, spdUp: T.r.spd }; })()""" % TEAMS)
        check(g['gear'] == 'Test Gear' and g['gx'] == {'fum': 0.4}, "the engine keeps a player's gear: its name and its effects (the ratings already laid on)", g)
        sn = await pg.evaluate("""(() => { %s
          const L = wGF.snap('run', 'man', { teams: both({ spd: 1.01, turn: 1.2 }), seed: 4 });
          return { off: L.pl.filter(p => p.side === 0).map(p => [p.sm, p.tn]), def: L.pl.filter(p => p.side === 1).map(p => [p.sm, p.tn]) }; })()""" % TEAMS)
        check(all(x == [1.01, 1.2] for x in sn['off']) and all(x == [1, 1] for x in sn['def']), 'Ash Cleats: their wearers are quicker and turn sharper from the snap; nobody else', sn)
        fr = await pg.evaluate("""(() => { %s
          wGF.start({ teams: both(null), seed: 5 }); const a = wGF.fumRisk(0).x; wGF.start({ teams: both({ fum: .4 }), seed: 5 }); const b = wGF.fumRisk(0).x; return { a, b }; })()""" % TEAMS)
        check(abs(fr['b'] / fr['a'] - .4) < .01, 'the Reinforced Helmet: the back fumbles 40% as often', fr)
        tee = await pg.evaluate("""(() => { %s
          const at = gear => { wGF.start({ teams: both(gear), seed: 6 }); wGF.G.poss = 0; wGF.G.ball = 51; return wGF.kick(); };
          return { off: at(null), on: at({ kick: 6, punt: 4 }) }; })()""" % TEAMS)
        check(not tee['off']['inRange'] and tee['on']['inRange'] and tee['on']['tee'] == 6 and tee['on']['chance'] > tee['off']['chance'],
              'the Kicking Tee: a 66-yard try is in range with it, and likelier', tee)
        dn = await pg.evaluate("""(() => { %s
          const run = (gear, oc, dc, N) => { let c = 0, n = 0, yd = 0; for (let i = 0; i < N; i++) { const d = wGF.down(oc, dc, { teams: both(gear), seed: 7000 + i }); n++; yd += d.gain;
            if (!['inc', 'int', 'sack'].includes(d.what)) c++; } return { c: c / n, yd: yd / n }; };
          return { pass0: run(null, 'short', 'man', 300), pass1: run({ catch: .07 }, 'short', 'man', 300), run0: run(null, 'run', 'zone', 300), run1: run({ blk: 1 }, 'run', 'zone', 300) }; })()""" % TEAMS)
        check(dn['pass1']['c'] > dn['pass0']['c'], 'Sticky Gloves: more passes caught over the same 300 seeded downs', dn)
        check(dn['run1']['yd'] > dn['run0']['yd'], 'Shoulder Pads: more yards a run over the same 300 seeded downs', dn)

        # ---- potions in the engine: a game at the call, saved, and put back for each one ----
        await pg.evaluate("wGridironGame({ mode: 'call' })")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call'", timeout=30000)
        await pg.evaluate("wGF.pause(true); window.__sn = wGF.snapshot()")
        RES = "(() => { wGF.resume(__sn); wGF.pause(true); })()"
        await pg.evaluate(RES)
        rs = await pg.evaluate("""(() => { const G = wGF.G; G.poss = 0; const msg = wGF.potion('gfresin', null);
          return { msg, resin: G.drive.resin, risk: wGF.fumRisk(0).x, notes: wGF.notes(), again: wGF.potionWhy('gffog', null), pots: wGF.pots() }; })()""")
        check('Fumble Resin' in rs['msg'] and rs['resin'] == 0 and rs['risk'] == 0, 'Fumble Resin: no fumbles for the rest of the drive', rs)
        check(any(n['k'] == 'pot' for n in rs['notes']) and rs['pots'] and rs['pots'][0]['id'] == 'gfresin', 'it goes in the next play\'s log line and the potions used', rs)
        check(rs['again'] == 'One potion a play.', 'one potion a play', rs)
        await pg.evaluate(RES)
        no = await pg.evaluate("(() => { wGF.G.poss = 1; return wGF.potionWhy('gfresin', null); })()")
        check(no == 'Resin is for when you have the ball.', 'Resin only when you have the ball', no)
        await pg.evaluate(RES)
        bm = await pg.evaluate("""(() => { const G = wGF.G, ri = G.teams[0].off.QB; G.stam[0][ri] = 20;
          const msg = wGF.potion('gfsalve', ri), all = wGF.lineup().flatMap(t => t.players.filter(x => x.n === G.teams[0].roster[ri].n));
          return { msg, st: G.stam[0][ri], full: all.every(x => Object.keys(x.base).every(k => x.r[k] === Math.round(x.base[k]))), salve: G.salve[0], again: wGF.potionWhy('gfsalve', ri) }; })()""")
        check('Mending Balm' in bm['msg'] and bm['st'] == 35 and bm['full'], 'the Mending Balm: 15 stamina back, and full ratings though worn down', bm)
        await pg.evaluate(RES)
        adv = await pg.evaluate("""(() => { const G = wGF.G, ri = G.teams[0].off.RB; G.half = 2; G.stam[0][ri] = 25; return { a: wGF.advice({ gfsalve: 1 }), none: wGF.advice({}) }; })()""")
        check(adv['a'] and adv['a']['id'] == 'gfsalve' and adv['a']['why'] and adv['none'] is None, 'your sideline advises the Balm for a worn-down back late on, and nothing from an empty bag', adv)
        # the Elixir: the next play, that player is quicker
        await pg.evaluate(RES)
        hs = await pg.evaluate("""(() => { const G = wGF.G, s = 0, ri = G.teams[0][G.poss === 0 ? 'off' : 'def'][G.poss === 0 ? 'RB' : 'S']; window.__hri = ri; return { msg: wGF.potion('gfhaste', ri), haste: G.drive.haste }; })()""")
        check('Speed Elixir' in hs['msg'] and hs['haste'], 'the Speed Elixir: one player, for the rest of the drive', hs)
        await pg.evaluate("wGF.setMode('watch'); wGF.pause(false)")
        await pg.wait_for_function("wGF.phase === 'live' && !!wGF.play", timeout=30000)
        sm = await pg.evaluate("(() => { const L = wGF.play, G = wGF.G; return L.pl.filter(p => p.ri === __hri && (p.side === 0 ? G.poss : 1 - G.poss) === 0).map(p => p.sm); })()")
        hx = await pg.evaluate('wGF.haste')
        check(sm and all(abs(x - hx) < 1e-9 for x in sm), 'and on the next play they run faster', sm)
        # the Fog: the other coach doesn't see the call
        await pg.evaluate("wGF.pause(true)"); await pg.evaluate(RES)
        fg = await pg.evaluate("""(() => { const G = wGF.G, n0 = G.seen[0].length; const msg = wGF.potion('gffog', null); return { msg, fog: wGF.fog, n0 }; })()""")
        check('Fog Vial' in fg['msg'] and fg['fog'] == 0, 'the Fog Vial is out for the next call', fg)
        await pg.evaluate("wGF.setMode('watch'); wGF.pause(false)")
        await pg.wait_for_function("['post', 'kick', 'kickoff', 'half', 'over'].includes(wGF.phase)", timeout=30000)
        fg2 = await pg.evaluate("({ fog: wGF.fog, n: wGF.G.seen[0].length })")
        check(fg2['fog'] is None and fg2['n'] == fg['n0'], 'after the call the fog lifts, and the other coach never saw it', [fg, fg2])
        await pg.evaluate("wGF.pause(true)")

        # ---- the CPU's sideline ----
        cpu = await pg.evaluate("""(() => { %s
          const bag = { draught: 2, secondwind: 1, gfresin: 1, gfhaste: 1, gffog: 1, gfsalve: 1 }, out = [];
          for (const sk of [2, 1, 0]) { let used = 0, notes = [], over = false; const per = {};
            for (let i = 0; i < 6; i++) { const g = wGF.simGame({ teams: both(null), seed: 300 + i, skill: [1, sk], bags: [null, bag] });
              const mine = g.pots.filter(x => x.side === 1); used += mine.length; for (const x of mine) per[x.id] = (per[x.id] || 0) + 1;
              if (g.pots.some(x => x.side === 0)) over = true;
              for (const id in bag) if ((g.bags[1][id] || 0) !== bag[id] - mine.filter(x => x.id === id).length || g.bags[1][id] < 0) over = true;
              notes = notes.concat((wGF.G.drives || []).flatMap(d => d.plays).flatMap(e => e.notes || []).filter(n => n.k === 'pot' && n.side === 1).map(n => n.msg)); }
            out.push({ sk, used: used / 6, per, over, notes: notes.slice(0, 4), why: notes.length && notes.every(m => /\\(.+\\)\\.$/.test(m)) }); }
          return out; })()""" % TEAMS)
        check(all(c['used'] > 0 for c in cpu), 'the CPU sideline uses its bag at every skill', cpu)
        check(all(not c['over'] for c in cpu), 'never more than the bag holds, and never yours (a null bag)', cpu)
        check(all(c['why'] for c in cpu), 'every use is in the log, with its reason', [c['notes'] for c in cpu])

        # ---- in the Realm ----
        await pg.evaluate("wGF.setMode('watch'); WGF = null; wLeaveGridiron()")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("WG.items.gf_cleats = 1; WG.items.gffog = 1; WG.items.gfhaste = 2")
        pid = await pg.evaluate("(() => { const S = wSevenSync(), id = S.ids.find(k => typeof k === 'number'); return { id, msg: wGearPutOn(id, 'gf_cleats') }; })()")
        check(pid['msg'] == '', 'cleats go on one of the seven', pid)
        check(await pg.evaluate("wCampSeven().includes('data-sgear=\"gf_cleats\"')"), 'the Seven tab shows their gear')
        await pg.evaluate("wOpenGridCard()")
        card = await pg.evaluate("({ bags: document.querySelectorAll('#modalBox [data-gkbags]').length, mine: (document.querySelector('#modalBox [data-gkmine]') || {}).textContent || '' })")
        check(card['bags'] > 0 and 'Fog Vial' in card['mine'], 'the game card says what each club brings, and your bag', card)
        await pg.evaluate(CLOSE_ALL)
        sim = await pg.evaluate("""(() => { const before = JSON.stringify(wGridBagMine()); wStartGrid({ club: 'local', how: 'sim' }); return { bags: wGF.G.bags, opp: W_GRID_KIT.opp[1], same: JSON.stringify(wGridBagMine()) === before }; })()""")
        check(sim['bags'][0] is None and sum(sim['opp'].values()) >= sum(v for v in (sim['bags'][1] or {}).values()) and set((sim['bags'][1] or {}).keys()) == set(sim['opp'].keys()),
              'Simulate: their bag goes in, yours stays out', sim)
        check(sim['same'], 'and Simulate leaves your bag alone', sim)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("WG.gfg.met = {}; wStartGrid({ club: 'local', how: 'manage', tier: 3 })")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call'", timeout=30000)
        await pg.evaluate("wGF.pause(true)")
        live = await pg.evaluate("""(() => ({ bags: wGF.bags(), opp: W_GRID_KIT.opp[3], lineup: document.getElementById('wGridLineup').innerHTML.includes('data-ggear="gf_cleats"') || wGF.lineup().some(t => t.players.some(p => p.gid === 'gf_cleats')) }))()""")
        check(live['bags'][0] is None and set(live['bags'][1].keys()) == set(live['opp'].keys()), 'a game at tier 3 brings the tier-3 bag', live)
        check(live['lineup'], 'gear is worn into the game, and shows in the lineup', live)
        await pg.evaluate("wGridBar()")
        pan = await pg.evaluate("({ haste: !!document.querySelector('#wGridBench select[data-gpot=\"gfhaste\"]'), fog: !!document.querySelector('#wGridBench button[data-gpot=\"gffog\"]') })")
        check(pan['haste'] and pan['fog'], 'Your bench shows the new potions you have', pan)
        pf = await pg.evaluate("(() => { const msg = wGridPotion('gffog', null); return { msg, left: WG.items.gffog || 0, again: wGridPotion('gffog', null) }; })()")
        check(pf['msg'] == '' and pf['left'] == 0, 'a Fog Vial given from Your bench comes out of your bag', pf)
        check(pf['again'] == 'You have no Fog Vial.', 'and none left to give', pf)
        await pg.evaluate("wGridConcede()")
        await pg.wait_for_selector('#modalBox button', timeout=5000)
        await pg.evaluate("document.querySelector('#modalBox .btn, #modalBox button').click()")
        await pg.wait_for_function("!wGridLive()", timeout=10000)
        await pg.evaluate(CLOSE_ALL)

        # ---- the Cinder Cup's gear ----
        cup = await pg.evaluate("""(() => { WG.gcup = { week: 1, field: ['me'], round: 2, games: [[], [], [{ a: 'me', b: 'local', ra: 21, rb: 7, w: 'me' }]], done: true, champ: 'me' };
          const out = []; for (let i = 0; i < 6; i++) { const g = RUN.gold; wGcupWon(); out.push([W_GRID_KIT.cup.filter(id => (WG.items[id] || 0) > 0 || wRoster().some(p => p.gear && p.gear.grid === id)).length, RUN.gold - g]); } return out; })()""")
        check(cup[0][0] >= 1 and cup[-1][0] == 5, 'the Cinder Cup adds a piece of football gear you don\'t have', cup)
        # (the last win, with every piece, pays the Cup's gold and the extra instead)
        check(cup[-1][1] > cup[0][1], 'and with every piece, more gold instead', cup)

        # ---- How to play ----
        await pg.evaluate("renderHelp()")
        hp = await pg.evaluate("(document.getElementById('wHelpGridKit') || {}).textContent || ''")
        check(all(w in hp for w in ['Ash Cleats', 'Kicking Tee', 'Fumble Resin', 'Fog Vial', 'Mending Balm']), 'How to play explains football gear and potions', hp[:300])

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print(f'\n{len(FAILS)} failed' if FAILS else '\nall passed')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

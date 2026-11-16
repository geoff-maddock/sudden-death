# Realm rink: gear and potions (issue #83, phase 8), by #61's conventions.
# Gear reaches the engine with the player and never changes their own ratings: Sharp Skates get a skater going sooner,
# an Ash Stick makes their shots harder to stop, Soft Gloves make the puck harder to poke off them, Shin Pads make a
# blocked shot cost less stamina, a Bone Mask helps in goal only, and a Lucky Puck wins face-offs. Potions are given at
# a whistle or a break, one a whistle: a Stamina Draught, Antifreeze (slower tiring this period), Hot Cider (one
# player's shots this period, not the goalie's) and Tove's Liniment (a boxed player out). The CPU's bench brings a bag
# by tier and gives from it at its skill, with a reason on record; never from yours. Your bench advises.
# In the Realm: the pieces and potions are items, the Rimewatch store sells some and chests hold others; gear is put on
# from the Bag and shows on the Rink tab and the stats card; in a real game the Bag under the rink gives your potions
# (one comes out of your bag each time); Simulate, practice and scrimmages leave your bag alone; the game card says
# what their benches bring. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

SETUP = """window.__K = ['werewolf', 'harpy', 'kobold', 'dwarf', 'golem', 'spider', 'vampire', 'witch'];
window.__team = (name, gear) => ({ name, short: name[0], color: '#3a6ab8', light: '#fff', roster: __K.map((kind, i) => ({ kind, n: kind + i, num: i + 2, gear: gear && gear[i] })), spot: { C: 0, LW: 1, RW: 2, LD: 3, RD: 4, G: 5 } });
window.__game = (seed, o, gear) => { wHK.start(Object.assign({ seed, teams: [__team('Aces', gear), __team('Bears')], powers: false, calls: [{}, {}] }, o || {})); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step(); wHK.setFouls({ trip: 0, hook: 0, board: 0, rough: 0 }); return wHK.play; };
window.__away = (P, keep) => { P.pl.forEach((p, i) => { if (!keep.includes(i)) { p.x = 2.5; p.y = 8.5 - (i % 6) * .2; p.vx = p.vy = 0; } }); };
window.__put = (P, i, x, y) => { const p = P.pl[i]; p.x = x; p.y = y; p.vx = p.vy = 0; p.stun = 0; p.cd = 0; p.act = ''; return p; };
window.__whistle = () => { wHK.give(0); wHK.foul(6, 'hooking'); wHK.give(6); return wHK.phase; }; 0"""
CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

async def main():
    if not os.environ.get('SD_BUILT'): subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wHK !== 'undefined'")
        await pg.evaluate(SETUP)

        # ---------- gear in the engine ----------
        g = await pg.evaluate("""(() => { const gear = id => ({ id, name: W_GEAR[id].name, fx: JSON.parse(JSON.stringify(W_GEAR[id].fx)) }), gx = [gear('hk_skates'), gear('hk_stick'), gear('hk_gloves'), gear('hk_pads'), null, gear('hk_mask')];
          const read = () => { const P = __game(3, {}, gx); return { names: wHK.G.teams[0].roster.slice(0, 6).map(m => m.gear), gx: [0, 1, 2, 3, 4, 5].map(i => wHK.gxOf(i)), r: wHK.G.teams[0].roster[0].r, base: wHK.rate('werewolf') }; };
          const go = (i, gearOn) => { const P = __game(4, {}, gearOn ? gx : null); __away(P, [i]); const p = __put(P, i, 8, 0); for (let t = 0; t < 15; t++) wHK.skate(i, 38, 0); return p.x - 8; };
          const q = (who, gearOn) => { const P = __game(5, {}, gearOn ? gx : null), G = wHK.G, gx0 = wHK.goalX(who < 6 ? 0 : 1), gi = who < 6 ? 11 : 5, gk = P.pl[gi]; __away(P, [who, gi]); const d = wHK.dir(who < 6 ? 0 : 1), sp = wHK.goalSpot(who < 6 ? 1 : 0, gx0 - d * 6, 0); gk.x = sp[0]; gk.y = sp[1]; return wHK.shotOdds(who, 'wrist', gx0 - d * 6, 0).q; };
          const blk = gearOn => { const P = __game(6, {}, gearOn ? gx : null), G = wHK.G; __away(P, [3, 8, 5]); const s = __put(P, 8, 16, 0); __put(P, 3, 12, 0); wHK.give(8); P.puck.x = 16; P.puck.y = 0; const st0 = G.sta[0][P.pl[3].ri];
            P.puck.st = 'free'; P.puck.k = 'shot'; P.puck.shot = { i: 8, side: 1, kind: 'wrist', res: 'block', by: 3, blockD: 1, gx: wHK.goalX(1), dir: wHK.dir(1), touch: [] }; wHK.blockNow(); return st0 - G.sta[0][P.pl[3].ri]; };
          const pokes = gearOn => { const P = __game(7, {}, gearOn ? [null, null, gear('hk_gloves')] : null), G = wHK.G; let n = 0; P.pl[2].r.hnd = 5; P.pl[7].r.def = 9;
            for (let t = 0; t < 300; t++) { __away(P, [2, 7]); __put(P, 2, 20, 0); __put(P, 7, 20.9, 0); wHK.give(2); const n0 = P.evN; wHK.setMode('play'); wHK.G; P.me = null; wHK.setMode('watch');
              P.pl[7].cd = 0; P.pl[7].vx = 0; wHK.step(1); if (P.ev.slice(-Math.max(1, P.evN - n0)).some(e => e.k === 'poke')) n++; if (wHK.phase !== 'live') { let k = 0; while (wHK.phase !== 'live' && k++ < 400) wHK.step(); } }
            return n; };
          const fo = gearOn => { let w = 0; for (let s = 1; s <= 200; s++) { wHK.start({ seed: 900 + s, teams: [__team('Aces', gearOn ? [gear('hk_puck')] : null), __team('Bears')], powers: false }); let n = 0; while (wHK.phase !== 'live' && n++ < 200) wHK.step(); if (wHK.drew.win === 0) w++; } return w; };
          return { read: read(), fast: go(0, true), slow: go(0, false), stick: [q(1, true), q(1, false)], mask: [q(7, true), q(7, false)], pads: [blk(true), blk(false)], pokes: [pokes(true), pokes(false)], fo: [fo(true), fo(false)], R: wHK.kitRules }; })()""")
        rd = g['read']
        check(rd['names'] == ['Sharp Skates', 'Ash Stick', 'Soft Gloves', 'Shin Pads', '', 'Bone Mask'] and rd['gx'][0] == {'accel': 1.12} and rd['gx'][4] == {} and rd['gx'][5] == {'save': .012} and rd['r'] == rd['base'],
              'a piece of gear goes to the engine with its player, as a name and the effects the engine reads; their ratings are what they were', rd)
        check(g['fast'] > g['slow'] * 1.05 and abs(g['stick'][0] - g['stick'][1] - .012) < 1e-9 and abs(g['mask'][1] - g['mask'][0] - .012) < 1e-9, 'Sharp Skates get a skater going sooner; an Ash Stick makes their shots harder to stop; a Bone Mask in goal stops a little more', g)
        check(abs(g['pads'][1] - g['R']['block']) < 1e-9 and abs(g['pads'][0] - g['R']['block'] * .33) < 1e-9 and g['pokes'][0] < g['pokes'][1] and g['fo'][0] > g['fo'][1] + 8,
              'a blocked shot costs the blocker stamina, a third as much in Shin Pads; Soft Gloves keep the puck from more pokes; a Lucky Puck wins more face-offs', g)

        # ---------- potions in the engine ----------
        po = await pg.evaluate("""(() => { const P = __game(8, { mode: 'manage' }), G = wHK.G; const live = wHK.potion('draught', 0); for (const i of G.on[0].slice(0, 5)) G.sta[0][i] = .3;
          const ph = __whistle(), fresh = (G.sta[0][7] = 1, wHK.potionWhy('draught', 7)), r = wHK.potion('draught', G.on[0][0]), sta = G.sta[0][G.on[0][0]], again = wHK.potion('hkanti', -1), pots = wHK.pots, msg = wHK.msg;
          let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step(); n = 0; while (wHK.phase !== 'dead' && n++ < 400) { wHK.give(0); wHK.foul(7, 'hooking'); wHK.give(7); }
          const a = wHK.potion('hkanti', -1), anti = G.anti.slice(), a2 = (G.potUsed = null, wHK.potionWhy('hkanti', -1));
          return { live, ph, fresh, r, sta, again, pots, msg, a, anti, a2, p: G.p, names: Object.values(wHK.potions).map(x => x.n) }; })()""")
        check(po['names'] == ['Stamina Draught', 'Antifreeze', 'Hot Cider', "Tove's Liniment"] and 'Only at a whistle' in po['live'] and po['ph'] == 'dead' and po['fresh'] == "They're fresh." and po['r'] == '' and abs(po['sta'] - .7) < .07 and po['again'] == 'One potion a whistle.' and po['pots'][0]['id'] == 'draught' and 'Stamina Draught' in po['msg'],
              'a potion is given at a whistle, one a whistle; a Stamina Draught gives a tired skater two fifths back, and not a fresh one', po)
        ef = await pg.evaluate("""(() => { const drain = anti => { const P = __game(9), G = wHK.G; if (anti) G.anti[0] = G.p; const on = G.on[0].slice(0, 5), s0 = on.map(i => G.sta[0][i]); let t = 0, n = 0; while (t < 300 && n++ < 3000) { if (wHK.phase === 'live') t++; wHK.step(); }
            const still = on.filter(i => G.on[0].includes(i)); return still.reduce((a, i) => a + (1 - G.sta[0][i]), 0) / still.length; };
          const P = __game(10, { mode: 'manage' }), G = wHK.G, gx = wHK.goalX(0), g = P.pl[11]; __away(P, [1, 11]); const sp = wHK.goalSpot(1, gx - 6, 0); g.x = sp[0]; g.y = sp[1]; const q0 = wHK.shotOdds(1, 'wrist', gx - 6, 0).q;
          __whistle(); const gk = wHK.potion('hkcider', G.on[0][5]), r = wHK.potion('hkcider', G.on[0][1]), q1 = wHK.shotOdds(1, 'wrist', gx - 6, 0).q, other = wHK.shotOdds(2, 'wrist', gx - 6, 0).q; const was = G.cider[0].p; G.cider[0].p = 9; const next = wHK.shotOdds(1, 'wrist', gx - 6, 0).q; G.cider[0].p = was;
          let k = 0; while (wHK.phase !== 'live' && k++ < 400) wHK.step(); wHK.give(0); wHK.foul(7, 'hooking'); wHK.give(7); const twice = wHK.potionWhy('hkcider', G.on[0][2]);
          const P2 = __game(11, { mode: 'manage' }), G2 = wHK.G; __whistle(); const none = wHK.potionWhy('hkliniment', -1); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step(); wHK.give(6); wHK.foul(1, 'tripping'); wHK.give(1);
          const boxed = { box: G2.box.length, ph: wHK.phase }; const l = wHK.potion('hkliniment', -1), after = { box: G2.box.length, str: wHK.strength(), off: P2.pl[1].off, msg: wHK.msg };
          return { plain: drain(false), anti: drain(true), q0, q1, other, gk, r, twice, next, none, boxed, l, after }; })()""")
        check(ef['anti'] < ef['plain'] * .8 and ef['gk'] == 'Not for the goalie.' and ef['r'] == '' and abs(ef['q1'] - ef['q0'] - .04) < 1e-9 and abs(ef['other'] - ef['q0']) > -1 and 'cider this period' in ef['twice'] and abs(ef['next'] - ef['q0']) < 1e-9,
              'Antifreeze slows a side\'s tiring for the period; Hot Cider makes one player\'s shots harder to stop for the period, one player a period, never the goalie', ef)
        check(ef['none'] == 'Nobody of yours is in the box.' and ef['boxed'] == {'box': 2, 'ph': 'dead'} and ef['l'] == '' and ef['after']['box'] == 1 and ef['after']['str'] == [5, 4] and not ef['after']['off'] and 'out of the box' in ef['after']['msg'],
              'Tove\'s Liniment ends your earliest penalty: your player is out of the box (theirs stays in)', ef)
        cp = await pg.evaluate("""(() => { const run = (skill, mode) => { const P = __game(12, { skill: [1, skill], mode, bags: [mode === 'watch' ? { draught: 1 } : null, { draught: 2, hkanti: 1 }] }), G = wHK.G; for (const s of [0, 1]) for (const i of G.on[s].slice(0, 5)) G.sta[s][i] = .25;
            wHK.give(6); wHK.foul(0, 'hooking'); wHK.give(0); return { pots: wHK.pots.map(x => [x.side, x.id, x.why.length > 5]), bags: wHK.bags, used: G.potUsed }; };
          const knight = run(1, 'manage'), watch = run(1, 'watch'); let sq = 0; for (let i = 0; i < 30; i++) { const P = __game(40 + i, { skill: [1, 0], mode: 'manage', bags: [null, { draught: 1 }] }), G = wHK.G; for (const j of G.on[1].slice(0, 5)) G.sta[1][j] = .25; wHK.give(6); wHK.foul(0, 'hooking'); wHK.give(0); sq += wHK.pots.length; }
          const P = __game(13, { mode: 'manage' }), G = wHK.G; for (const i of G.on[0].slice(0, 5)) G.sta[0][i] = .9; G.sta[0][G.on[0][2]] = .2; __whistle(); const adv = wHK.advice({ draught: 1, hkanti: 1 }), none = wHK.advice({});
          const sim = wHK.simGame({ seed: 5, teams: [__team('Aces'), __team('Bears')], bags: [null, { draught: 2, hkanti: 1, hkcider: 1, hkliniment: 1 }], skill: [1, 2] });
          return { knight, watch, sq, adv, none, want: G.on[0][2], sim: sim.pots.map(x => [x.side, x.id]) }; })()""")
        check(cp['knight']['pots'] == [[1, 'draught', True]] and cp['knight']['bags'] == [None, {'draught': 1, 'hkanti': 1}] and cp['watch']['pots'] == [[0, 'draught', True], [1, 'draught', True]] and 0 < cp['sq'] < 30,
              'their bench gives from its bag at a whistle when it is worth it, with a reason on record; a Squire only now and then; your bag is never opened for you unless you only watch', cp)
        check(cp['adv'] and cp['adv']['id'] == 'draught' and cp['adv']['ri'] == cp['want'] and cp['none'] is None and len(cp['sim']) >= 1 and all(x[0] == 1 for x in cp['sim']), 'your bench says which potion suits the moment; in a simulated game their bench uses its bag and yours is left alone', cp)

        # ---------- the Realm ----------
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false"); await pg.evaluate(SETUP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['troll', 'harpy', 'spider', 'lich', 'witch', 'vampire', 'werewolf']; let i = 0; while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern')); })()")
        await pg.evaluate(CLOSE_ALL)
        it = await pg.evaluate("""(() => { const gear = Object.keys(W_GEAR).filter(id => W_GEAR[id].sport === 'rink'), pots = Object.keys(W_POTIONS).filter(id => wPotionSports(id).includes('rink'));
          return { gear, pots, items: gear.concat(pots).every(id => DB.items[id] && DB.items[id].name && DB.items[id].desc), shop: ['hk_skates', 'hk_stick', 'hk_puck', 'hkanti', 'hkcider', 'hkliniment'].map(id => DB.shops.rime[id] > 0), draught: DB.shops.rime.draught > 0,
            chests: [['chapel_chest', 'hk_gloves'], ['genevault_c6', 'hk_pads'], ['emberdeep_c3', 'hk_mask'], ['hatchery_c6', 'hkliniment'], ['deepseam_c3', 'hkcider']].map(([c, i]) => !!(DB.chests[c].items || {})[i]), sport: W_GEAR_CFG.sports.rink, use: DB.items.draught.use }; })()""")
        check(it['gear'] == ['hk_skates', 'hk_stick', 'hk_gloves', 'hk_pads', 'hk_mask', 'hk_puck'] and sorted(it['pots']) == ['draught', 'hkanti', 'hkcider', 'hkliniment'] and it['items'] and all(it['shop']) and it['draught'] and all(it['chests']) and it['sport'] == 'hockey' and 'hockey' in it['use'],
              'six pieces of hockey gear and its potions are items: the Rimewatch store sells three pieces and the potions, and chests hold the rest', it)
        w = await pg.evaluate("""(() => { const C = wSixSync(), k = C.six.LW, p = wPlayer(k), r0 = JSON.stringify(p.hk); wAddItem('hk_skates', 1); const r = wGearPutOn(k, 'hk_skates'); const e = wRinkPlayer(p);
          return { r, gear: p.gear, eng: e.gear && [e.gear.name, e.gear.fx], same: r0 === JSON.stringify(p.hk), left: WG.items.hk_skates || 0, id: k }; })()""")
        await pg.evaluate("wOpenCamp('rink')"); await pg.wait_for_selector('#wCampBody .wrinksix')
        row = await pg.evaluate(f"document.querySelector('.wrinksix [data-hid=\"{w['id']}\"]').textContent")
        check(w['r'] == '' and w['gear'].get('rink') == 'hk_skates' and w['eng'] == ['Sharp Skates', {'accel': 1.12}] and w['same'] and w['left'] == 0 and 'Wears the Sharp Skates' in row, 'gear is put on from your bag, goes to the engine with the player, leaves their ratings alone, and shows on the Rink tab', [w, row[:120]])
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { wAddItem('draught', 2); wAddItem('hkanti', 1); wAddItem('hkliniment', 1); })()")
        await pg.evaluate("wOpenRinkCard()"); await pg.wait_for_selector('#modalBox [data-hkclub]')
        cardt = await pg.evaluate("document.getElementById('modalBox').textContent")
        bag0 = await pg.evaluate("JSON.parse(JSON.stringify(WG.items))")
        await pg.click('#modalBox [data-hkclub="local"][data-hkhow="sim"]'); await pg.wait_for_selector('#wRinkOk')
        sm = await pg.evaluate("({ items: JSON.parse(JSON.stringify(WG.items)), tier: WG.hkg.games[0].tier })")
        check('What their benches bring' in cardt and 'tier 3, 2 Stamina Draught, 1 Antifreeze, 1 Hot Cider, 1 Tove\'s Liniment' in cardt and all(sm['items'].get(k) == bag0.get(k) for k in ['draught', 'hkanti', 'hkliniment']),
              'the game card says what their benches bring by tier; Simulate leaves your bag alone', [cardt[-260:], sm])
        await pg.click('#wRinkOk'); await pg.evaluate(CLOSE_ALL); await pg.evaluate("(() => { delete WG.hkg.met.local; })()")
        await pg.evaluate("wStartRink({ club: 'local', how: 'manage' })"); await pg.wait_for_function("UI.view === 'rink' && wHK.phase === 'live' && !!document.querySelector('#wRinkCalls .wcckit')")
        bg = await pg.evaluate("({ bags: wHK.bags, tier: WG.hkg.live.world.tier, want: W_RINK_KIT.opp[WG.hkg.live.world.tier], gear: wHK.G.teams[0].roster.map(m => m.gear).filter(Boolean) })")
        await pg.evaluate("(() => { wHK.pause(true); const G = wHK.G; for (const i of G.on[0].slice(0, 5)) G.sta[0][i] = .9; G.sta[0][G.on[0][1]] = .2; __whistle(); })()")
        await pg.wait_for_function("!!document.querySelector('#wRinkCalls [data-hkuse=\"draught\"]') && document.querySelector('#wRinkCalls .wcckit').textContent.includes('Your bench says')")
        kit = await pg.evaluate("""(() => { const k = document.querySelector('#wRinkCalls .wcckit'); return { label: k.querySelector('.wccl').textContent, btns: [...k.querySelectorAll('[data-hkuse]')].map(b => b.textContent), adv: k.textContent.includes('Your bench says: Stamina Draught'), lit: k.querySelector('[data-hkuse=\"draught\"]').classList.contains('on'), who: k.querySelector('[data-hkwho=\"draught\"]').value, want: String(wHK.G.on[0][1]) }; })()""")
        check(bg['bags'][0] is None and bg['bags'][1] == bg['want'] and bg['gear'] == ['Sharp Skates'] and kit['label'] == 'Bag' and kit['btns'] == ['Stamina Draught (2)', 'Antifreeze (1)', "Tove's Liniment (1)"] and kit['adv'] and kit['lit'] and kit['who'] == kit['want'],
              'in a real game their bench has its tier\'s bag and yours is your own; the Bag under the rink lists your hockey potions, with your bench\'s advice picked out', [bg, kit])
        await pg.click('#wRinkCalls [data-hkuse="draught"]')
        u1 = await pg.evaluate("({ left: WG.items.draught, sta: wHK.G.sta[0][wHK.G.on[0][1]], pots: wHK.pots.map(x => [x.side, x.id]), snap: WG.hkg.live.snap.G.pots.length, btn: document.querySelector('#wRinkCalls [data-hkuse=\"draught\"]').textContent })")
        await pg.click('#wRinkCalls [data-hkuse="hkanti"]')
        u2 = await pg.evaluate("({ left: WG.items.hkanti, msg: (document.querySelector('#wRinkCalls .wcckit .wcmsg') || {}).textContent || '' })")
        check(u1['left'] == 1 and abs(u1['sta'] - .6) < .07 and u1['pots'] == [[0, 'draught']] and u1['snap'] == 1 and u1['btn'] == 'Stamina Draught (1)' and u2['left'] == 1 and 'One potion a whistle' in u2['msg'],
              'a click gives the potion: it comes out of your bag, and the save point has it given; a second at the same whistle is refused', [u1, u2])
        await pg.evaluate("(() => { wHK.pause(false); })()"); await pg.click('#wRinkGive'); await pg.wait_for_selector('#cfYes'); await pg.click('#cfYes'); await pg.wait_for_function("UI.view === 'world' && !wRinkLive()"); await pg.evaluate(CLOSE_ALL)
        pr = await pg.evaluate("(() => { wRinkGame({ seed: 3, mode: 'manage' }); const r = { bags: wHK.bags, kit: !!document.querySelector('#wRinkCalls .wcckit'), pot: wRinkPotion('draught', 0), left: WG.items.draught }; wLeaveRink(); return r; })()")
        check(pr['bags'] == [None, None] and not pr['kit'] and 'real games' in pr['pot'] and pr['left'] == 1, 'a scrimmage brings no bags, and your potions stay in yours', pr)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("showPage('help')"); hp = await pg.evaluate("(document.getElementById('wHelpRinkKit') || {}).textContent || ''"); await pg.evaluate("showPage('play')")
        check('Hockey gear and potions.' in hp and 'Sharp Skates' in hp and 'Antifreeze' in hp and "Tove's Liniment" in hp, 'How to play explains hockey gear and potions', None)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

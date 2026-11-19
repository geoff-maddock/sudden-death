# Realm lanes: gear and potions (issue #100, phase 7), by #61's conventions. Six pieces of bowling gear (one a player):
# Saltmere's store's three, chests' three; gear reaches the engine through wLanesPlayer (ratings laid on, past the cap
# by W_GEAR_CFG.over at most; a Rosin Bag's arm, Slide Shoes' pressure, a Urethane Ball's release and a Lucky Pin's
# carry as the engine's own), never the player's own ratings. Potions: the Stamina Draught (arm back), Steady Hand (no
# pressure on the next ball), Grip Chalk (one bowler truer this frame), Moll's Lane Oil (the house pattern laid again on
# the lane you bowl next); one a side a frame; yours from the Bag row in a real match only, out of your bag when given,
# with your captain's advice; the CPU brings a bag by tier and gives at its skill, with a reason; your bag is never
# opened by the CPU, and Simulate leaves it alone. The match card says what each club brings; How to play explains it.
# Asserts; exits nonzero on failure.
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

HELP = r"""
window.__to = (ph, n) => { let i = 0; while (wBL.phase !== ph && i++ < (n || 6000)) wBL.tick(0.05); return wBL.phase === ph; };
window.__five = gx => ({ name: 'D', short: 'D', roster: [0, 1, 2, 3, 4].map(i => Object.assign({ n: 'd' + i, kind: 'dwarf', hand: 1 }, i === 0 && gx ? { gear: { name: 'g', fx: gx } } : {})) });
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wBL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['zombie', 'spider', 'gorgon', 'wraith']; let i = 0; while (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind: kinds[i++ % 4], lvl: 2 }, 'tavern')); wFiveAuto(); })()")

        # ---------- the gear and where it comes from ----------
        g = await pg.evaluate("""(() => { const ids = Object.keys(W_LANES_GEAR), shop = DB.shops.salt || {};
          return { n: ids.length, all: ids.every(id => W_GEAR[id] && W_GEAR[id].sport === 'lanes'), store: W_LANES_KIT.store.every(id => shop[id] > 0),
            chests: ['bl_urethane', 'bl_shoes', 'bl_luckypin'].every(id => Object.values(DB.chests).some(c => c.items && c.items[id])),
            pots: ['blsteady', 'blchalk', 'bloil'].every(id => shop[id] > 0 && DB.items[id] && W_POTIONS[id]), draught: wPotionSports('draught').includes('lanes') }; })()""")
        check(g == {'n': 6, 'all': True, 'store': True, 'chests': True, 'pots': True, 'draught': True}, 'six pieces of bowling gear (Saltmere\'s three, chests\' three), and the potions for sale; the Stamina Draught serves the Lanes too', g)
        ge = await pg.evaluate("""(() => { const id = WG.lanes.five.find(k => typeof k === 'number'), p = wPlayer(id), before = JSON.stringify(p.bl), rev0 = wLanesPlayer(p).r.rev;
          p.gear = Object.assign({}, p.gear, { lanes: 'bl_reactive' }); const t = wLanesPlayer(p), own = JSON.stringify(p.bl) === before;
          p.bl.rev = wBL.cap; const capped = wLanesPlayer(p).r.rev; p.bl = JSON.parse(before);
          p.gear.lanes = 'bl_rosin'; const rosin = wLanesPlayer(p); delete p.gear.lanes;
          return { rev: [rev0, t.r.rev], tag: t.gear && t.gear.name, own, capped, cap: wBL.cap, rosin: rosin.gear.fx.arm }; })()""")
        check(ge['rev'][1] == ge['rev'][0] + 1 and ge['tag'] == 'Reactive Ball' and ge['own'], 'gear reaches the engine through wLanesPlayer (+1 revs from the Reactive Ball), never the player\'s own ratings', ge)
        check(ge['capped'] <= ge['cap'] + 2 and ge['rosin'] == .8, 'past the cap by two at most; a Rosin Bag\'s arm goes to the engine as its own', ge)
        en = await pg.evaluate("""(() => { const out = {}, S = wBL.stanceRules;
          const cost = gx => { wBL.start({ seed: 4, teams: [__five(gx), __five()], order: [[0, 1, 2, 3, 4], [0, 1, 2, 3, 4]] }); wBL.turn(); return +(1 - wBL.arm[0][0]).toFixed(4); };
          out.arm = [cost(null), cost({ arm: .8 })];
          const win = (gx, last) => { wBL.start({ seed: 5, mode: 'play', teams: [__five(gx), __five()], order: [last ? [1, 2, 3, 4, 0] : [0, 1, 2, 3, 4], [0, 1, 2, 3, 4]] }); wBL.pause(true); if (last) for (let i = 0; i < 36; i++) wBL.roll(wBL.up(), 4 - (i % 2) * 4); __to('aim'); wBL.press(); return wBL.view.meter; };
          out.err = [win(null).win, win({ err: .9 }).win]; out.press = [win(null, true).shake, win({ press: .65 }, true).shake];
          return out; })()""")
        check(abs(en['arm'][1] - en['arm'][0] * .8) < 1e-3, 'a Rosin Bag: every ball costs a fifth less arm', en)
        check(en['err'][1] > en['err'][0] and en['press'][1] < en['press'][0], 'a Urethane Ball widens your mark; Slide Shoes ease a big moment', en)

        # ---------- potions in the engine ----------
        pe = await pg.evaluate("""(() => { const out = {}, G = wBL.start({ seed: 6, mode: 'play', teams: [__five(), __five()] }); wBL.pause(true); __to('aim');
          G.arm[0][2] = .3; out.draught = [wBL.potion('draught', 2), G.arm[0][2], wBL.potionWhy('blsteady', -1)];
          const lane = wBL.lane(0), path = []; for (let y = 0; y <= 720; y += 12) path.push([wBL.boardX(9), y]); for (let i = 0; i < 30; i++) G.oil[lane] = wBL.wear(G.oil[lane], path);
          G.potFrame[0] = ''; const worn = JSON.stringify(G.oil[lane]) !== JSON.stringify(G.oil0); out.oil = [worn, wBL.potion('bloil', -1), JSON.stringify(G.oil[lane]) === JSON.stringify(G.oil0)];
          G.potFrame[0] = ''; const w0 = (() => { wBL.press(); const w = wBL.view.meter.win; return w; })(); G.potFrame[0] = '';
          return out; })()""")
        check(pe['draught'][0] == '' and abs(pe['draught'][1] - .7) < 1e-6 and pe['draught'][2] == 'One potion a frame.', 'a Stamina Draught gives a bowler two fifths of their arm back; one potion a frame', pe)
        check(pe['oil'] == [True, '', True], 'Moll\'s Lane Oil lays the house pattern again on the lane you bowl next', pe['oil'])
        ch = await pg.evaluate("""(() => { const m = f => { const G = wBL.start({ seed: 7, mode: 'play', teams: [__five(), __five()] }); wBL.pause(true); for (let i = 0; i < 36; i++) wBL.roll(wBL.up(), 4 - (i % 2) * 4); __to('aim'); if (f) f(); wBL.press(); return wBL.view.meter; };
          const plain = m(), chalk = m(() => wBL.potion('blchalk', wBL.bowler(0))), steady = m(() => wBL.potion('blsteady', -1)); return { plain: [plain.win, plain.shake], chalk: chalk.win, steady: steady.shake }; })()""")
        check(ch['chalk'] > ch['plain'][0] and ch['plain'][1] > 0 and ch['steady'] == 0, 'Grip Chalk widens the bowler\'s mark; Steady Hand takes the pressure off the last frame', ch)
        cp = await pg.evaluate("""(() => { const G = wBL.start({ seed: 8, skill: [1, 1], bags: [null, { draught: 1, blsteady: 1 }], teams: [__five(), __five()] }); wBL.roll(0, 3); wBL.roll(0, 4);
          G.arm[1] = [.2, .9, .9, .9, .9]; const said = wBL.cpuPotion(1); wBL.roll(1, 3); wBL.roll(1, 4); const mine = (() => { G.arm[0] = [.1, .1, .1, .1, .1]; return wBL.cpuPotion(0); })();
          return { said, mine, bag: wBL.bags[1], pots: wBL.pots }; })()""")
        check('Stamina Draught' in cp['said'] and cp['mine'] == '' and cp['bag'].get('draught') is None and cp['pots'][0]['why'], 'the CPU gives from its bag at its skill, with a reason; a null bag (yours) is never opened', cp)
        ad = await pg.evaluate("""(() => { const G = wBL.start({ seed: 9, mode: 'play', teams: [__five(), __five()] }); wBL.pause(true); __to('aim'); G.arm[0][wBL.bowler(0)] = .3; return wBL.advice({ draught: 1 }); })()""")
        check(ad and ad['id'] == 'draught', 'your captain\'s advice: a draught for a tired arm', ad)

        # ---------- your Bag in a real match ----------
        await pg.evaluate("WG.items = WG.items || {}; wAddItem('blsteady', 1); wAddItem('draught', 2); WG.lng = null")
        rb = await pg.evaluate("""(() => { const r = wStartLanes({ club: 'local', how: 'play' }); wBL.pause(true); __to('aim'); wLanesRows();
          const row = $('wLanesRowBag'), btns = [...row.querySelectorAll('[data-nkuse]')].map(b => b.dataset.nkuse), theirs = wBL.bags[1], mine = wBL.bags[0];
          const G = wBL.G; G.arm[0][1] = .3; const sel = row.querySelector('[data-nkwho="draught"]'); if (sel) sel.value = '1';
          row.querySelector('[data-nkuse="draught"]').click(); const left = WG.items.draught, arm = G.arm[0][1], snap = WG.lng.live.snap && WG.lng.live.snap.G.arm[0][1];
          return { r, shown: !row.hidden, btns, theirs, mine, left, arm, snap }; })()""")
        check(rb['shown'] and 'blsteady' in rb['btns'] and 'draught' in rb['btns'] and rb['mine'] is None and rb['theirs'] is not None, 'in a real match: the Bag row with your potions, and the other side has a bag by tier (yours is your own)', rb)
        check(rb['left'] == 1 and abs(rb['arm'] - .7) < 1e-6 and abs((rb['snap'] or 0) - .7) < 1e-6, 'given from the Bag, the potion comes out of your bag, and the match as saved has it', rb)
        rd = await pg.evaluate("""(() => { const n = WG.items.blsteady || 0; wLeaveLanes(); WG.lng = null; wLanesGame({ seed: 9, mode: 'play' }); wBL.pause(true); __to('aim'); wLanesRows(); const row = $('wLanesRowBag');
          const msg = wLanesPotion('blsteady', -1); WG.lng = null; wStartLanes({ club: 'local', how: 'sim' }); document.getElementById('modal').hidden = true; return { hidden: row.hidden, msg, still: WG.items.blsteady === n }; })()""")
        check(rd['hidden'] and 'real matches' in rd['msg'] and rd['still'], 'an exhibition has no Bag row and no potions; Simulate leaves your bag alone', rd)
        await pg.evaluate("wRunAct('lncard')")
        await pg.wait_for_selector('#modalBox [data-lnclub]')
        card = await pg.evaluate("/What their bowlers bring/.test(document.getElementById('modalBox').textContent)")
        check(card, 'the match card says what each club brings', card)
        await pg.evaluate("document.getElementById('modal').hidden = true; showPage('help')")
        hp = await pg.evaluate("(() => { const t = ($('wHelpLanesKit') || {}).textContent || ''; return ['Reactive Ball', 'Slide Shoes', 'Steady Hand', 'Grip Chalk', 'Lane Oil', 'one potion a frame'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play explains bowling\'s gear and potions', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

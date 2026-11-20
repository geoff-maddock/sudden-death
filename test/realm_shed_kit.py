# Realm shed (issue #102, phase 7): curling gear and potions.
# The engine: a curler's gear reaches the engine as its effects (Stone Polish makes the release truer); Gripper Shoes
# on the sweepers spend less of their legs; the Stamina Draught gives the legs back; a Warming Draught takes the
# pressure off the skip's stone; Frost Salt makes the other rink's next stone drag (and is spent with it); Hennock's
# Pebble makes the worn ice fresh; one potion a side an end; a CPU with a bag gives at its skill, and a side without a
# bag (yours) never does. The Realm: six pieces of curling gear (three in Saltmere's store, three in chests) and three
# curling potions in the store; a piece worn reaches the game (its rating and its tag); in a real match their bag goes
# in by tier and yours stays your own; the Bag row gives a potion from your bag (it comes out); an exhibition takes no
# potions; the match card says what each club brings; How to play explains it. Asserts; exits nonzero on failure.
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
window.__team = (ks, gear) => ({ name: ks.join(''), short: 'T', roster: ks.map((k, i) => Object.assign({ n: k + i, kind: k }, gear ? { gear } : {})) });
window.__D = gear => __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'], gear);
window.__to = (ph, max) => { let n = 0; while (wCR.phase !== ph && n++ < (max || 20000)) wCR.tick(0.05); return wCR.phase === ph; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- gear ----------
        g = await pg.evaluate("""(() => { wCR.start({ seed: 1, hammer: 1, teams: [__D({ id: 'cr_polish', name: 'Stone Polish', fx: { err: .9 } }), __D()] });
          const a = wCR.errK(0, 'draw'), b = (() => { wCR.start({ seed: 1, hammer: 1, teams: [__D(), __D()] }); return wCR.errK(0, 'draw'); })();
          const legs = gear => { wCR.start({ seed: 2, hammer: 1, teams: [__D(gear), __D()] }); const G = wCR.G, aim = wCR.solveDraw(0, 0, 1, G.ice, G.cold); wCR.throwStone(0, { shot: 'draw', x: 0, y: 0, h: 1, aim }, aim, 1); return +(1 - G.legs[0]).toFixed(4); };
          return { gx: (() => { wCR.start({ seed: 1, teams: [__D({ id: 'cr_polish', name: 'Stone Polish', fx: { err: .9 } }), __D()] }); return wCR.G.teams[0].roster[0].gx; })(), truer: a.ang < b.ang && a.v < b.v, spent: [legs(null), legs({ id: 'cr_gripper', name: 'Gripper Shoes', fx: { legs: .8 } })] }; })()""")
        check(g['gx'] == {'err': 0.9} and g['truer'], 'a curler\'s gear reaches the engine as its effects: Stone Polish makes the release truer', g)
        check(g['spent'][0] > 0 and abs(g['spent'][1] - g['spent'][0] * .8) < 1e-3, 'Gripper Shoes on the sweepers spend a fifth less of their legs', g['spent'])

        # ---------- potions ----------
        pt = await pg.evaluate("""(() => { const out = {}; wCR.start({ seed: 3, hammer: 1, mode: 'play', teams: [__D(), __D()] }); wCR.pause(true); __to('aim'); const G = wCR.G;
          G.legs[0] = .3; out.draught = [wCR.potion('draught'), G.legs[0]]; out.again = wCR.potion('crwarm');
          G.end = 1; out.salt = [wCR.potion('crsalt'), G.salt[1]];
          G.end = 2; G.ice = G.ice.map(() => .97); out.pebble = [wCR.potion('crpebble'), Math.min(...G.ice)];
          G.end = G.ends - 1; G.k = 15; G.hammer = 0; const k0 = wCR.errK(0, 'draw'); out.warm = wCR.potion('crwarm'); const k1 = wCR.errK(0, 'draw'); out.calm = k1.ang < k0.ang;
          return out; })()""")
        check(pt['draught'][0] == '' and abs(pt['draught'][1] - .7) < 1e-6, 'the Stamina Draught gives the sweepers two fifths of their legs back', pt)
        check(pt['again'] != '', 'one potion a side an end', pt)
        check(pt['salt'] == ['', True] and pt['pebble'][0] == '' and pt['pebble'][1] == 1, 'Frost Salt salts the other rink\'s line; Hennock\'s Pebble makes the worn ice fresh', pt)
        check(pt['warm'] == '' and pt['calm'], 'a Warming Draught takes the pressure off the skip\'s stone', pt)
        sl = await pg.evaluate("""(() => { const stop = salt => { wCR.start({ seed: 4, hammer: 0, teams: [__D(), __D()] }); const G = wCR.G; if (salt) G.salt[1] = true;
            const aim = wCR.solveDraw(0, 0, 1, G.ice, G.cold), ev = wCR.throwStone(1, { shot: 'draw', x: 0, y: 0, h: 1, aim }, aim, null); return { y: ev.stop ? ev.stop.y : -999, left: G.salt[1] }; };
          return { plain: stop(false), salted: stop(true) }; })()""")
        check(sl['salted']['y'] < sl['plain']['y'] - 10 and sl['salted']['left'] is False, 'a stone on a salted line drags and comes up short, and the salt goes with it', sl)
        cpu = await pg.evaluate("""(() => { wCR.start({ seed: 5, ends: 6, skill: [2, 2], bags: [null, { draught: 2, crwarm: 1, crsalt: 2, crpebble: 1 }], teams: [__D(), __D()] }); let n = 0; while (!wCR.G.over && n++ < 300) wCR.turn();
          const P = wCR.G.pots; return { mine: P.filter(x => x.side === 0).length, theirs: P.filter(x => x.side === 1).length, why: P.every(x => x.why) }; })()""")
        check(cpu['theirs'] >= 2 and cpu['mine'] == 0 and cpu['why'], 'a CPU with a bag gives potions at its skill, with a reason; a side without one never does', cpu)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'gorgon']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); })()")
        rg = await pg.evaluate("""(() => { const ids = Object.keys(W_GEAR).filter(k => W_GEAR[k].sport === 'shed'), shop = DB.shops.salt || {};
          const chest = ['cr_charm', 'cr_polish', 'cr_stopwatch'].every(id => Object.values(DB.chests).some(c => c.items && c.items[id]));
          const p = wRoster()[0], r0 = wShedPlayer(p).r.swp; wAddItem('cr_broom', 1); const put = wGearPutOn(p.id, 'cr_broom'), t = wShedPlayer(p);
          return { n: ids.length, store: ['cr_broom', 'cr_slider', 'cr_gripper', 'crwarm', 'crsalt', 'crpebble'].every(id => shop[id] > 0), chest, put, up: t.r.swp - r0, tag: t.gear && t.gear.id }; })()""")
        check(rg['n'] == 6 and rg['store'] and rg['chest'], 'six pieces of curling gear and three potions: the store sells three of each, chests hold the rest', rg)
        check(rg['up'] == 1 and rg['tag'] == 'cr_broom', 'a piece worn reaches the game: its rating and its tag', rg)
        mt = await pg.evaluate("""(() => { wAddItem('crwarm', 2); wAddItem('draught', 1); wShg().met = {}; wStartShed({ club: 'local', how: 'play' }); wCR.pause(true); __to('aim');
          const G = wCR.G, bags = [G.bags[0], G.bags[1]]; wShedRows(); const row = $('wShedBagRow'), btn = row.querySelector('[data-crkuse="crwarm"]'), n0 = WG.items.crwarm || 0;
          btn.click(); return { mine: bags[0], theirs: bags[1], shown: !row.hidden, used: n0 - (WG.items.crwarm || 0), pots: G.pots.length, msg: W_SHED_KITMSG }; })()""")
        check(mt['mine'] is None and mt['theirs'] == {'draught': 1}, 'in a real match their bag goes in by tier, and yours stays your own', mt)
        check(mt['shown'] and mt['used'] == 1 and mt['pots'] == 1, 'the Bag row gives a potion from your bag, and it comes out', mt)
        await pg.evaluate("(() => { $('wShedGive').click(); const b = [...document.querySelectorAll('#modalBox button')].find(x => x.textContent.trim() === 'Concede'); if (b) b.click(); })()")
        ex = await pg.evaluate("(() => { wShedGame({ seed: 6, mode: 'play' }); wCR.pause(true); __to('aim'); const r = wShedPotion('crwarm'); wShedRows(); const h = $('wShedBagRow').hidden; wLeaveShed(); return { r, h }; })()")
        check(ex['r'] != '' and ex['h'], 'an exhibition takes no potions, and has no Bag row', ex)
        cd = await pg.evaluate("(() => { wOpenShedCard(); const t = $('modalBox').textContent; document.querySelector('#modalBox [data-close]').click(); return /What their curlers bring/.test(t); })()")
        check(cd, 'the match card says what each club brings', cd)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ help: !!$('wHelpShedKit'), how: ($('wShedHow') || {}).textContent.includes('Gear and potions.') })")
        check(hp == {'help': True, 'how': True}, 'How to play explains gear and potions', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

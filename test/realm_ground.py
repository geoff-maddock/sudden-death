# Realm epic 2, phase 1, the home ground: innkeepers sell it (GROUND topic and the inn's button), buying it in
# Mossgate makes the Mosswold home, the stands give Block and Strength in home matches only (not away, not the Crown),
# the pre-game card says so, the training pitch drills a few cards a week, the kitchen packs meals when you sleep there
# (free, and it becomes where you wake), the scouts bring better agents to that inn only, one ground per journey, and
# the save keeps it. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-ground-*.png (desk and phone).
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

HELP = r'''
// a plain match in a region: no trophies, no meal, a sport with no first-turn tricks
window.__kickIn = function (region, world) { RUN.relics = []; RUN.luck = 0; WG.meal = null; WG.charm = null;
  startMatch({ ids: ['cheer'], type: 'normal', tier: 1, sport: 'baseball', trait: null, lv: 0, ambush: false, card: false, world: Object.assign({ kind: 'wild', region }, world || {}) });
  const r = { block: B.P.block, str: sv(B.P, 'str'), home: !!B.wHome };
  B = null; RUN.pending = null; RUN.battle = null; showView('world');
  return r; };
window.__wspot = function (rg) { const m = MAPS.world; for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) { if (regionAt(x, y) !== rg) continue; const c = wTileAt(m, x, y), td = DB.tiles[c]; if (td && td.walk && !td.enter && td.enc) return [x, y]; } return null; };
window.__inTown = function (town) { const at = wInnSpot(town); wEnterMap(town, at[0], at[1]); WG.min = 12 * 60; wDrain(); };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"

async def boot(pg, clear=False):
    if clear:
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wStart === 'function' && typeof W_GROUND !== 'undefined'")
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG")

async def close_modal(pg):
    await pg.evaluate("document.getElementById('modal').hidden || (document.querySelector('#modalBox [data-close]') || document.getElementById('modal')).click()")
    await pg.wait_for_function("document.getElementById('modal').hidden")

async def desk_checks(pg):
    await pg.evaluate("__inTown('mossgate'); RUN.gold = 100")
    r = await pg.evaluate("wSay('moss_inn', 'ground')")
    check(r.get('act') == 'ground', 'innkeepers answer GROUND', r)
    check(await pg.evaluate("DB.chars.moss_inn.topics.job.t.includes('GROUND')"), 'the innkeeper points you at the GROUND')

    # ---------- the inn's button, and buying ----------
    await pg.evaluate("wOpenInn(12, 'Mother Bramble')"); await pg.wait_for_selector('#wInnGround')
    check(await pg.evaluate("document.getElementById('wInnGround').textContent") == 'The ground (for sale)', "the inn has a button for the ground that's for sale")
    await pg.click('#wInnGround'); await pg.wait_for_selector('#wBuyGround')
    check(await pg.evaluate("document.getElementById('wBuyGround').disabled"), 'you cannot buy it with 100 gold')
    await close_modal(pg)
    await pg.evaluate("RUN.gold = 2000; wOpenGround('mossgate')"); await pg.wait_for_selector('#wBuyGround:not([disabled])')
    await pg.screenshot(path='/tmp/realm-ground-sale-desk.png')
    await pg.click('#wBuyGround'); await pg.wait_for_selector('[data-wgup="stands"]')
    st = await pg.evaluate("({ g: WG.ground, gold: RUN.gold, home: wHomeRegion() })")
    check(st['g'] and st['g']['town'] == 'mossgate' and st['gold'] == 1850 and st['home'] == 'bloom', 'buying the Mossgate ground for 150 gold makes the Mosswold home', st)
    again = await pg.evaluate("wBuyGround('saltmere')")
    check(again.startswith('You already have') and await pg.evaluate("WG.ground.town === 'mossgate' && RUN.gold === 1850"), 'you can only own one ground', again)

    # ---------- the stands ----------
    await pg.click('[data-wgup="stands"]'); await pg.wait_for_selector('[data-wgup="stands"]')
    await pg.click('[data-wgup="stands"]'); await pg.wait_for_function("WG.ground.parts.stands === 2")
    st = await pg.evaluate("({ lv: WG.ground.parts.stands, gold: RUN.gold, more: !!document.querySelector('[data-wgup=\"stands\"]') })")
    check(st['lv'] == 2 and st['gold'] == 1550 and not st['more'], 'the stands build to level 2 for 100 then 200 gold, and stop there', st)
    await pg.screenshot(path='/tmp/realm-ground-built-desk.png')
    await close_modal(pg)
    home = await pg.evaluate("__kickIn('bloom')")
    away = await pg.evaluate("__kickIn('tide')")
    check(home['home'] and not away['home'] and home['block'] - away['block'] == 6 and home['str'] - away['str'] == 1, 'a home match starts with 6 Block and 1 Strength; an away match does not', {'home': home, 'away': away})
    crown = await pg.evaluate("__kickIn('bloom', { kind: 'cup', ref: { cup: 'crown', round: 0 } })")
    check(not crown['home'] and crown['block'] == away['block'], 'the Crown is neutral ground', crown)

    # ---------- the pre-game card ----------
    await pg.evaluate("wEnterMap('world', ...__wspot('bloom')); WG.min = 12 * 60; RUN.relics = []; startMatch({ type: 'normal', tier: 1, world: { kind: 'wild', region: 'bloom' } })")
    await pg.wait_for_selector('#modalBox .wground')
    check('home game' in await pg.evaluate("document.querySelector('#modalBox .wground').textContent"), 'the pre-game card says it is a home game')
    await pg.click('#wRun'); await pg.wait_for_function("document.getElementById('modal').hidden")

    # ---------- the training pitch ----------
    await pg.evaluate("__inTown('mossgate')")
    d = await pg.evaluate("""(() => { wUpgradeGround('pitch'); const c = RUN.deck.filter(practicable); const a = wDrillsLeft(), r1 = wDrill(c[0]), b = wDrillsLeft(), r2 = wDrill(c[1]);
      WG.dayAbs += 7; const n = wDrillsLeft(); return { a, r1, b, r2, n, sk: c[0].sk || 0, sk2: c[1].sk || 0 }; })()""")
    check(d['a'] == 1 and d['r1'] == '' and d['sk'] == 1 and d['b'] == 0 and d['r2'] and not d['sk2'] and d['n'] == 1, 'the pitch drills one card a week at level 1 (Practice ★), and more next week', d)

    # ---------- the kitchen and the free bed ----------
    k = await pg.evaluate("""(() => { wUpgradeGround('kitchen'); wUpgradeGround('kitchen'); WG.pantry = {}; WG.home = 'graftonbury'; RUN.hp = 5; const g0 = RUN.gold;
      const r = wSleepGround(); const once = Object.assign({}, WG.pantry); wSleepGround(); wSleepGround();
      return { r, once, thrice: WG.pantry, gold: RUN.gold - g0, hp: RUN.hp === RUN.maxhp, home: WG.home, min: WG.min }; })()""")
    check(k['r'] == '' and k['once'] == {'hash': 1, 'stew': 1} and k['gold'] == 0 and k['hp'] and k['home'] == 'mossgate', 'a free night at the ground heals, makes it home, and the level 2 kitchen packs hash and stew', k)
    check(k['thrice'] == {'hash': 2, 'stew': 2}, 'the kitchen stops at 2 of a dish', k['thrice'])
    check(await pg.evaluate("__inTown('saltmere'); wSleepGround()") == 'Your ground is not here.', 'you can only sleep free at your own ground')

    # ---------- the scouts ----------
    sc = await pg.evaluate("""(() => { wUpgradeGround('scouts'); wUpgradeGround('scouts'); WG.tavern = {};
      __inTown('mossgate'); const m = wTavern('mossgate').list.map(a => [a.lvl, a.fee]);
      __inTown('graftonbury'); const g = wTavern('graftonbury').list.map(a => a.lvl);
      return { m, g }; })()""")
    check(len(sc['m']) >= 3 and all(l >= 5 and fee == 30 + 30 * l for l, fee in sc['m']) and all(l <= 2 for l in sc['g']), 'the level 2 scouts bring 3 agents two levels up to the ground\'s inn only', sc)

    # ---------- elsewhere ----------
    await pg.evaluate("__inTown('saltmere'); wOpenInn(12, 'Hob')"); await pg.wait_for_selector('#wSleep')
    check(not await pg.evaluate("!!document.getElementById('wInnGround')"), "another town's inn has no ground button once you own one")
    await close_modal(pg)
    await pg.evaluate("wOpenGround('saltmere')"); await pg.wait_for_selector('#modalBox h3')
    check('in Mossgate' in await pg.evaluate("document.getElementById('modalBox').textContent"), 'elsewhere, the ground screen says where yours is')
    await close_modal(pg)

    # ---------- the save ----------
    await pg.evaluate("wSave()")
    await boot(pg)
    await pg.wait_for_selector('#bResume'); await pg.click('#bResume'); await pg.wait_for_function("UI.view === 'world' && !!WG")
    g = await pg.evaluate("WG.ground")
    check(g and g['town'] == 'mossgate' and g['parts'] == {'stands': 2, 'pitch': 1, 'kitchen': 2, 'scouts': 2}, 'the save keeps the ground and its upgrades', g)
    await pg.evaluate("renderHelp()")
    check(await pg.evaluate("!!document.getElementById('wHelpGround') && document.getElementById('wHelpGround').textContent.includes('neutral ground')"), 'How to play explains the ground')

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        for vp, tag in [({'width': 1280, 'height': 800}, 'desk'), ({'width': 390, 'height': 844}, 'phone')]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if tag == 'phone' else 1, is_mobile=tag == 'phone', has_touch=tag == 'phone')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, tag=tag: errs.append(tag + ': ' + str(e)))
            pg.on('console', lambda m, tag=tag: errs.append(tag + ' console: ' + m.text) if m.type == 'error' else None)
            await boot(pg, clear=True)
            await new_journey(pg)
            if tag == 'desk':
                await desk_checks(pg)
            else:
                await pg.evaluate("__inTown('cinderhold'); RUN.gold = 2000; wBuyGround('cinderhold'); wUpgradeGround('stands'); wUpgradeGround('pitch'); wOpenGround('cinderhold')")
                await pg.wait_for_selector('#wGroundSleep')
                await pg.screenshot(path='/tmp/realm-ground-phone.png')
                over = await pg.evaluate("document.getElementById('modalBox').scrollWidth > document.getElementById('modalBox').clientWidth + 2")
                check(not over, '[phone] the ground screen fits the width')
            sd = await pg.evaluate('window.__sdErrs || []')
            check(not sd, f'[{tag}] no __sdErrs', sd)
            await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    print('ok: realm ground passed' if not FAILS else f'FAILED: {len(FAILS)} checks')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

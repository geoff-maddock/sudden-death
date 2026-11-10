# Match gear and the match bag, phase 1 (issue #61): the plumbing. Asserts: a piece of gear is also an item; putting it
# on takes it from the bag and adds to the ratings the engines get (boxing's fighters, football's seven and the pairing),
# never to the player's own; a second piece in the same sport swaps the first back into the bag; one piece per sport,
# so boxing and football gear are worn together; a rating can go past the cap by the margin and no further; Take off;
# no changes during a match; a released player's gear back in the bag; gear kept in the save; the match bag by sport;
# the Bag's Put gear on, the stats card's Gear block and Take off by click; and How to play. Exits nonzero on failure.
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
    await pg.wait_for_function("typeof wGearAdd === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

GEAR = """(() => {
  wGearAdd('t_wraps', { sport: 'ring', name: 'Test Wraps', desc: 'Two more power.', price: 30, fx: { r: { pow: 2 } } });
  wGearAdd('t_guard', { sport: 'ring', name: 'Test Guard', desc: 'One more chin.', price: 30, fx: { r: { chin: 1 } } });
  wGearAdd('t_cleats', { sport: 'grid', name: 'Test Cleats', desc: 'One more speed.', price: 30, fx: { r: { spd: 1 } } });
  wGearAdd('t_big', { sport: 'ring', name: 'Test Anvil', desc: 'Five more power.', price: 30, fx: { r: { pow: 5 } } }); })()"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await new_journey(pg, clear=True)
        await pg.evaluate("(() => { while (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind: 'dwarf', lvl: 3 }, 'tavern')); })()")
        await pg.evaluate(GEAR)

        r = await pg.evaluate("({ it: DB.items.t_wraps, pots: Object.keys(W_POTIONS).map(k => [k, W_POTIONS[k].sport]) })")
        check(r['it'] and r['it']['gear'] == 'ring' and r['it']['name'] == 'Test Wraps' and 'boxing' in r['it']['use'], 'a piece of gear is also an item, marked with its sport', r['it'])
        check(['draught', 'grid'] in r['pots'] and ['secondwind', 'grid'] in r['pots'], "football's potions are the gridiron's in the match bag model", r['pots'])

        # ---- put on, in the engines' ratings only ----
        r = await pg.evaluate("""(() => { const p = wRoster()[0]; p.bx = null; wBxOf(p); p.bx.pow = 6; const base = wBxFighter(p).r.pow, own0 = p.bx.pow;
          wAddItem('t_wraps', 1); const why = wGearPutOn(p.id, 't_wraps'); const f = wBxFighter(p), side = wRingSide(new Set()).fighters.find(x => x.pid === p.id);
          return { why, base, pow: f.r.pow, own: p.bx.pow, own0, gear: f.gear, bag: WG.items.t_wraps || 0, side: side && side.r.pow, slot: p.gear }; })()""")
        check(r['why'] == '' and r['bag'] == 0 and r['slot'] == {'ring': 't_wraps'}, 'putting gear on takes it from the bag and fills the boxing slot', r)
        check(r['pow'] == r['base'] + 2 and r['side'] == r['pow'] and r['own'] == r['own0'], "gear adds to the fighter the engine gets (and the pairing's), not to the player's own ratings", r)
        check(r['gear'] and r['gear']['name'] == 'Test Wraps' and r['gear']['fx'] == {'r': {'pow': 2}}, 'the fighter carries the piece and its effects, as plain data', r['gear'])
        why = await pg.evaluate("wGearPutOn(wRoster()[1].id, 't_wraps')")
        check('no Test Wraps' in why, 'gear you do not have in the bag cannot be put on', why)

        # ---- a second piece in the same sport swaps; football gear is its own slot ----
        r = await pg.evaluate("""(() => { const p = wRoster()[0]; wAddItem('t_guard', 1); const why = wGearPutOn(p.id, 't_guard');
          wAddItem('t_cleats', 1); const why2 = wGearPutOn(p.id, 't_cleats'); wGfOf(p); const base = p.gf.spd;
          return { why, why2, slot: p.gear, wraps: WG.items.t_wraps || 0, guard: WG.items.t_guard || 0, spd: wSevenPlayer(p).r.spd, base, sgear: (wSevenPlayer(p).gear || {}).name,
            squad: (wGridSquad(wGridOpp('local', 1)).team.roster.find(x => x.n === p.n) || {}).gear }; })()""")
        check(r['why'] == '' and r['wraps'] == 1 and r['guard'] == 0 and r['slot']['ring'] == 't_guard', 'a second boxing piece swaps the first back into the bag', r)
        check(r['why2'] == '' and r['slot'] == {'ring': 't_guard', 'grid': 't_cleats'}, 'one piece per sport: boxing and football gear are worn together', r['slot'])
        check(r['spd'] == min(r['base'] + 1, 14) and r['sgear'] == 'Test Cleats' and r['squad'] and r['squad']['name'] == 'Test Cleats', "football gear adds to the seven's ratings, in the game's squad too", r)

        # ---- the cap ----
        r = await pg.evaluate("""(() => { const p = wRoster()[2]; wBxOf(p); p.bx.pow = W_BXG.cap; wAddItem('t_big', 1); wGearPutOn(p.id, 't_big'); return { pow: wBxFighter(p).r.pow, cap: W_BXG.cap, over: W_GEAR_CFG.over, own: p.bx.pow }; })()""")
        check(r['pow'] == r['cap'] + r['over'] and r['own'] == r['cap'], 'gear can take a rating past the cap by the margin, and no further', r)

        # ---- take off; none during a match ----
        r = await pg.evaluate("""(() => { const p = wRoster()[2]; WG.bxg = WG.bxg || wBxg(); const L0 = WG.bxg.live; WG.bxg.live = { world: { kind: 'bxcard' }, snap: null };
          const during = wGearTakeOff(p.id, 'ring'), during2 = (wAddItem('t_wraps', 0), wGearPutOn(p.id, 't_wraps')); WG.bxg.live = L0;
          const why = wGearTakeOff(p.id, 'ring'); return { during, during2, why, slot: p.gear, big: WG.items.t_big || 0, pow: wBxFighter(p).r.pow, cap: W_BXG.cap, again: wGearTakeOff(p.id, 'ring') }; })()""")
        check('Not while' in r['during'] and 'Not while' in r['during2'], 'no gear changes while a match in that sport is on', r)
        check(r['why'] == '' and not r['slot'].get('ring') and r['big'] == 1 and r['pow'] == r['cap'], 'Take off puts the piece back in the bag and the rating back', r)
        check('no boxing gear' in r['again'], 'taking off gear that is not there says so', r['again'])

        # ---- released: gear back in the bag ----
        r = await pg.evaluate("""(() => { const p = wRoster()[5]; wAddItem('t_wraps', 0); wGearPutOn(p.id, 't_wraps'); const before = WG.items.t_wraps || 0;
          wRelease(p.id); return { gone: !wPlayer(p.id), before, after: WG.items.t_wraps || 0 }; })()""")
        check(r['gone'] and r['before'] == 0 and r['after'] == 1, "a released player's gear goes back in the bag", r)

        # ---- kept in the save ----
        r = await pg.evaluate("(() => { wSave(); const S = wLoadSave(); const p = S.WG.roster.find(x => x.id === wRoster()[0].id); return p && p.gear; })()")
        check(r == {'ring': 't_guard', 'grid': 't_cleats'}, 'what each player wears is kept in the save', r)

        # ---- the match bag ----
        r = await pg.evaluate("""(() => { wAddItem('draught', 2); wPotionAdd('t_grip', { sport: 'grid' }); DB.items.t_grip = { name: 'Test Grip', desc: '' }; wAddItem('t_grip', 1);
          return { grid: wMatchBag('grid').map(x => [x.id, x.n]), ring: wMatchBag('ring').map(x => x.id) }; })()""")
        check(['draught', 2] in r['grid'] and ['t_grip', 1] in r['grid'] and 't_grip' not in r['ring'], "the match bag lists the potions you have for that sport, and not another sport's", r)

        # ---- on screen: the Bag's Put gear on, the stats card's Take off ----
        await pg.evaluate("wOpenCamp('bag')")
        await pg.wait_for_selector('#wCampBody [data-gearon="t_wraps"]')
        pid = await pg.evaluate("wRoster()[3].id")
        await pg.select_option('#wCampBody [data-gearwho="t_wraps"]', str(pid))
        await pg.click('#wCampBody [data-gearon="t_wraps"]')
        r = await pg.evaluate(f"({{ slot: wPlayer({pid}).gear, bag: WG.items.t_wraps || 0, row: !!document.querySelector('#wCampBody [data-gearon=\"t_wraps\"]'), log: WLOG.slice(-1)[0][0] }})")
        check(r['slot'] == {'ring': 't_wraps'} and r['bag'] == 0 and not r['row'] and 'puts on the Test Wraps' in r['log'], "the Bag's Put gear on puts it on the chosen player", r)
        await pg.evaluate("WCAMP.close && WCAMP.close()")
        await pg.evaluate(f"(() => {{ wOpenStats({pid}); }})()")
        await pg.wait_for_selector('#wCampBody .wgearc [data-gearoff="ring"]')
        txt = await pg.evaluate("document.querySelector('#wCampBody .wgearc').textContent")
        check('Test Wraps' in txt and 'Football:' in txt and 'nothing' in txt, "the stats card's Gear block shows what they wear in each sport", txt[:200])
        await pg.click('#wCampBody .wgearc [data-gearoff="ring"]')
        r = await pg.evaluate(f"({{ slot: wPlayer({pid}).gear, bag: WG.items.t_wraps || 0 }})")
        check(not r['slot'].get('ring') and r['bag'] == 1, "the stats card's Take off", r)
        await pg.evaluate("WCAMP.close && WCAMP.close()")

        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpGear'); return e ? e.textContent : ''; })()")
        check('one for boxing, one for football, one for basketball' in h and 'Bag' in h, 'How to play explains gear', h[:160])
        check(not errs, 'no page errors', errs[:4])
        print('errors:', errs[:4])
        await br.close()
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

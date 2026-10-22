# Realm smoke test (phase 1, walking the realm): build dist/realm.html, start a journey from the title, walk with the
# keyboard, enter a town from the world map, talk to somebody through the keyword panel, buy at a shop, sleep at an inn,
# save, reload and continue. Asserts every step and exits nonzero on the first failure.
# Screenshots: /tmp/realm-walk-*.png at 1280x800 and 390x844.
import asyncio, json, sys, subprocess
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)))
    if not ok: FAILS.append(what)
    return ok

# a free tile next to the party and the key that walks onto it
FREE_DIR = r'''() => { const m = wCurMap(); for (const [k, dx, dy] of [['ArrowRight',1,0],['ArrowLeft',-1,0],['ArrowDown',0,1],['ArrowUp',0,-1]]) {
  const c = wTileAt(m, WG.x + dx, WG.y + dy); if (c && DB.tiles[c].walk && !DB.tiles[c].enter && !wNpcAt(WG.x + dx, WG.y + dy)) return k; } return null; }'''
# stand next to somebody in this town whose JOB line has a keyword link, and return the key that bumps into them
NEXT_TO_NPC = r'''() => { const m = wCurMap();
  for (const n of m.npcs) { const ch = DB.chars[n.id], job = ch.topics.job; if (!job) continue;
    if (!(job.t.match(/\b[A-Z]{3,}\b/g) || []).some(w => wFindTopic(ch, w.toLowerCase()))) continue;
    for (const [k, dx, dy] of [['ArrowUp',0,1],['ArrowDown',0,-1],['ArrowLeft',1,0],['ArrowRight',-1,0]]) {
      const x = n.x + dx, y = n.y + dy, c = wTileAt(m, x, y);
      if (c && DB.tiles[c].walk && !DB.tiles[c].enter && !wNpcAt(x, y)) { WG.x = x; WG.y = y; WG.bump = null; wResetParty(); WUI.cam = null; return { key: k, id: n.id }; } } }
  return null; }'''

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL)
        await pg.evaluate('localStorage.clear()')
        await pg.reload()
        await pg.wait_for_timeout(1200)
        check(await pg.evaluate('(window.__sdErrs || []).length') == 0, 'loads without __sdErrs', await pg.evaluate('window.__sdErrs'))
        check(await pg.evaluate("document.querySelector('#bNew').textContent") == 'Walk the realm', 'title has a "Walk the realm" button')
        await pg.screenshot(path='/tmp/realm-walk-title.png')

        # start
        await pg.click('#bNew'); await pg.wait_for_timeout(300)
        check(await pg.evaluate("!!document.getElementById('wGo')"), 'Walk the realm opens the new-journey card (Hardcore choice)')
        await pg.click('#wGo'); await pg.wait_for_timeout(500)
        check(await pg.evaluate("UI.view") == 'world', "UI.view is 'world'")
        check(await pg.evaluate("!document.getElementById('v-world').hidden && document.getElementById('runbar').hidden"), 'world view shown, run bar hidden')
        check(await pg.evaluate("WG && WG.map") == 'graftonbury', 'a new journey starts in Graftonbury')
        await pg.screenshot(path='/tmp/realm-walk-town.png')

        # walk with the keyboard
        s0 = await pg.evaluate('({x: WG.x, y: WG.y, min: WG.min, day: WG.dayAbs, step: WG.step})')
        walked = 0
        for i in range(6):
            k = await pg.evaluate(FREE_DIR)
            if not k: break
            await pg.keyboard.press(k); await pg.wait_for_timeout(190); walked += 1
        s1 = await pg.evaluate('({x: WG.x, y: WG.y, min: WG.min, day: WG.dayAbs, step: WG.step})')
        check(walked >= 4 and s1['step'] - s0['step'] >= 4, 'walked several steps with the keys', {'s0': s0, 's1': s1})
        check((s1['x'], s1['y']) != (s0['x'], s0['y']) or s1['step'] > s0['step'], 'position changed', {'s0': s0, 's1': s1})
        check(s1['day'] * 1440 + s1['min'] > s0['day'] * 1440 + s0['min'], 'time advanced while walking', {'s0': s0, 's1': s1})

        # held key keeps walking at a steady rate
        st0 = await pg.evaluate('WG.step')
        k = await pg.evaluate(FREE_DIR)
        await pg.keyboard.down(k); await pg.wait_for_timeout(500); await pg.keyboard.up(k)
        st1 = await pg.evaluate('WG.step')
        check(1 <= st1 - st0 <= 5, 'holding a key repeats steps, throttled', {'steps': st1 - st0})

        # out to the world, next to Mossgate, and in
        await pg.evaluate("(() => { const L = DB.locs.find(l => l.id === 'mossgate'); wEnterMap('world', L.x, L.y + 1); wDrain(); })()")
        await pg.wait_for_timeout(400)
        check(await pg.evaluate("WG.map") == 'world', 'on the world map')
        await pg.screenshot(path='/tmp/realm-walk-world.png')
        m0 = await pg.evaluate('WG.min + WG.dayAbs * 1440')
        await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(400)
        check(await pg.evaluate("WG.map") == 'mossgate', 'stepping onto the town entrance enters Mossgate', await pg.evaluate('[WG.map, WG.x, WG.y]'))
        check(await pg.evaluate('WG.min + WG.dayAbs * 1440') - m0 == 15, 'a world step costs 15 minutes')
        check(await pg.evaluate("!!WG.flags.seen_mossgate"), 'arriving sets seen_mossgate')

        # walk out of the town's edge back to the world
        await pg.evaluate("(() => { const m = wCurMap(); let x = 0; for (let y = 0; y < m.h; y++) if (DB.tiles[m.t[y][0]].walk && !wNpcAt(0, y)) { WG.x = 0; WG.y = y; break; } })()")
        await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(250)
        check(await pg.evaluate("WG.map") == 'world', 'walking off a town edge leads back to the world', await pg.evaluate('[WG.map, WG.x, WG.y]'))
        await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(300)
        # (re)enter if the step landed on the entrance; otherwise jump back in
        if await pg.evaluate("WG.map") != 'mossgate':
            await pg.evaluate("(() => { const L = DB.locs.find(l => l.id === 'mossgate'); wEnterMap('world', L.x, L.y + 1); wDrain(); })()")
            await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(300)

        # bump into somebody: the talk panel opens with keyword links
        nb = await pg.evaluate(NEXT_TO_NPC)
        check(nb is not None, 'found somebody to talk to in Mossgate')
        await pg.wait_for_timeout(200)
        await pg.keyboard.press(nb['key']); await pg.wait_for_timeout(300)
        check(await pg.evaluate("!document.getElementById('wTalk').hidden"), 'bumping into ' + nb['id'] + ' opens the talk panel')
        greet = await pg.evaluate("document.querySelector('#wTalk .wsay').textContent")
        check(await pg.evaluate("document.querySelectorAll('#wTalk [data-kw=job]').length") >= 1, 'talk panel offers topics (Job)')
        await pg.click('#wTalk .wtchips [data-kw=job]'); await pg.wait_for_timeout(200)
        job = await pg.evaluate("document.querySelector('#wTalk .wsay').textContent")
        check(job != greet, 'asking about JOB gets a reply', {'greet': greet, 'job': job})
        nkw = await pg.evaluate("document.querySelectorAll('#wTalk .wsay .wkw').length")
        check(nkw >= 1, 'the reply has ALL-CAPS keyword links', {'job': job})
        await pg.screenshot(path='/tmp/realm-walk-talk.png')
        if nkw:
            kw = await pg.evaluate("document.querySelector('#wTalk .wsay .wkw').dataset.kw")
            await pg.click('#wTalk .wsay .wkw'); await pg.wait_for_timeout(200)
            r2 = await pg.evaluate("document.getElementById('wTalk').hidden ? '' : document.querySelector('#wTalk .wsay').textContent")
            check(bool(r2) and r2 != job, 'clicking the keyword ' + kw.upper() + ' gets a reply', {'reply': r2})
        # typing a keyword works too
        await pg.fill('#wAsk', 'name'); await pg.press('#wAsk', 'Enter'); await pg.wait_for_timeout(150)
        check((await pg.evaluate("document.querySelector('#wTalk .wsay').textContent")).startswith('I am '), 'typing NAME in the box gets a reply')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        check(await pg.evaluate("document.getElementById('wTalk').hidden"), 'Esc closes the talk panel')
        check(await pg.evaluate("!document.getElementById('pause') || document.getElementById('pause').hidden"), 'Esc in the world does not open the pause screen')

        # shop in Graftonbury: talk to the shopkeeper, BUY, buy something
        await pg.evaluate("(() => { const m = MAPS.graftonbury; wEnterMap('graftonbury', m.spawn[0], m.spawn[1]); wDrain(); wTalkTo('hq_shop'); wDrain(); })()")
        await pg.wait_for_timeout(200)
        await pg.click('#wTalk .wtchips [data-kw=job]'); await pg.wait_for_timeout(150)
        await pg.click('#wTalk .wsay .wkw[data-kw=buy]'); await pg.wait_for_timeout(250)
        check(await pg.evaluate("!document.getElementById('modal').hidden && !!document.getElementById('wShopBody')"), 'BUY opens the shop panel')
        g0 = await pg.evaluate('RUN.gold'); it0 = await pg.evaluate('WG.items.salve || 0')
        await pg.screenshot(path='/tmp/realm-walk-shop.png')
        await pg.click('#wShopBody [data-buy=salve]'); await pg.wait_for_timeout(150)
        g1 = await pg.evaluate('RUN.gold'); it1 = await pg.evaluate('WG.items.salve || 0')
        check(g1 < g0 and it1 == it0 + 1, 'buying a salve costs gold and adds one', {'gold': [g0, g1], 'salves': [it0, it1]})
        await pg.click('#wShopBody [data-sell=salve]'); await pg.wait_for_timeout(150)
        check(await pg.evaluate('RUN.gold') > g1, 'selling one back pays gold')
        key_ok = await pg.evaluate("(() => { const s = WG.step; document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft'})); document.dispatchEvent(new KeyboardEvent('keyup', {key: 'ArrowLeft'})); return WG.step === s; })()")
        check(key_ok, 'movement keys do nothing while a modal is open')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        check(await pg.evaluate("document.getElementById('modal').hidden"), 'Esc closes the shop')

        # inn: sleep and become home
        check(await pg.evaluate('WG.home') is None, 'no home before sleeping at an inn')
        await pg.evaluate("wCloseTalk(); wTalkTo('hq_inn'); wDrain()")
        await pg.wait_for_timeout(150)
        await pg.click('#wTalk .wtchips [data-kw=job]'); await pg.wait_for_timeout(150)
        await pg.click('#wTalk .wsay .wkw[data-kw=room]'); await pg.wait_for_timeout(250)
        check(await pg.evaluate("!!document.getElementById('wSleep')"), 'ROOM opens the inn panel')
        d0 = await pg.evaluate('WG.dayAbs'); g2 = await pg.evaluate('RUN.gold')
        await pg.screenshot(path='/tmp/realm-walk-inn.png')
        await pg.click('#wSleep'); await pg.wait_for_timeout(200)
        check(await pg.evaluate('WG.home') == 'graftonbury', 'sleeping at the inn sets WG.home', await pg.evaluate('WG.home'))
        check(await pg.evaluate('WG.dayAbs') == d0 + 1 and await pg.evaluate('WG.min') == 7 * 60 and await pg.evaluate('RUN.gold') < g2, 'the night costs gold and it is 7:00 the next day')

        # night and a dungeon, for the screenshots (and to draw them without errors)
        await pg.evaluate("(() => { WG.min = 22 * 60; const L = DB.locs.find(l => l.id === 'saltmere'); wEnterMap('world', L.x + 2, L.y + 2); wDrain(); })()")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path='/tmp/realm-walk-night.png')
        await pg.evaluate("(() => { WG.min = 12 * 60; const m = MAPS.hatchery; wEnterMap('hatchery', m.spawn[0], m.spawn[1]); wDrain(); })()")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path='/tmp/realm-walk-dungeon.png')
        k = await pg.evaluate(FREE_DIR)
        if k: await pg.keyboard.press(k); await pg.wait_for_timeout(200)
        # stairs up lead out
        await pg.evaluate("(() => { const m = wCurMap(); for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.t[y][x] === '<') { for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) { const c = wTileAt(m, x + dx, y + dy); if (c && DB.tiles[c].walk && !DB.tiles[c].enter) { WG.x = x + dx; WG.y = y + dy; WG._k = dx ? (dx > 0 ? 'ArrowLeft' : 'ArrowRight') : (dy > 0 ? 'ArrowUp' : 'ArrowDown'); return; } } } })()")
        await pg.keyboard.press(await pg.evaluate('WG._k')); await pg.wait_for_timeout(250)
        check(await pg.evaluate("WG.map") == 'world', 'the dungeon stairs lead back to the world')

        # click to walk: click a tile a few steps away and wait
        await pg.evaluate("(() => { const m = MAPS.graftonbury; wEnterMap('graftonbury', m.spawn[0], m.spawn[1]); wDrain(); })()")
        await pg.wait_for_timeout(500)
        tgt = await pg.evaluate(r'''(() => { const m = wCurMap(); for (let r = 3; r < 6; r++) for (const [dx, dy] of [[0,-r],[r,0],[-r,0]]) { const x = WG.x + dx, y = WG.y + dy, c = wTileAt(m, x, y); if (c && DB.tiles[c].walk && !DB.tiles[c].enter && !wNpcAt(x, y) && wPathStep(x, y)) {
            const rc = WUI.cv.getBoundingClientRect(); return { x, y, cx: rc.left + ((x + .5) - WUI.cam[0]) * WTILE * WUI.zoom, cy: rc.top + ((y + .5) - WUI.cam[1]) * WTILE * WUI.zoom }; } } return null; })()''')
        if check(tgt is not None, 'found a tile to click'):
            await pg.mouse.click(tgt['cx'], tgt['cy']); await pg.wait_for_timeout(1500)
            check(await pg.evaluate('[WG.x, WG.y]') == [tgt['x'], tgt['y']], 'clicking a tile walks there', {'at': await pg.evaluate('[WG.x, WG.y]'), 'want': [tgt['x'], tgt['y']]})

        # save, reload, continue
        await pg.evaluate("wSave()")
        here = await pg.evaluate('({map: WG.map, x: WG.x, y: WG.y, gold: RUN.gold, home: WG.home, day: WG.dayAbs})')
        await pg.reload(); await pg.wait_for_timeout(1000)
        check(await pg.evaluate("!document.getElementById('resumeRow').hidden && !!document.getElementById('bResume')"), 'title offers Continue when a save exists')
        await pg.click('#bResume'); await pg.wait_for_timeout(500)
        back = await pg.evaluate('({map: WG.map, x: WG.x, y: WG.y, gold: RUN.gold, home: WG.home, day: WG.dayAbs})')
        check(back == here and await pg.evaluate('UI.view') == 'world', 'Continue restores the journey', {'saved': here, 'loaded': back})
        await pg.wait_for_timeout(300)

        # phone
        ph = await b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
        ph.on('pageerror', lambda e: errs.append('phone:' + str(e)))
        saved = await pg.evaluate("localStorage.getItem(wSaveKey())")
        await ph.goto(REALM_URL)
        await ph.evaluate("s => localStorage.setItem(wSaveKey(), s)", saved)
        await ph.reload(); await ph.wait_for_timeout(1000)
        await ph.screenshot(path='/tmp/realm-walk-phone-title.png')
        await ph.click('#bResume'); await ph.wait_for_timeout(700)
        check(await ph.evaluate("getComputedStyle(document.getElementById('wPad')).display") != 'none', 'phone shows the on-screen pad')
        sw = await ph.evaluate('document.documentElement.scrollWidth')
        check(sw <= 390, 'no horizontal scroll at phone width', {'scrollWidth': sw})
        s0 = await ph.evaluate('WG.step')
        for d in ['0,1', '0,-1', '1,0', '-1,0']:
            await ph.dispatch_event(f'#wPad [data-dir="{d}"]', 'pointerdown'); await ph.dispatch_event(f'#wPad [data-dir="{d}"]', 'pointerup'); await ph.wait_for_timeout(200)
        check(await ph.evaluate('WG.step') > s0, 'the on-screen pad walks')
        await ph.screenshot(path='/tmp/realm-walk-phone.png')
        await ph.evaluate("(() => { const L = DB.locs.find(l => l.id === 'cinderhold'); wEnterMap('world', L.x, L.y + 2); wDrain(); })()")
        await ph.wait_for_timeout(500)
        await ph.screenshot(path='/tmp/realm-walk-phone-world.png')
        await ph.evaluate("wTalkTo('clerk'); wDrain()"); await ph.wait_for_timeout(300)
        await ph.screenshot(path='/tmp/realm-walk-phone-talk.png')

        sd = await pg.evaluate('window.__sdErrs || []') + await ph.evaluate('window.__sdErrs || []')
        check(not sd, 'no __sdErrs', sd)
        check(not errs, 'no page errors', errs)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm smoke passed')

asyncio.run(main())

# Realm home grounds at the sports grounds (issue #6, phase 6): ask a groundskeeper about a HOME ground (or an
# innkeeper about the GROUND, who lists the city's two) and buy that ground; its region is home, its upgrades and free
# beds work as before, its keeper welcomes you home, and you host your league fixture there every other round, with
# the home crowd (never at the Ballpark). An old save with a ground behind an inn continues with it moved to that
# city's first ground, upgrades and all. How to play says so; the audit is clean.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-home-*.png.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox .ghost, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; WG.wprompts = []; })()"""
ENTER = """(gid => { const L = DB.locs.find(l => l.id === gid); wEnterMap('world', L.x, L.y + 1); wTryMove(0, -1); wDrain(); return WG.map; })"""

async def new_journey(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wHomeGrd !== 'undefined'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await new_journey(pg)
        await pg.evaluate("RUN.gold = 2000")

        # ---------- the sale ----------
        t = await pg.evaluate("[wSay('gk_lists', 'job').text.includes('HOME'), wSay('gk_lists', 'home').act, wSay('moss_inn', 'ground').act]")
        check(t == [True, 'ground', 'ground'], 'groundskeepers sell a HOME ground; innkeepers still answer GROUND', t)
        await pg.evaluate("wOpenGround('mossgate')")
        inn = await pg.evaluate("[...document.querySelectorAll('#modalBox [data-wbuy]')].map(b => b.dataset.wbuy)")
        check(sorted(inn) == ['g_links', 'g_lists'], 'from the town, the sale lists the city\'s two grounds', inn)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate(ENTER + "('g_lists')")
        await pg.evaluate("(() => { const r = wSay('gk_lists', 'home'); wRunAct(r.act, 'gk_lists'); })()")
        one = await pg.evaluate("({ ids: [...document.querySelectorAll('#modalBox [data-wbuy]')].map(b => b.dataset.wbuy), h: document.querySelector('#modalBox h3').textContent })")
        check(one['ids'] == ['g_lists'] and 'Tilting Lists' in one['h'], 'at a ground, its keeper sells that ground', one)
        await pg.screenshot(path='/tmp/realm-home-sale.png')
        await pg.click('[data-wbuy="g_lists"]')
        await pg.wait_for_selector('[data-wgup="stands"]')
        st = await pg.evaluate("({ g: WG.ground, gold: RUN.gold, home: wHomeRegion(), h: document.querySelector('#modalBox h3').textContent, sleep: !!document.getElementById('wGroundSleep') })")
        check(st['g']['grd'] == 'g_lists' and st['g']['town'] == 'mossgate' and st['gold'] == 1850 and st['home'] == 'bloom', 'buying the Tilting Lists makes the Mosswold home, for 150 gold', st)
        check('Your ground: The Tilting Lists' in st['h'] and st['sleep'], 'the screen is your ground\'s, with its upgrades and beds', st)
        check(not await pg.evaluate("!!document.getElementById('wGroundBall')"), 'only the Ballpark hosts ball games')
        await pg.screenshot(path='/tmp/realm-home-ground.png')
        await pg.evaluate(CLOSE_ALL)
        again = await pg.evaluate("wBuyGround('g_links')")
        check(again.startswith('You already have'), 'you can only own one', again)
        sl = await pg.evaluate("(() => { RUN.hp = 5; const r = wSleepGround(); return { r, hp: RUN.hp === RUN.maxhp, home: WG.home, map: WG.map }; })()")
        check(sl['r'] == '' and sl['hp'] and sl['home'] == 'mossgate' and sl['map'] == 'g_lists', 'a free night at the ground itself', sl)
        check('Welcome home' in await pg.evaluate("wSay('gk_lists', '').text"), 'its keeper welcomes you home')

        # ---------- home fixtures ----------
        draws = await pg.evaluate("""(() => { const out = []; for (let i = 0; i < 6; i++) { const R = wDrawRound(), f = R.games.find(x => x.a === 'me' || x.b === 'me'); out.push([f.a === 'me', f.g]); } return out; })()""")
        home = [d for d in draws if d[0]]
        check(len(home) == 3 and all(d[1] == 'g_lists' for d in home) and all(draws[i][0] != draws[i + 1][0] for i in range(5)), 'you host your league fixture at your ground every other round', draws)
        await pg.evaluate("(() => { const L = wLeague(); L.next = null; L.hosted = false; wFixtures(); })()")
        mine = await pg.evaluate("wMyFixture()")
        check(mine['a'] == 'me' and mine['g'] == 'g_lists', 'this round, at home', mine)
        await pg.evaluate("(() => { const K = ['troll', 'harpy', 'golem', 'wraith', 'spider']; let i = 0; while (wRoster().length < 6 && i < 10) wRecruit({ kind: K[i++ % K.length], lvl: 3 }, 'tavern'); })()")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wOpenGrdCard('g_lists')")
        check(await pg.evaluate("!!document.querySelector('[data-gfix]') && !document.querySelector('[data-gfix]').disabled"), 'the home fixture is on your keeper\'s card')
        await pg.click('[data-gfix]'); await pg.wait_for_selector('#wPlay')
        pre = await pg.evaluate("document.getElementById('modalBox').textContent")
        check('A home game' in pre and 'League fixture' in pre, 'the pre-game card: a home league fixture', pre[:400])
        await pg.click('#wPlay'); await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        check(await pg.evaluate("B.wHome === 1 && B.sport === 'jousting'"), 'played at home: the home crowd, in jousting')
        await pg.evaluate("(() => { B.over = 'lose'; B.phase = 'done'; B.forfeit = 1; finishFight(); })()")
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)

        # ---------- the Ballpark never hosts a card-game fixture ----------
        bp = await pg.evaluate("""(() => { WG.ground.grd = 'g_ballpark'; WG.ground.town = 'graftonbury'; const out = [];
          for (let i = 0; i < 6; i++) { const R = wDrawRound(); out.push(R.games.some(f => f.a === 'me')); } return out; })()""")
        check(not any(bp), 'a Ballpark home hosts no card-game fixtures', bp)

        # ---------- an old save ----------
        await pg.evaluate("""(() => { WG.ground = { town: 'saltmere', parts: { stands: 2, pitch: 1, kitchen: 0, scouts: 1 }, drill: { week: -1, n: 0 } };
          localStorage.setItem(wSaveKey(), JSON.stringify({ v: REALM.v, WG, RUN })); })()""")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        mig = await pg.evaluate("({ g: WG.ground, log: WLOG.map(l => l[0]).join(' '), saved: JSON.parse(localStorage.getItem(wSaveKey())).WG.ground.grd })")
        check(mig['g']['grd'] == 'g_lanes' and mig['g']['parts'] == {'stands': 2, 'pitch': 1, 'kitchen': 0, 'scouts': 1} and mig['saved'] == 'g_lanes', 'an old save\'s ground behind the inn moves to the city\'s first ground, upgrades and all', mig['g'])
        check('moved your home ground' in mig['log'], 'and the log says so', mig['log'][-300:])

        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpGround'); return h ? h.textContent : ''; })()")
        check('sports grounds' in help_ and 'HOME' in help_, 'How to play: the home ground is a sports ground', help_)
        check(await pg.evaluate("wAudit().length === 0 && worldProblems().length === 0"), 'the audit is clean', await pg.evaluate("wAudit().concat(worldProblems())"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm home passed')

asyncio.run(main())

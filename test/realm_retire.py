# Realm: retire a card at your home ground (w39). Once a week at your own ground, a card leaves your deck for good,
# for W_RETIRE.energy energy of your home region's element. Not without a ground, not twice in a week, not without the
# energy, not below the smallest deck; the button sits on the ground's screen; the vendors' gold price is untouched;
# How to play explains both ways.
# Asserts; exits nonzero on failure. Screenshot: /tmp/realm-retire.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close]'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_RETIRE !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(CLOSE_ALL)

        check('home ground' in await pg.evaluate("wRetireProblems()"), 'no ground, no retiring', await pg.evaluate("wRetireProblems()"))
        # buy the Pond Rink: the Frostspire is home, so it costs rime energy
        await pg.evaluate("(() => { RUN.gold = 500; const r = wBuyGround('g_rink'); return r; })()")
        el = await pg.evaluate("wRetireEl()")
        check(el == 'rime', 'a ground at Rimewatch retires cards for rime energy', el)
        await pg.evaluate("WG.energy.rime = 2")
        check('3 Rime energy' in await pg.evaluate("wRetireProblems()"), 'with 2 rime energy: it says it takes 3', await pg.evaluate("wRetireProblems()"))
        await pg.evaluate("WG.energy.rime = 7")
        r = await pg.evaluate("""(() => { const n = RUN.deck.length, cost = RUN.removeCost, c = RUN.deck[0], r = wRetireCard(c);
          return { r, gone: !RUN.deck.includes(c), n: n - RUN.deck.length, rime: WG.energy.rime, cost: RUN.removeCost === cost, week: WG.ground.retired === wWeek() }; })()""")
        check(r == {'r': '', 'gone': True, 'n': 1, 'rime': 4, 'cost': True, 'week': True}, 'retiring a card: it leaves the deck, 3 rime energy is spent, and the vendors\' price does not move', r)
        again = await pg.evaluate("wRetireCard(RUN.deck[0])")
        check('this week' in again, 'once a week', again)
        nxt = await pg.evaluate("(() => { WG.dayAbs += 7; return wRetireProblems(); })()")
        check(nxt == '', 'next week it is open again', nxt)
        thin = await pg.evaluate("(() => { const keep = RUN.deck.slice(); RUN.deck = keep.slice(0, W_RETIRE.minDeck); const w = wRetireProblems(); RUN.deck = keep; return w; })()")
        check('Keep them' in thin, 'never below the smallest deck', thin)

        # ---------- the button on the ground's screen ----------
        await pg.evaluate("(() => { const L = DB.locs.find(l => l.id === 'g_rink'); wEnterMap('world', L.x, L.y + 1); wTryMove(0, -1); wDrain(); })()")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wOpenGround(WG.map)")
        btn = await pg.evaluate("(() => { const b = document.getElementById('wGroundRetire'); return b ? { text: b.textContent, disabled: b.disabled } : null; })()")
        check(btn and 'Retire a card' in btn['text'] and 'Rime' in btn['text'] and not btn['disabled'], 'the ground\'s screen has the Retire a card button', btn)
        await pg.screenshot(path='/tmp/realm-retire.png')
        await pg.click('#wGroundRetire')
        await pg.wait_for_function("!document.getElementById('modal').hidden && document.getElementById('modalBox').textContent.includes('Retire a card')")
        n0 = await pg.evaluate("[RUN.deck.length, WG.energy.rime]")
        await pg.click('#modalBox .cardgrid.pickable .card')
        n1 = await pg.evaluate("[RUN.deck.length, WG.energy.rime, WG.ground.retired === wWeek()]")
        check(n1 == [n0[0] - 1, n0[1] - 3, True], 'picking a card from the deck retires it', [n0, n1])
        await pg.evaluate(CLOSE_ALL)

        # ---------- the card vendors show how many you already have ----------
        cs = await pg.evaluate("(() => { wOpenCardShop('hq_shop'); const st = wShopStock('hq_shop'); return [st.cards.length, document.querySelectorAll('#modalBox .ware .indeck').length]; })()")
        check(cs[0] > 0 and cs[0] == cs[1], 'every card in a vendor\'s stock shows how many copies are in your deck', cs)
        await pg.evaluate(CLOSE_ALL)

        # ---------- How to play ----------
        h = await pg.evaluate("(() => { renderHelp(); const a = document.getElementById('wHelpRetire'), b = document.getElementById('wHelpTrade'); return [a ? a.textContent : '', b ? b.textContent : '']; })()")
        check('Once a week at your ground' in h[0] and 'Odd Lots' in h[1] and 'Hob Tarn' in h[1] and 'Brandt' in h[1], 'How to play explains retiring at your ground and trading at the three vendors', h)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

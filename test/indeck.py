# Cards on offer say how many copies are already in your deck: the reward choices, the pro shop, and an event's cards.
# Asserts; exits nonzero on failure. Screenshot: /tmp/indeck.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import GAME_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1300, 'height': 950})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_function("typeof newRun === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); newRun('ironmaw', [0, 3, 4]); RUN.path = [];")
        n = await pg.evaluate("RUN.deck.filter(c => c.id === 'check').length")
        row = await pg.evaluate("(() => { const d = document.createElement('div'); d.innerHTML = cardChoiceRow([{ id: 'check' }, { id: 'golf_driver' }], 'ci'); return [...d.querySelectorAll('.ware')].map(w => w.querySelector('.indeck').textContent); })()")
        check(n > 0 and row == [f'In your deck: {n}', 'Not in your deck'], 'the card choices say how many you have: a starter you hold, and a card you do not', [n, row])
        # the reward screen after a fight
        await pg.evaluate("(() => { RUN.panel = { t: 'reward', rw: { gold: 10, cards: [{ id: 'check' }, { id: 'timeout' }, { id: 'hold' }] } }; showView('panel'); renderPanel(); })()")
        await pg.wait_for_timeout(300)
        rw = await pg.evaluate("[...document.querySelectorAll('.indeck')].map(e => e.textContent)")
        held = await pg.evaluate("['check', 'timeout', 'hold'].map(id => RUN.deck.filter(c => c.id === id).length)")
        want = [f'In your deck: {k}' if k else 'Not in your deck' for k in held]
        check(rw[:3] == want, 'the reward screen shows the count under each card', [rw, want])
        await pg.screenshot(path='/tmp/indeck.png')
        # the pro shop
        sh = await pg.evaluate("(() => { RUN.gold = 999; RUN.panel = { t: 'shop', shop: makeShop() }; renderPanel(); return [RUN.panel.shop.cards.length, document.querySelectorAll('.shopgrid .ware .indeck').length]; })()")
        check(sh[0] > 0 and sh[0] == sh[1], 'every card in the pro shop shows the count', sh)
        # after taking one, the count goes up
        up = await pg.evaluate("(() => { const id = RUN.panel.shop.cards[0].id, k0 = RUN.deck.filter(c => c.id === id).length; document.querySelector('[data-buy-card=\"0\"]').click(); renderPanel(); const d = document.createElement('div'); d.innerHTML = cardChoiceRow([{ id }], 'x'); return [k0, d.querySelector('.indeck').textContent]; })()")
        check(up[1] == f'In your deck: {up[0] + 1}', 'buy one, and the count goes up', up)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

# Realm pets (issue #104, phase 1): the pet in the fight. With a pet at your side, the HUD has its panel (its name,
# its bond as stars, spooked and hungry when they are), a tooltip with what it does at its bond (the trait, each power
# and the bond it opens at, the trick), and the trick as a button; the keys line names T. T (or the button) uses the
# trick once: the button then says used and waits. What the pet does pops up over your side of the arena. A fight
# without a pet has no panel. On a phone the panel fits. Screenshots go to /tmp. Asserts; exits nonzero on failure.
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

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof PETS !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        h = await pg.evaluate("""(() => { RUN.pet = { kind: 'blinkpup', name: 'Zip', bond: 2 }; beginFight({ ids: ['skelss', 'thief'], type: 'normal', sport: 'baseball' });
          const box = document.getElementById('petBox'), badge = box && box.querySelector('.petbadge'), btn = document.getElementById('bPetTrick'), tip = badge ? badge.dataset.tip : '';
          return { view: UI.view, box: !!box, text: box ? box.textContent : '', btn: btn && !btn.disabled, tip: ['Zip', 'Bond 2', 'Footwork', 'blinks', 'third card', 'Blink Shuffle'].filter(w => !tip.includes(w)), keys: document.getElementById('ctlBox').textContent.includes('your pet') }; })()""")
        check(h['view'] == 'fight' and h['box'] and 'Zip' in h['text'] and '★★☆' in h['text'], 'with a pet at your side the HUD has its panel: its name and its bond as stars', h)
        check(h['tip'] == [] and h['btn'] and h['keys'], 'its tooltip says everything it does at its bond, the trick is a button, and the keys line names T', h)
        await pg.wait_for_function("!A.banner || A.t > A.banner.t0 + A.banner.life", timeout=8000)
        await pg.screenshot(path='/tmp/pets_battle.png')
        await pg.evaluate("UI.sel = 0; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }))")
        await pg.wait_for_function("B.pet.used === true")
        t = await pg.evaluate("""(async () => { const sel = UI.sel;
          const btn = document.getElementById('bPetTrick'); const used = B.pet.used, label = btn.textContent, dis = btn.disabled;
          document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })); return { used, label, dis, still: B.pet.used, sel }; })()""")
        check(t['used'] and '(used)' in t['label'] and t['dis'] and t['still'] and t['sel'] == -1, 'T uses the trick once (and lets go of a picked card): the button says used and waits', t)
        mk = await pg.evaluate("(() => { beginFight({ ids: ['skelss'], type: 'normal', sport: 'baseball' }); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true, bubbles: true })); const ctrl = B.pet.used; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })); return [ctrl, B.pet.used]; })()")
        check(mk == [False, True], 'Ctrl+T leaves the trick alone; a plain T then uses it', mk)
        pp = await pg.evaluate("""(() => { A.pops = []; B.P.block = 0; B.pet.t = {}; hurtPlayer(3, alive()[0]); consumeFx(); return A.pops.map(p => p.t).filter(t => /Zip/.test(t)); })()""")
        check(len(pp) >= 1 and 'blinks' in pp[0], 'what the pet does pops up over your side', pp)
        sp = await pg.evaluate("""(() => { B.pet.spooked = true; B.pet.bond = 1; RUN.pet.hungry = true; B.pet.hungry = true; renderFightHUD(); const t = document.getElementById('petBox').textContent; return { spooked: t.includes('!'), hungry: t.includes('hungry') }; })()""")
        check(sp == {'spooked': True, 'hungry': True}, 'the panel shows when it is spooked, and when it is hungry', sp)
        n = await pg.evaluate("""(() => { RUN.pet = null; beginFight({ ids: ['skelss'], type: 'normal', sport: 'baseball' }); return { box: !!document.getElementById('petBox'), keys: document.getElementById('ctlBox').textContent.includes('your pet') }; })()""")
        check(n == {'box': False, 'keys': False}, 'a fight without a pet has no panel', n)
        await pg.set_viewport_size({'width': 390, 'height': 844})
        await pg.evaluate("RUN.pet = { kind: 'jellycube', name: 'Wobbles', bond: 3 }; beginFight({ ids: ['skelss'], type: 'normal', sport: 'baseball' })")
        await pg.wait_for_function("!!document.getElementById('petBox')")
        ph = await pg.evaluate("""(async () => {
          const b = document.getElementById('petBox').getBoundingClientRect(); return { left: b.left >= 0, right: b.right <= innerWidth + 1, scroll: document.documentElement.scrollWidth <= innerWidth + 1 }; })()""")
        await pg.screenshot(path='/tmp/pets_battle_phone.png')
        check(ph == {'left': True, 'right': True, 'scroll': True}, 'on a phone the panel fits, and the page doesn\'t scroll sideways', ph)

        dr = await pg.evaluate("""(() => { beginFight({ ids: ['skelss'], type: 'normal', sport: 'baseball' }); B.energy = 99; renderFightHUD();
          const drag = (mid, end) => { const el = document.querySelector('#hand .card[data-i="1"]'), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
            el.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true, pointerId: 1 })); window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y - 150 }));
            const sel = UI.sel; if (mid) mid(); window.dispatchEvent(new PointerEvent(end || 'pointerup', { clientX: x, clientY: y - 300 })); return sel; };
          const n = () => B.cardsThisTurn, out = {};
          let n0 = n(); out.selDuring = drag(); out.plain = n() - n0;
          n0 = n(); drag(() => { B.discard.push(B.hand.shift()); renderHand(); }); out.handChanged = n() - n0;
          n0 = n(); drag(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); out.escape = n() - n0;
          n0 = n(); drag(() => doPetTrick()); out.trick = n() - n0;
          n0 = n(); drag(null, 'pointercancel'); out.cancel = [n() - n0, UI.sel];
          return out; })()""")
        check(dr['selDuring'] == 1 and dr['plain'] == 1, 'a plain drag of a card onto the arena plays it', dr)
        check(dr['handChanged'] == 0 and dr['escape'] == 0 and dr['trick'] == 0 and dr['cancel'] == [0, -1], 'a drag plays nothing on its drop if the hand changed, Escape let it go, or the pet\'s trick was used while it was held; a gesture the browser takes over lets go of it', dr)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

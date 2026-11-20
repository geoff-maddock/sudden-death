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
        await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/pets_battle.png')
        t = await pg.evaluate("""(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })); await new Promise(r => setTimeout(r, 50));
          const btn = document.getElementById('bPetTrick'); const used = B.pet.used, label = btn.textContent, dis = btn.disabled;
          document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })); return { used, label, dis, still: B.pet.used }; })()""")
        check(t['used'] and '(used)' in t['label'] and t['dis'] and t['still'], 'T uses the trick once: the button says used and waits', t)
        pp = await pg.evaluate("""(() => { A.pops = []; B.P.block = 0; B.pet.t = {}; hurtPlayer(3, alive()[0]); consumeFx(); return A.pops.map(p => p.t).filter(t => /Zip/.test(t)); })()""")
        check(len(pp) >= 1 and 'blinks' in pp[0], 'what the pet does pops up over your side', pp)
        sp = await pg.evaluate("""(() => { B.pet.spooked = true; B.pet.bond = 1; RUN.pet.hungry = true; B.pet.hungry = true; renderFightHUD(); const t = document.getElementById('petBox').textContent; return { spooked: t.includes('!'), hungry: t.includes('hungry') }; })()""")
        check(sp == {'spooked': True, 'hungry': True}, 'the panel shows when it is spooked, and when it is hungry', sp)
        n = await pg.evaluate("""(() => { RUN.pet = null; beginFight({ ids: ['skelss'], type: 'normal', sport: 'baseball' }); return { box: !!document.getElementById('petBox'), keys: document.getElementById('ctlBox').textContent.includes('your pet') }; })()""")
        check(n == {'box': False, 'keys': False}, 'a fight without a pet has no panel', n)
        await pg.set_viewport_size({'width': 390, 'height': 844})
        ph = await pg.evaluate("""(async () => { RUN.pet = { kind: 'jellycube', name: 'Wobbles', bond: 3 }; beginFight({ ids: ['skelss'], type: 'normal', sport: 'baseball' }); await new Promise(r => setTimeout(r, 200));
          const b = document.getElementById('petBox').getBoundingClientRect(); return { left: b.left >= 0, right: b.right <= innerWidth + 1, scroll: document.documentElement.scrollWidth <= innerWidth + 1 }; })()""")
        await pg.screenshot(path='/tmp/pets_battle_phone.png')
        check(ph == {'left': True, 'right': True, 'scroll': True}, 'on a phone the panel fits, and the page doesn\'t scroll sideways', ph)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

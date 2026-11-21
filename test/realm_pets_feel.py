# Realm pets (issue #104, phase 9): the feel of pets. Sounds: a pet joining chirps (not one had back, nor one hatched,
# which cracks instead), a bond level chimes, a treat crunches. Medals: kinds owned (a pet that joins by a full kennel's
# swap too), a full kennel, bond 3, hatching places, tricks thrown. Tips: the first pet, the first pet egg, the first
# hungry pet. The pet at your side is drawn on the map as on the field, and each Pets tab card has its portrait. The
# Quick start has a Pets tab with its three screenshots. Asserts; exits nonzero on failure.
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

ESC = "for (let k = 0; k < 6 && !document.getElementById('modal').hidden; k++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wPetSound === 'function'")
        await pg.evaluate("SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        # (sounds are counted, not played; tips are noted, not shown)
        await pg.evaluate("""SET.sfx = true; window.__snd = []; const s0 = wPetSound; wPetSound = function (k) { __snd.push(k); };
          window.__tips = []; const t0 = tip; tip = function (id) { __tips.push(id); }; 0""")

        s = await pg.evaluate("""(async () => { const out = {}; __snd.length = 0;
          const q = wPetAdd('hootling', 'keeper:moss'); out.join = __snd.slice(); __snd.length = 0;
          wPetLetGo(q.id); wPetReclaim(WG.petAway.findIndex(a => a.kind === 'hootling')); out.back = __snd.slice(); __snd.length = 0;
          WG.petEggs = { aether: { kind: 'pseudodragon', due: WG.dayAbs } }; wPeggHatch('aether'); out.hatch = __snd.slice(); __snd.length = 0; """ + ESC + """
          const h = wPets().owned.find(x => x.kind === 'hootling'); h.xp = W_PBOND.at[2] - 1; fire('fightWon'); out.bond = __snd.slice(); __snd.length = 0;
          wAddItem('mossberry', 1); WG.dayAbs++; wPetTreat(h.id, 'mossberry'); out.treat = __snd.slice(); return out; })()""")
        check(s['join'] == ['join'] and s['back'] == [] and s['hatch'] == ['crack'], 'a pet joining chirps; one had back doesn\'t, and one hatched cracks instead', s)
        check('bond' in s['bond'] and s['treat'] == ['treat'], 'a bond level chimes; a treat crunches', s)

        m = await pg.evaluate("""(async () => { const st = () => JSON.parse(JSON.stringify({ kinds: ACHS.sets.realmPetKinds || [], hatch: ACHS.sets.realmHatchPlaces || [], full: ACHS.stats.realmKennelFull || 0, b3: ACHS.stats.realmPetBond3 || 0, tr: ACHS.stats.realmPetTricks || 0 }));
          const out = { start: st() };
          for (const k of ['blinkpup', 'sprite', 'bogfrog', 'chestnut']) wPetAdd(k, 'egg:x'); out.full = st();
          // (a seventh, of a new kind, joins by the full kennel's swap)
          // (an egg hatched into the full kennel, swapped in: no welcome chirp, as it had its crack)
          WG.petEggs = { bloom: { kind: 'sprite', due: WG.dayAbs } }; __snd.length = 0; wPeggHatch('bloom'); """ + ESC + """
          { const t2 = Date.now(); await new Promise(r => { const f = () => (!document.getElementById('modal').hidden && document.querySelector('#modalBox [data-petgo]')) || Date.now() - t2 > 3000 ? r() : setTimeout(f, 20); f(); }); }
          const gone = wPets().owned.find(x => x.kind === 'chestnut'), btn = gone && !document.getElementById('modal').hidden && document.querySelector('#modalBox [data-petgo="' + gone.id + '"]');
          if (!btn) return { stuck: { where: 'the question for the hatched pet', modal: document.getElementById('modal').hidden, ask: W_PET_ASK.slice() } }; btn.click();
          out.quietSwap = { snd: __snd.slice(), joined: wPets().owned.filter(x => x.kind === 'sprite').length, mark: wPets().owned.some(x => 'quiet' in x) };
          wPetAdd('imp', 'egg:y'); const t0 = Date.now(); await new Promise(r => { const f = () => (!document.getElementById('modal').hidden && document.querySelector('#modalBox [data-petgo]')) || Date.now() - t0 > 3000 ? r() : setTimeout(f, 20); f(); }); if (document.getElementById('modal').hidden || !document.querySelector('#modalBox [data-petgo]')) return { stuck: { modal: document.getElementById('modal').hidden, text: document.getElementById('modalBox').textContent.slice(0, 120), ask: W_PET_ASK.slice(), active: wActive(), talk: !!WUI.talk, view: UI.view, n: wPets().owned.length } };
          document.querySelector('#modalBox [data-petgo="' + wPets().owned.find(x => x.kind === 'bogfrog').id + '"]').click(); out.swap = st().kinds.includes('imp');
          const h = wPets().owned.find(x => x.kind === 'hootling'); h.bond = 2; h.xp = W_PBOND.at[3] - 1; h.hungry = false; wPetSide(h.id); fire('fightWon'); out.b3 = st().b3;
          RUN.pet = { kind: 'hootling', name: 'H', bond: 3 }; beginFight({ ids: ['skelss'], type: 'normal', sport: 'baseball' }); petTrick(0); out.tr = st().tr; B = null; showView('world');
          out.ach = ['w_petkinds', 'w_kennel', 'w_bond3', 'w_hatch', 'w_tricks'].filter(id => !ACH.some(a => a.id === id));
          return out; })()""")
        if not check('stuck' not in m, 'the full kennel\'s question opened', m): m = {'full': {'full': 0, 'kinds': [], 'hatch': []}, 'swap': False, 'b3': 0, 'tr': 0, 'ach': ['?']}
        check(m['full']['full'] == 1 and 'pseudodragon' in m['full']['kinds'] and m['full']['hatch'] == ['aether'], 'medals: kinds owned, a full kennel, hatching places used', m)
        check(m.get('quietSwap', {}).get('snd') == ['crack'] and m['quietSwap']['joined'] == 2 and not m['quietSwap']['mark'], 'an egg hatched into a full kennel and swapped in cracks, with no welcome chirp, and keeps no mark', m.get('quietSwap'))
        check(m['swap'] and m['b3'] == 1 and m['tr'] == 1 and m['ach'] == [], 'a pet joining by a full kennel\'s swap counts its kind; bond 3 and a trick thrown count; all five medals are in the book', m)

        t = await pg.evaluate("""(async () => { __tips.length = 0; UI.view = 'world'; SET.tips = true; wAddItem(wPeggItem('imp'), 1); const t0 = Date.now(); await new Promise(r => { const f = () => __tips.includes('w_petegg') || Date.now() - t0 > 5000 ? r() : setTimeout(f, 50); f(); });
          const q = wPets().owned[0]; q.hungry = false; RUN.gold = 0; WG.petWeek = wWeek() - 1; wNewDay(); const t1 = Date.now(); await new Promise(r => { const f = () => __tips.includes('w_pethungry') || Date.now() - t1 > 5000 ? r() : setTimeout(f, 50); f(); });
          return { tips: [...new Set(__tips)].filter(id => id.startsWith('w_pet')), defined: ['w_pet', 'w_petegg', 'w_pethungry'].filter(k => !TIPS[k]) }; })()""")
        check(set(['w_pet', 'w_petegg', 'w_pethungry']) <= set(t['tips']) and t['defined'] == [], 'tips: the first pet, the first pet egg, the first hungry pet', t)

        mp = await pg.evaluate("""(() => { const seen = []; const d0 = drawPetFig; drawPetFig = function (c, kind) { seen.push(kind); }; const acts = []; for (const f of W_ACTORS) f(acts, performance.now(), 0);
          const c = document.createElement('canvas').getContext('2d'); for (const a of acts) if (a.draw) a.draw(c, 10, 10, 0); drawPetFig = d0; return { side: wPetSideOf().kind, drawn: seen }; })()""")
        check(mp['drawn'] == [mp['side']], 'the pet at your side is drawn on the map as on the field', mp)
        tab = await pg.evaluate("""(async () => { wOpenCamp('pets'); const t0 = Date.now(); await new Promise(r => { const f = () => document.querySelector('#wCampBody .wpetpic') || Date.now() - t0 > 3000 ? r() : setTimeout(f, 20); f(); }); if (!document.querySelector('#wCampBody .wpetpic')) return { stuck: true };
          const cvs = [...document.querySelectorAll('#wCampBody .wpetpic')], inked = cvs.filter(cv => { const d = cv.getContext('2d').getImageData(0, 0, 64, 64).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }).length;
          const card = document.querySelector('#wCampBody .wpetc .wpi').getBoundingClientRect().width; """ + ESC + """ return { cards: cvs.length, inked, wide: card > 300 }; })()""")
        if not check('stuck' not in tab, 'the Pets tab opened', tab): tab = {'cards': 0, 'inked': -1, 'wide': False}
        check(tab['cards'] > 0 and tab['inked'] == tab['cards'] and tab['wide'], 'each Pets tab card has its portrait, and its words have the room they need', tab)
        await pg.evaluate("showPage('help')")
        qs = await pg.evaluate("""(() => { const p = document.querySelector('#wQuick [data-wqp="pets"]'); return { tab: !!document.querySelector('#wQuick [data-wq="pets"]'), imgs: p ? p.querySelectorAll('img.wqimg').length : 0, missing: ['pets-tab', 'pets-field', 'pets-hatch'].filter(k => !W_QUICK_IMG[k]) }; })()""")
        check(qs == {'tab': True, 'imgs': 3, 'missing': []}, 'the Quick start has a Pets tab with its three screenshots', qs)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

# Realm superstars, phase 1 (issue #24): the plumbing. Six superstars, each unlocked by a feat and kept on the profile
# across journeys: the Cinder Cup (Phoenix), the Rimewatch cup (Kraken), three legends over any journeys (Behemoth), the
# Road to Nowhere (Djinn), all five rare eggs hatched over any journeys (Hydra), the Crown (Frost Wyrm, also from the
# Hall of Legends). Unlocks survive a reload and a new journey; nothing is stored in LAB. The Team screen's Stars tab
# shows silhouettes and feats until unlocked, then names and powers, with New once. A medal; How to play; a phone.
# Asserts; exits nonzero. Screenshots: /tmp/realm-stars-*.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox .wcardpick button, #modalBox button'); if (!b) break; b.click(); } })()"""
UN = "Object.keys(wStarsAll().un).sort()"

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wStarsAll === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await new_journey(pg)
        await pg.evaluate("window.__ach = []; const a = achAdd; window.achAdd = function (k, n) { __ach.push([k, n]); return a.apply(this, arguments); }; 0")

        # ---------- the list, and the locked tab ----------
        d = await pg.evaluate("({ n: W_STARS.length, ids: new Set(W_STARS.map(s => s.id)).size, sil: W_STARS.every(s => W_STAR_SIL[s.id] && W_STAR_COL[s.el] && s.feat && s.pow), un: " + UN + " })")
        check(d == {'n': 6, 'ids': 6, 'sil': True, 'un': []}, 'six superstars, each with a silhouette, a feat and a power; none unlocked on a new profile', d)
        await pg.evaluate("wOpenCamp('stars')"); await pg.wait_for_selector('#modalBox .wstars')
        t = await pg.evaluate("""(() => { const rows = [...document.querySelectorAll('#modalBox .wstar')];
          return { tab: !!document.querySelector('#modalBox [data-ctab="stars"][aria-selected="true"]'), rows: rows.length, locked: rows.every(r => !r.classList.contains('won') && r.textContent.includes('???') && r.textContent.includes('To unlock')),
            cinder: rows[0].textContent.includes('Cinder Cup'), prog: document.querySelector('#modalBox [data-star="behemoth"]').textContent.includes('0 of 3'), named: rows.some(r => /Phoenix|Kraken/.test(r.textContent)) }; })()""")
        check(t['tab'] and t['rows'] == 6 and t['locked'] and t['cinder'] and t['prog'] and not t['named'], 'the Stars tab: six silhouettes, each with its feat (and progress), no names yet', t)
        await pg.screenshot(path='/tmp/realm-stars-locked.png')
        await pg.evaluate(CLOSE)

        # ---------- the feats ----------
        f = {}
        f['kraken'] = await pg.evaluate("(() => { wCupWon('rime'); return " + UN + "; })()")
        await pg.evaluate(CLOSE)
        f['djinn'] = await pg.evaluate("(() => { wSetFlag('rare_umbralden'); return " + UN + "; })()")
        f['phoenix'] = await pg.evaluate("(() => { WG.gcupWins = 1; wStarsCheck(); return " + UN + "; })()")
        check(f['kraken'] == ['kraken'] and f['djinn'] == ['djinn', 'kraken'] and 'phoenix' in f['phoenix'], 'the Rimewatch cup unlocks the Kraken, the Road to Nowhere the Djinn, the Cinder Cup the Phoenix', f)
        lg = await pg.evaluate("""(() => { WG.legBeat = { La: 1, Lb: 1 }; wStarsCheck(); const two = { p: wStarProgress('behemoth'), on: wStarOn('behemoth') };
          delete WG.starJ; WG.legBeat = { La: 1 }; wStarsCheck(); return { two, three: { p: wStarProgress('behemoth'), on: wStarOn('behemoth') } }; })()""")
        check(lg['two'] == {'p': 2, 'on': False} and lg['three'] == {'p': 3, 'on': True}, 'legends add up across journeys: the same legend beaten again in a new journey counts, and three unlock the Behemoth', lg)
        eg = await pg.evaluate("""(() => { const ids = Object.keys(DB.rareEggs), out = [];
          for (const id of ids) { WG.incu = { egg: id, due: WG.dayAbs }; wHatchEgg(); out.push(wStarProgress('hydra')); }
          return { out, on: wStarOn('hydra'), n: ids.length }; })()""")
        await pg.evaluate(CLOSE)
        check(eg['n'] == 5 and eg['out'] == [1, 2, 3, 4, 5] and eg['on'], 'each rare egg hatched counts, and all five unlock the Hydra', eg)
        check(not await pg.evaluate("wStarOn('wyrm')"), 'the Frost Wyrm is still locked without a Crown')
        ach = await pg.evaluate("__ach.filter(x => x[0] === 'realmStars').length")
        check(ach == 5, 'a medal step for each unlock', ach)

        # ---------- kept across a reload and a new journey; the Hall of Legends counts a Crown ----------
        await pg.evaluate("localStorage.setItem(wLegKey(), JSON.stringify([{ id: 'Lx', name: 'Old Crowns', players: [], year: 1 }]))")
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wStarsAll === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await new_journey(pg)
        k = await pg.evaluate(UN)
        check(k == ['behemoth', 'djinn', 'hydra', 'kraken', 'phoenix', 'wyrm'], 'unlocks are kept across a reload and a new journey, and a Crown in the Hall of Legends unlocks the Frost Wyrm', k)
        await pg.evaluate("wOpenCamp('stars')"); await pg.wait_for_selector('#modalBox .wstars')
        u = await pg.evaluate("""(() => { const rows = [...document.querySelectorAll('#modalBox .wstar')];
          return { won: rows.filter(r => r.classList.contains('won')).length, names: rows.every(r => !r.textContent.includes('???')), pow: rows[0].textContent.includes('Rebirth'), fresh: document.querySelectorAll('#modalBox .wstar .wtag').length,
            color: (r => r ? [r.querySelector('path').getAttribute('fill'), W_STAR_COL[wStar(r.dataset.star).el]] : null)(rows.find(r => r.querySelector('path'))), port: !!rows[0].querySelector('img') }; })()""")
        check(u['won'] == 6 and u['names'] and u['pow'] and u['fresh'] == 6 and (u['color'] is None or u['color'][0] == u['color'][1]) and u['port'], 'unlocked, each shows their name, element colour (a portrait once built: the Phoenix) and power, marked New', u)
        await pg.screenshot(path='/tmp/realm-stars-open.png')
        await pg.evaluate("wRenderCamp()")
        check(await pg.evaluate("document.querySelectorAll('#modalBox .wstar .wtag').length") == 0, 'New shows only the first time')
        await pg.evaluate(CLOSE)

        # ---------- LAB stores nothing ----------
        lab = await pg.evaluate("(() => { localStorage.removeItem(wStarsKey()); LAB = true; WG.crowns = [1]; const got = wStarsCheck(); LAB = false; WG.crowns = []; return { got, stored: localStorage.getItem(wStarsKey()) }; })()")
        check(lab == {'got': [], 'stored': None}, 'in LAB nothing is unlocked or stored', lab)

        # ---------- How to play, a phone ----------
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpStars'); return e ? e.textContent : ''; })()")
        check('Superstars' in h and 'Stars tab' in h and 'average level' in h and 'one a journey' in h, 'How to play explains superstars', h)
        await pg.set_viewport_size({'width': 360, 'height': 800})
        await pg.evaluate("wOpenCamp('stars')"); await pg.wait_for_selector('#modalBox .wstars')
        ph = await pg.evaluate("(() => { const b = document.getElementById('modalBox'); return { sw: b.scrollWidth, cw: b.clientWidth, doc: document.documentElement.scrollWidth <= window.innerWidth + 1 }; })()")
        await pg.screenshot(path='/tmp/realm-stars-phone.png')
        check(ph['sw'] <= ph['cw'] + 1 and ph['doc'], 'the Stars tab fits a phone', ph)
        # the other tabs still work beside it
        await pg.click('#modalBox [data-ctab="ring"]')
        rg = await pg.evaluate("({ ring: !!document.querySelector('#modalBox .wring'), sel: document.querySelector('#modalBox [data-ctab=\"stars\"]').getAttribute('aria-selected') })")
        check(rg == {'ring': True, 'sel': 'false'}, 'the Ring tab still opens beside it', rg)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

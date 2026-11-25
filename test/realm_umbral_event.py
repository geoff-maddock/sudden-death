# Realm: the Umbral's epic event (issue #99, phase 1). Before the Crown: no journal chapter, and the innkeepers have no
# dreams. Once it opens, the scene plays the first time the world is free, once (Skip ends it and says what it said in
# the log; it doesn't come back, nor after a reload). The Journal's Umbral chapter plays it again, all of it. The Pale
# Herald stands by the Coliseum's statue and answers; the innkeepers talk of dreams; the statue's block is black. The
# light realm has an eclipse at midday once a week, more days a week the longer the portal stands open.
# Asserts; exits nonzero on failure.
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
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbScene === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        pre = await pg.evaluate("""(() => { wOpenJournal(); const tab = !!document.querySelector('[data-jtab="umbral"]'); WJ.close(); return { tab, dream: wSay('hq_inn', 'dreams').text, herald: MAPS.coliseum.npcs.some(n => n.id === 'uherald') }; })()""")
        check(not pre['tab'] and 'stone' in pre['dream'] and not pre['herald'], 'before the Crown: no Umbral chapter, no dreams at the inn, no herald', pre)

        # (the Crown's own ending first: while it is pending, the scene waits)
        await pg.evaluate("W11.ending = true; wSetFlag('champion'); wRenderHud()")
        held = await pg.evaluate("(() => ({ scene: !!document.getElementById('wUmbCv'), seen: !!WG.umbral.seen }))()")
        check(held == {'scene': False, 'seen': False}, 'while the Crown\'s ending is still to come, the scene waits', held)
        await pg.evaluate("W11.ending = false")
        await pg.wait_for_function("!!document.getElementById('wUmbCv')", timeout=5000)
        await pg.wait_for_function("document.querySelectorAll('#wUmbLines p').length >= 1", timeout=8000)
        sc = await pg.evaluate("""(() => ({ seen: WG.umbral.seen === WG.dayAbs, lines: document.querySelectorAll('#wUmbLines p').length, herald: MAPS.coliseum.npcs.some(n => n.id === 'uherald'), flag: wFlag('umbral_open') }))()""")
        check(sc['seen'] and sc['lines'] >= 1 and sc['herald'] and sc['flag'], 'once open, the scene plays when the world is free, marked seen as it starts; the herald is in the Coliseum', sc)
        await pg.screenshot(path='/tmp/umbral_scene.png')
        await pg.click('#wUmbSkip')
        await pg.wait_for_function("document.getElementById('modal').hidden")
        for _ in range(3): await pg.evaluate("wRenderHud()")
        sk = await pg.evaluate("""(() => ({ shut: document.getElementById('modal').hidden, log: WLOG.slice(-3).map(l => l[0]).join(' ') }))()""")
        check(sk['shut'] and 'ten pieces' in sk['log'], 'Skip ends it, and what it said goes in the log; it does not come back', sk)

        await pg.evaluate("wSave()")
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbScene === 'function'")
        await pg.evaluate("wStart(wLoadSave()); for (let k = 0; k < 3; k++) wRenderHud()")
        rl = await pg.evaluate("""(() => ({ shut: document.getElementById('modal').hidden, herald: MAPS.coliseum.npcs.filter(n => n.id === 'uherald').length }))()""")
        check(rl == {'shut': True, 'herald': 1}, 'after a reload it stays seen, and the herald is there once', rl)

        await pg.evaluate("WUS.speed = 30; wOpenJournal('umbral')")
        jt = await pg.evaluate("""(() => ({ tab: !!document.querySelector('[data-jtab="umbral"]'), text: document.getElementById('wJBody').textContent }))()""")
        check(jt['tab'] and 'Pieces won: 0 of 10' in jt['text'], 'the Journal has its Umbral chapter, with the pieces won', jt)
        await pg.click('#wJBody [data-umbscene]')
        await pg.wait_for_function("!!document.getElementById('wUmbEnd') && !document.getElementById('wUmbEnd').hidden", timeout=8000)
        rp = await pg.evaluate("""(() => { const n = document.querySelectorAll('#wUmbLines p').length, last = document.querySelector('#wUmbLines p:last-child').textContent; document.getElementById('wUmbGo').click(); return { n, last, want: 5 + W_UMB1.speech.length, shut: document.getElementById('modal').hidden }; })()""")
        check(rp['n'] == rp['want'] and 'Start there' in rp['last'] and rp['shut'], 'from the Journal it plays again, to the herald\'s last word, and closes', rp)

        tk = await pg.evaluate("""(() => { const out = {}; out.seal = wSay('uherald', 'seal').text; out.gate = wSay('uherald', 'gate').text; out.dream = wSay('hq_inn', 'dreams').text; out.hello = wSay('hq_inn', '').text;
          wEnterMap('coliseum', MAPS.coliseum.spawn[0], MAPS.coliseum.spawn[1]); const m = MAPS.coliseum; let g = null; for (let y = 0; y < m.h && !g; y++) for (let x = 0; x < m.w; x++) if (m.t[y][x] === 'G') { g = [x, y]; break; }
          out.statue = wLookText(g[0], g[1]); return out; })()""")
        check('Ten pieces' in tk['seal'] and 'gentlest' in tk['gate'] and 'Since the Crown' in tk['dream'] and 'DREAMS' in tk['hello'] and 'black' in tk['statue'], 'the herald answers, the innkeepers dream (their hello names the DREAMS), and the statue\'s block is black', tk)

        ec = await pg.evaluate("""(() => { const U = WG.umbral, out = {}; WG.map = 'graftonbury';
          U.at = WG.dayAbs - 7; WG.min = 12.5 * 60; out.noon = wDarkness(); out.night = wIsNight(); WG.min = 9 * 60; out.morning = wDarkness();
          WG.min = 12.5 * 60; U.at = WG.dayAbs - 3; out.early3 = wUmbEclipse(); U.at = WG.dayAbs - 7 * 8 - 3; out.late3 = wUmbEclipse();
          U.at = WG.dayAbs - 7; WG.map = 'u:world'; out.dark = wDarkness();
          const n = WLOG.length; U.at = WG.dayAbs - 6; WG.map = 'graftonbury'; wNewDay(); out.dawn = WLOG.slice(n).some(l => /eclipse/i.test(l[0]));
          return out; })()""")
        check(ec['noon'] > .2 and not ec['night'] and ec['morning'] == 0 and ec['dawn'], 'an eclipse day darkens the light realm\'s sky at midday (without counting as night), not in the morning, and is said at dawn', ec)
        check(not ec['early3'] and ec['late3'], 'the blight: more eclipse days a week the longer the portal stands open', ec)

        # the blight's hunters: the hunt chance a step that w34's hook reads, at each step of the blight, light and dark
        hu = await pg.evaluate("""(() => { const U = WG.umbral, out = {}, p0 = W_DEF.huntP; let v = p0; const seen = [];
          Object.defineProperty(W_DEF, 'huntP', { get() { seen.push(v); return v; }, set(x) { v = x; }, configurable: true });
          const rnd = Math.random; Math.random = () => .999; WG.crowns = WG.crowns && WG.crowns.length ? WG.crowns : [1]; WG.crownDay = WG.dayAbs - 30; WG.event = null; WG.grace = 0; WG.grudge = null;
          const at = (weeks, map) => { U.at = WG.dayAbs - 7 * weeks; WG.map = map; seen.length = 0; wEncounterHook(regionAt(WG.x, WG.y), '.', null); return seen.length ? +(seen[seen.length - 1] / p0).toFixed(2) : null; };
          WG.map = 'world'; out.steps = [0, 4, 8, 20].map(w => { U.at = WG.dayAbs - 7 * w; return wUmbBlight(); });
          out.light = [0, 4, 8].map(w => at(w, 'world')); out.dark = at(8, 'u:world'); out.after = v / p0;
          Math.random = rnd; delete W_DEF.huntP; W_DEF.huntP = p0; return out; })()""")
        check(hu['steps'] == [1, 2, 3, 3] and hu['light'] == [1, 1.5, 2] and hu['after'] == 1, 'the blight brings more hunters on the light side as it grows, and the chance is put back after', hu)
        check(hu['dark'] in (None, 1), "the blight's hunters don't add to the dark side's own", hu)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())

# Realm: each engine's own view plays its ground's music (issue #120, phase 2). On the Ring, Gridiron, Court, Rink,
# Links, Lanes and Shed views musicWanted asks for the ground's theme (w26's wg_<ground>, as walking the ground plays):
# calm while no match is live there, fight while one is. Before, those views fell back to Sudden Death's act music.
# The Lists keep their own (w158), the Diamond is left to Brimstone Diamond's own music, and a match on the Umbral's
# dark side keeps the music it had. Asserts; exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

VIEWS = [('ring', 'g_ring', 'wRingBout'), ('gridiron', 'g_bowl', 'wGridironGame'), ('court', 'g_court', 'wCourtGame'),
         ('rink', 'g_rink', 'wRinkGame'), ('links', 'g_links', 'wLinksGame'), ('lanes', 'g_lanes', 'wLanesGame'), ('shed', 'g_shed', 'wShedGame')]

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        world = await pg.evaluate("musicWanted()")
        for view, g, start in VIEWS:
            r = await pg.evaluate("""([view, start]) => { const out = {};
              showView(view); out.idle = musicWanted().slice();
              try { window[start]({ mode: 'watch', how: 'watch' }); } catch (e) { out.err = String(e); }
              if (UI.view !== view) showView(view);
              out.view = UI.view; out.live = musicWanted().slice();
              // the Umbral is the match, not where you stand: a light match on a dark map is the ground's; a Nadir record on a light map keeps its music
              const dark = Object.keys(MAPS).find(k => MAPS[k].umbral), m0 = WG.map; WG.map = dark; out.darkMap = musicWanted().slice(); WG.map = m0;
              const V = W_GRD_MUSIC[view], R = WG[V.rec] = WG[V.rec] || {}, L0 = R.live;
              R.live = { world: { club: 'nadir:' + view } }; out.nadir = musicWanted().slice(); R.live = { world: { club: 'nadir' } }; out.finale = musicWanted().slice(); R.live = L0;
              // the match over, its result on screen: calm on the ground's tune
              const X = { ring: 'WBX', gridiron: 'WGF', court: 'WBK', rink: 'WHK', links: 'WGL', lanes: 'WBL', shed: 'WCR' }[view], rec = eval(X);
              out.rec = !!rec; if (rec) { const o0 = rec.over; rec.over = { win: 0 }; out.over = musicWanted().slice(); rec.over = o0; }
              return out; }""", [view, start])
            check(r['idle'] == ['wg_' + g, 'calm'], f'the {view} view with no match: its ground\'s theme, calm', r)
            check(r['view'] == view and r['live'] == ['wg_' + g, 'fight'], f'a match on the {view} view: its ground\'s theme, fight', r)
            check(r['darkMap'] == ['wg_' + g, 'fight'], f'a light match on the {view} view is its ground\'s, even with you standing on the dark side', r)
            check(r['nadir'][0] != 'wg_' + g and r['finale'][0] != 'wg_' + g, f'a match against the Nadir on the {view} view (a champion or the finale) keeps the music it had, wherever you stand', r)
            check(r['rec'] and r['over'] == ['wg_' + g, 'calm'], f'the {view} match over, its result on screen: calm', r)
            await pg.evaluate("(() => { try { for (const k of ['wBX', 'wGF', 'wBK', 'wHK', 'wGL', 'wBL', 'wCR']) { const a = window[k]; if (a && a.pause) a.pause(true); } } catch (e) {} showView('world'); })()")
        # a boxing card: between its bouts it is still live; at its result, calm
        cd = await pg.evaluate("""(() => { const keepW = WBX, cardD = Object.getOwnPropertyDescriptor(wBX, 'card'), liveD = Object.getOwnPropertyDescriptor(wBX, 'live'); showView('ring');
          let res = null; Object.defineProperty(wBX, 'card', { get: () => ({ result: res }), configurable: true }); Object.defineProperty(wBX, 'live', { get: () => false, configurable: true });
          WBX = { over: { win: 0 }, card: true }; const between = musicWanted().slice(); res = { win: 0 }; const done = musicWanted().slice();
          Object.defineProperty(wBX, 'card', cardD); Object.defineProperty(wBX, 'live', liveD); WBX = keepW; showView('world'); return { between, done }; })()""")
        check(cd['between'] == ['wg_g_ring', 'fight'] and cd['done'] == ['wg_g_ring', 'calm'], 'a boxing card is live between its bouts, calm at its result', cd)
        dm = await pg.evaluate("(() => { showView('diamond'); const d = musicWanted().slice(); showView('world'); return [d, musicWanted().slice()]; })()")
        check(not dm[0][0].startswith('wg_'), 'the Diamond view is left to Brimstone Diamond\'s own music', dm)
        check(dm[1] == world, 'back in the world, the world\'s music as before', [dm[1], world])
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    if FAILS:
        print(f'{len(FAILS)} failed: ' + '; '.join(FAILS)); sys.exit(1)
    print('all ok')

asyncio.run(main())
